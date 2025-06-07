import { PrismaClient, PaymentStatus } from '@prisma/client';
import logger from '../utils/logger';

const prisma = new PrismaClient();

// Interface for course creation
interface CreateCourseInput {
  name: string;
  description?: string;
  sportType: any;
  venueId: number;
  price: number;
  duration: number; // in days
  startDate?: Date;
  endDate?: Date;
}

// Interface for course update
interface UpdateCourseInput {
  name?: string;
  description?: string;
  sportType?: any;
  price?: number;
  duration?: number;
  startDate?: Date;
  endDate?: Date;
  isActive?: boolean;
}

// Interface for course enrollment
interface EnrollCourseInput {
  userId: number;
  courseId: number;
  startDate: Date;
  endDate: Date;
}

/**
 * Service for course-related operations
 */
export class CourseService {
  /**
   * Get all courses with optional filters
   */
  async getAllCourses(filters?: {
    sportType?: any;
    venueId?: number;
    isActive?: boolean;
    search?: string;
  }) {
    const where: any = {};

    if (filters?.sportType) {
      where.sportType = filters.sportType;
    }

    if (filters?.venueId) {
      where.venueId = filters.venueId;
    }

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } }
      ];
    }

    return prisma.course.findMany({
      where,
      include: {
        enrollments: {
          where: {
            paymentStatus: PaymentStatus.PAID
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        },
        _count: {
          select: {
            enrollments: {
              where: {
                paymentStatus: PaymentStatus.PAID
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  /**
   * Get course by ID with detailed information
   */
  async getCourseById(courseId: number) {
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        enrollments: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                gender: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!course) {
      throw new Error('Course not found');
    }

    return course;
  }

  /**
   * Create a new course
   */
  async createCourse(courseData: CreateCourseInput) {
    // Check if venue exists
    const venue = await prisma.venue.findUnique({
      where: { id: courseData.venueId }
    });

    if (!venue) {
      throw new Error('Venue not found');
    }

    // Calculate end date if not provided
    let endDate = courseData.endDate;
    if (!endDate && courseData.startDate) {
      endDate = new Date(courseData.startDate);
      endDate.setDate(endDate.getDate() + courseData.duration);
    }

    return prisma.course.create({
      data: {
        name: courseData.name,
        description: courseData.description,
        sportType: courseData.sportType,
        venueId: courseData.venueId,
        price: courseData.price,
        duration: courseData.duration,
        startDate: courseData.startDate,
        endDate
      }
    });
  }

  /**
   * Update course
   */
  async updateCourse(courseId: number, updateData: UpdateCourseInput) {
    // Check if course exists
    const course = await prisma.course.findUnique({
      where: { id: courseId }
    });

    if (!course) {
      throw new Error('Course not found');
    }

    // Calculate end date if duration or start date is updated
    let endDate = updateData.endDate;
    if (!endDate && updateData.startDate && updateData.duration) {
      endDate = new Date(updateData.startDate);
      endDate.setDate(endDate.getDate() + updateData.duration);
    } else if (!endDate && updateData.startDate && course.duration) {
      endDate = new Date(updateData.startDate);
      endDate.setDate(endDate.getDate() + course.duration);
    } else if (!endDate && course.startDate && updateData.duration) {
      endDate = new Date(course.startDate);
      endDate.setDate(endDate.getDate() + updateData.duration);
    }

    return prisma.course.update({
      where: { id: courseId },
      data: {
        ...updateData,
        endDate
      },
      include: {
        _count: {
          select: {
            enrollments: true
          }
        }
      }
    });
  }

  /**
   * Delete course
   */
  async deleteCourse(courseId: number) {
    // Check if course exists
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: {
        enrollments: {
          where: {
            paymentStatus: PaymentStatus.PAID
          }
        }
      }
    });

    if (!course) {
      throw new Error('Course not found');
    }

    // Check if course has active enrollments
    if (course.enrollments.length > 0) {
      // Soft delete - deactivate course
      return prisma.course.update({
        where: { id: courseId },
        data: { isActive: false }
      });
    } else {
      // Hard delete course
      return prisma.course.delete({
        where: { id: courseId }
      });
    }
  }

  /**
   * Enroll user in course
   */
  async enrollInCourse(enrollmentData: EnrollCourseInput) {
    // Check if course exists and is active
    const course = await prisma.course.findUnique({
      where: { id: enrollmentData.courseId }
    });

    if (!course || !course.isActive) {
      throw new Error('Course not found or inactive');
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: enrollmentData.userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Check if user is already enrolled
    const existingEnrollment = await prisma.courseEnrollment.findFirst({
      where: {
        userId: enrollmentData.userId,
        courseId: enrollmentData.courseId
      }
    });

    if (existingEnrollment) {
      throw new Error('User is already enrolled in this course');
    }

    return prisma.courseEnrollment.create({
      data: {
        userId: enrollmentData.userId,
        courseId: enrollmentData.courseId,
        startDate: enrollmentData.startDate,
        endDate: enrollmentData.endDate
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        course: {
          select: {
            id: true,
            name: true,
            sportType: true,
            price: true
          }
        }
      }
    });
  }

  /**
   * Update enrollment payment status
   */
  async updateEnrollmentPaymentStatus(enrollmentId: number, paymentStatus: PaymentStatus) {
    // Check if enrollment exists
    const enrollment = await prisma.courseEnrollment.findUnique({
      where: { id: enrollmentId }
    });

    if (!enrollment) {
      throw new Error('Enrollment not found');
    }

    return prisma.courseEnrollment.update({
      where: { id: enrollmentId },
      data: { paymentStatus },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        course: {
          select: {
            id: true,
            name: true,
            sportType: true
          }
        }
      }
    });
  }

  /**
   * Get courses by venue
   */
  async getCoursesByVenue(venueId: number, includeInactive = false) {
    const where: any = { venueId };
    
    if (!includeInactive) {
      where.isActive = true;
    }

    return prisma.course.findMany({
      where,
      include: {
        _count: {
          select: {
            enrollments: {
              where: {
                paymentStatus: PaymentStatus.PAID
              }
            }
          }
        }
      },
      orderBy: {
        startDate: 'asc'
      }
    });
  }

  /**
   * Get upcoming courses
   */
  async getUpcomingCourses() {
    const today = new Date();
    
    return prisma.course.findMany({
      where: {
        isActive: true,
        OR: [
          { startDate: { gte: today } },
          { startDate: null }
        ]
      },
      include: {
        _count: {
          select: {
            enrollments: {
              where: {
                paymentStatus: PaymentStatus.PAID
              }
            }
          }
        }
      },
      orderBy: {
        startDate: 'asc'
      }
    });
  }

  /**
   * Get enrollment statistics
   */
  async getEnrollmentStatistics(courseId?: number) {
    const where: any = {};
    
    if (courseId) {
      where.courseId = courseId;
    }

    const [
      totalEnrollments,
      paidEnrollments,
      pendingEnrollments,
      totalRevenue
    ] = await Promise.all([
      prisma.courseEnrollment.count({ where }),
      prisma.courseEnrollment.count({
        where: { ...where, paymentStatus: PaymentStatus.PAID }
      }),
      prisma.courseEnrollment.count({
        where: { ...where, paymentStatus: PaymentStatus.PENDING }
      }),
      prisma.courseEnrollment.findMany({
        where: { ...where, paymentStatus: PaymentStatus.PAID },
        include: { course: { select: { price: true } } }
      }).then(enrollments => 
        enrollments.reduce((sum, enrollment) => sum + Number(enrollment.course.price), 0)
      )
    ]);

    return {
      totalEnrollments,
      paidEnrollments,
      pendingEnrollments,
      totalRevenue
    };
  }
}

export default new CourseService();