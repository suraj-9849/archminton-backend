import { PrismaClient, User, BookingStatus } from '@prisma/client';
import logger from '../utils/logger';

const prisma = new PrismaClient();

// Interface for profile update data
interface UpdateProfileInput {
  name?: string;
  phone?: string;
  gender?: string;
}

// Interface for booking filter options
interface BookingFilterOptions {
  status?: BookingStatus;
  fromDate?: Date;
  toDate?: Date;
}

/**
 * Service for user-related operations
 */
export class UserService {
  /**
   * Get user profile by ID
   */
  async getUserProfile(userId: number): Promise<Omit<User, 'password'>> {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Remove password from user object
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: number, data: UpdateProfileInput): Promise<Omit<User, 'password'>> {
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Update user profile
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data
    });

    // Remove password from user object
    const { password, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword;
  }

  /**
   * Get user's society memberships
   */
  async getUserSocieties(userId: number) {
    // Get all active society memberships for the user
    const memberships = await prisma.societyMember.findMany({
      where: { 
        userId,
        isActive: true 
      },
      include: {
        society: true
      }
    });

    return memberships;
  }

  /**
   * Apply for society membership
   */
  async applyForSociety(userId: number, societyId: number) {
    // Check if society exists
    const society = await prisma.society.findUnique({
      where: { id: societyId }
    });

    if (!society) {
      throw new Error('Society not found');
    }

    // Check if user is already a member of this society
    const existingMembership = await prisma.societyMember.findUnique({
      where: {
        userId_societyId: {
          userId,
          societyId
        }
      }
    });

    if (existingMembership) {
      if (existingMembership.isActive) {
        throw new Error('User is already a member of this society');
      }

      // Reactivate membership
      return prisma.societyMember.update({
        where: {
          userId_societyId: {
            userId,
            societyId
          }
        },
        data: { isActive: true },
        include: { society: true }
      });
    }

    // Create new membership
    return prisma.societyMember.create({
      data: {
        userId,
        societyId
      },
      include: { society: true }
    });
  }

  /**
   * Get user's bookings with filter options
   */
  async getUserBookings(userId: number, filterOptions?: BookingFilterOptions) {
    const where: any = { userId };

    // Apply status filter if provided
    if (filterOptions?.status) {
      where.status = filterOptions.status;
    }

    // Apply date range filter if provided
    if (filterOptions?.fromDate || filterOptions?.toDate) {
      where.bookingDate = {};

      if (filterOptions.fromDate) {
        where.bookingDate.gte = filterOptions.fromDate;
      }

      if (filterOptions.toDate) {
        where.bookingDate.lte = filterOptions.toDate;
      }
    }

    return prisma.booking.findMany({
      where,
      include: {
        court: {
          include: {
            venue: {
              select: {
                id: true,
                name: true,
                location: true,
                images: {
                  where: { isDefault: true },
                  take: 1
                }
              }
            }
          }
        },
        timeSlot: true,
        addOns: true,
        payment: true
      },
      orderBy: {
        bookingDate: 'desc'
      }
    });
  }

  /**
   * Get user's course enrollments
   */
  async getUserCourseEnrollments(userId: number) {
    return prisma.courseEnrollment.findMany({
      where: { userId },
      include: {
        course: true
      },
      orderBy: {
        startDate: 'desc'
      }
    });
  }

  /**
   * Get specific booking by ID for a user
   */
  async getUserBookingById(userId: number, bookingId: number) {
    const booking = await prisma.booking.findFirst({
      where: {
        id: bookingId,
        userId
      },
      include: {
        court: {
          include: {
            venue: true
          }
        },
        timeSlot: true,
        addOns: true,
        payment: true
      }
    });

    if (!booking) {
      throw new Error('Booking not found');
    }

    return booking;
  }

  /**
   * Cancel a booking
   */
  async cancelBooking(userId: number, bookingId: number) {
    // Find the booking
    const booking = await prisma.booking.findFirst({
      where: {
        id: bookingId,
        userId
      }
    });

    if (!booking) {
      throw new Error('Booking not found');
    }

    // Check if booking is already cancelled
    if (booking.status === BookingStatus.CANCELLED) {
      throw new Error('Booking is already cancelled');
    }

    // Check if booking is completed
    if (booking.status === BookingStatus.COMPLETED) {
      throw new Error('Cannot cancel a completed booking');
    }

    // Cancel the booking
    return prisma.booking.update({
      where: { id: bookingId },
      data: { 
        status: BookingStatus.CANCELLED
      },
      include: {
        court: {
          include: {
            venue: true
          }
        },
        timeSlot: true
      }
    });
  }
}

export default new UserService();