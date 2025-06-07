import { Request, Response } from 'express';
import { PrismaClient, PaymentStatus } from '@prisma/client';
import courseService from '../../services/course.service';
import { successResponse, errorResponse } from '../../utils/response';
import logger from '../../utils/logger';

const prisma = new PrismaClient();

/**
 * Admin controller for course management
 */
export class AdminCourseController {
  /**
   * Get all courses with pagination and filters
   * @route GET /api/admin/courses
   */
  async getAllCourses(req: Request, res: Response): Promise<void> {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;
      const sportType = req.query.sportType as any | undefined;
      const venueId = req.query.venueId ? Number(req.query.venueId) : undefined;
      const isActive = req.query.isActive !== undefined 
        ? req.query.isActive === 'true' 
        : undefined;
      const search = req.query.search as string | undefined;

      // Build filter conditions
      const where: any = {};

      if (sportType) {
        where.sportType = sportType;
      }

      if (venueId) {
        where.venueId = venueId;
      }

      if (isActive !== undefined) {
        where.isActive = isActive;
      }

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } }
        ];
      }

      // Calculate pagination
      const skip = (page - 1) * limit;

      const [courses, totalCourses] = await Promise.all([
        prisma.course.findMany({
          where,
          include: {
            enrollments: {
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
                enrollments: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          skip,
          take: limit
        }),
        prisma.course.count({ where })
      ]);

      const totalPages = Math.ceil(totalCourses / limit);

      successResponse(
        res,
        {
          courses,
          pagination: {
            page,
            limit,
            totalCourses,
            totalPages,
            hasNext: page < totalPages,
            hasPrevious: page > 1
          }
        },
        'Courses retrieved successfully'
      );
    } catch (error: any) {
      logger.error('Error getting courses (admin):', error);
      errorResponse(res, error.message || 'Error retrieving courses', 500);
    }
  }

  /**
   * Create new course
   * @route POST /api/admin/courses
   */
  async createCourse(req: Request, res: Response): Promise<void> {
    try {
      const { name, description, sportType, venueId, price, duration, startDate, endDate } = req.body;

      // Check if venue exists
      const venue = await prisma.venue.findUnique({
        where: { id: Number(venueId) }
      });

      if (!venue) {
        errorResponse(res, 'Venue not found', 404);
        return;
      }

      const course = await courseService.createCourse({
        name,
        description,
        sportType,
        venueId: Number(venueId),
        price: Number(price),
        duration: Number(duration),
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined
      });

      successResponse(res, course, 'Course created successfully', 201);
    } catch (error: any) {
      logger.error('Error creating course:', error);
      errorResponse(res, error.message || 'Error creating course', 400);
    }
  }

  /**
   * Get course by ID
   * @route GET /api/admin/courses/:id
   */
  async getCourseById(req: Request, res: Response): Promise<void> {
    try {
      const courseId = Number(req.params.id);
      
      if (isNaN(courseId)) {
        errorResponse(res, 'Invalid course ID', 400);
        return;
      }

      const course = await courseService.getCourseById(courseId);
      successResponse(res, course, 'Course retrieved successfully');
    } catch (error: any) {
      logger.error('Error getting course by ID:', error);
      errorResponse(
        res, 
        error.message || 'Error retrieving course', 
        error.message.includes('not found') ? 404 : 500
      );
    }
  }

  /**
   * Update course
   * @route PUT /api/admin/courses/:id
   */
  async updateCourse(req: Request, res: Response): Promise<void> {
    try {
      const courseId = Number(req.params.id);
      
      if (isNaN(courseId)) {
        errorResponse(res, 'Invalid course ID', 400);
        return;
      }

      const { name, description, sportType, price, duration, startDate, endDate, isActive } = req.body;

      const updateData: any = {};
      
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (sportType !== undefined) updateData.sportType = sportType;
      if (price !== undefined) updateData.price = Number(price);
      if (duration !== undefined) updateData.duration = Number(duration);
      if (startDate !== undefined) updateData.startDate = new Date(startDate);
      if (endDate !== undefined) updateData.endDate = new Date(endDate);
      if (isActive !== undefined) updateData.isActive = isActive;

      const course = await courseService.updateCourse(courseId, updateData);
      successResponse(res, course, 'Course updated successfully');
    } catch (error: any) {
      logger.error('Error updating course:', error);
      errorResponse(
        res, 
        error.message || 'Error updating course', 
        error.message.includes('not found') ? 404 : 400
      );
    }
  }

  /**
   * Delete course
   * @route DELETE /api/admin/courses/:id
   */
  async deleteCourse(req: Request, res: Response): Promise<void> {
    try {
      const courseId = Number(req.params.id);
      
      if (isNaN(courseId)) {
        errorResponse(res, 'Invalid course ID', 400);
        return;
      }

      await courseService.deleteCourse(courseId);
      successResponse(res, null, 'Course deleted successfully');
    } catch (error: any) {
      logger.error('Error deleting course:', error);
      errorResponse(
        res, 
        error.message || 'Error deleting course', 
        error.message.includes('not found') ? 404 : 400
      );
    }
  }

  /**
   * Get course enrollments
   * @route GET /api/admin/courses/:id/enrollments
   */
  async getCourseEnrollments(req: Request, res: Response): Promise<void> {
    try {
      const courseId = Number(req.params.id);
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;
      const paymentStatus = req.query.paymentStatus as PaymentStatus | undefined;
      
      if (isNaN(courseId)) {
        errorResponse(res, 'Invalid course ID', 400);
        return;
      }

      // Check if course exists
      const course = await prisma.course.findUnique({
        where: { id: courseId }
      });

      if (!course) {
        errorResponse(res, 'Course not found', 404);
        return;
      }

      // Build filter conditions
      const where: any = { courseId };

      if (paymentStatus) {
        where.paymentStatus = paymentStatus;
      }

      // Calculate pagination
      const skip = (page - 1) * limit;

      const [enrollments, totalEnrollments] = await Promise.all([
        prisma.courseEnrollment.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                gender: true
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
          },
          orderBy: {
            createdAt: 'desc'
          },
          skip,
          take: limit
        }),
        prisma.courseEnrollment.count({ where })
      ]);

      const totalPages = Math.ceil(totalEnrollments / limit);

      successResponse(
        res,
        {
          enrollments,
          pagination: {
            page,
            limit,
            totalEnrollments,
            totalPages,
            hasNext: page < totalPages,
            hasPrevious: page > 1
          }
        },
        'Course enrollments retrieved successfully'
      );
    } catch (error: any) {
      logger.error('Error getting course enrollments:', error);
      errorResponse(res, error.message || 'Error retrieving course enrollments', 500);
    }
  }

  /**
   * Update enrollment payment status
   * @route PATCH /api/admin/courses/enrollments/:enrollmentId/payment-status
   */
  async updateEnrollmentPaymentStatus(req: Request, res: Response): Promise<void> {
    try {
      const enrollmentId = Number(req.params.enrollmentId);
      
      if (isNaN(enrollmentId)) {
        errorResponse(res, 'Invalid enrollment ID', 400);
        return;
      }

      const { paymentStatus } = req.body;

      const enrollment = await courseService.updateEnrollmentPaymentStatus(enrollmentId, paymentStatus);
      successResponse(res, enrollment, 'Enrollment payment status updated successfully');
    } catch (error: any) {
      logger.error('Error updating enrollment payment status:', error);
      errorResponse(
        res, 
        error.message || 'Error updating enrollment payment status', 
        error.message.includes('not found') ? 404 : 400
      );
    }
  }

  /**
   * Cancel enrollment
   * @route POST /api/admin/courses/enrollments/:enrollmentId/cancel
   */
  async cancelEnrollment(req: Request, res: Response): Promise<void> {
    try {
      const enrollmentId = Number(req.params.enrollmentId);
      
      if (isNaN(enrollmentId)) {
        errorResponse(res, 'Invalid enrollment ID', 400);
        return;
      }

      const { reason } = req.body;

      // Check if enrollment exists
      const enrollment = await prisma.courseEnrollment.findUnique({
        where: { id: enrollmentId },
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
              price: true
            }
          }
        }
      });

      if (!enrollment) {
        errorResponse(res, 'Enrollment not found', 404);
        return;
      }

      // Delete enrollment (or you could add a status field for soft delete)
      await prisma.courseEnrollment.delete({
        where: { id: enrollmentId }
      });

      successResponse(res, null, 'Enrollment cancelled successfully');
    } catch (error: any) {
      logger.error('Error cancelling enrollment:', error);
      errorResponse(res, error.message || 'Error cancelling enrollment', 400);
    }
  }

  /**
   * Get course statistics
   * @route GET /api/admin/courses/:id/statistics
   */
  async getCourseStatistics(req: Request, res: Response): Promise<void> {
    try {
      const courseId = Number(req.params.id);
      
      if (isNaN(courseId)) {
        errorResponse(res, 'Invalid course ID', 400);
        return;
      }

      // Check if course exists
      const course = await prisma.course.findUnique({
        where: { id: courseId }
      });

      if (!course) {
        errorResponse(res, 'Course not found', 404);
        return;
      }

      const statistics = await courseService.getEnrollmentStatistics(courseId);
      successResponse(res, statistics, 'Course statistics retrieved successfully');
    } catch (error: any) {
      logger.error('Error getting course statistics:', error);
      errorResponse(res, error.message || 'Error retrieving course statistics', 500);
    }
  }
}

export default new AdminCourseController();