import { Request, Response } from 'express';
import { PrismaClient, BookingStatus, PaymentStatus } from '@prisma/client';
import { successResponse, errorResponse } from '../../utils/response';
import logger from '../../utils/logger';

const prisma = new PrismaClient();

/**
 * Admin controller for booking management
 */
export class AdminBookingController {
  /**
   * Get all bookings with pagination and filters
   * @route GET /api/admin/bookings
   */
  async getAllBookings(req: Request, res: Response): Promise<void> {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;
      const status = req.query.status as BookingStatus | undefined;
      const paymentStatus = req.query.paymentStatus as PaymentStatus | undefined;
      const venueId = req.query.venueId ? Number(req.query.venueId) : undefined;
      const userId = req.query.userId ? Number(req.query.userId) : undefined;
      const fromDate = req.query.fromDate ? new Date(req.query.fromDate as string) : undefined;
      const toDate = req.query.toDate ? new Date(req.query.toDate as string) : undefined;

      // Build filter conditions
      const where: any = {};

      if (status) {
        where.status = status;
      }

      if (paymentStatus) {
        where.paymentStatus = paymentStatus;
      }

      if (venueId) {
        where.court = {
          venueId
        };
      }

      if (userId) {
        where.userId = userId;
      }

      if (fromDate || toDate) {
        where.bookingDate = {};
        if (fromDate) where.bookingDate.gte = fromDate;
        if (toDate) where.bookingDate.lte = toDate;
      }

      // Calculate pagination
      const skip = (page - 1) * limit;

      const [bookings, totalBookings] = await Promise.all([
        prisma.booking.findMany({
          where,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true
              }
            },
            court: {
              include: {
                venue: {
                  select: {
                    id: true,
                    name: true,
                    location: true
                  }
                }
              }
            },
            timeSlot: true,
            addOns: true,
            payment: true
          },
          orderBy: {
            createdAt: 'desc'
          },
          skip,
          take: limit
        }),
        prisma.booking.count({ where })
      ]);

      const totalPages = Math.ceil(totalBookings / limit);

      successResponse(
        res,
        {
          bookings,
          pagination: {
            page,
            limit,
            totalBookings,
            totalPages,
            hasNext: page < totalPages,
            hasPrevious: page > 1
          }
        },
        'Bookings retrieved successfully'
      );
    } catch (error: any) {
      logger.error('Error getting bookings (admin):', error);
      errorResponse(res, error.message || 'Error retrieving bookings', 500);
    }
  }

  /**
   * Get booking details by ID
   * @route GET /api/admin/bookings/:id
   */
  async getBookingById(req: Request, res: Response): Promise<void> {
    try {
      const bookingId = Number(req.params.id);
      
      if (isNaN(bookingId)) {
        errorResponse(res, 'Invalid booking ID', 400);
        return;
      }

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
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
          court: {
            include: {
              venue: {
                include: {
                  society: {
                    select: {
                      id: true,
                      name: true
                    }
                  }
                }
              }
            }
          },
          timeSlot: true,
          addOns: true,
          payment: true
        }
      });

      if (!booking) {
        errorResponse(res, 'Booking not found', 404);
        return;
      }

      successResponse(res, booking, 'Booking details retrieved successfully');
    } catch (error: any) {
      logger.error('Error getting booking details (admin):', error);
      errorResponse(res, error.message || 'Error retrieving booking details', 500);
    }
  }

  /**
   * Update booking status
   * @route PATCH /api/admin/bookings/:id/status
   */
  async updateBookingStatus(req: Request, res: Response): Promise<void> {
    try {
      const bookingId = Number(req.params.id);
      
      if (isNaN(bookingId)) {
        errorResponse(res, 'Invalid booking ID', 400);
        return;
      }

      const { status } = req.body;

      // Check if booking exists
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId }
      });

      if (!booking) {
        errorResponse(res, 'Booking not found', 404);
        return;
      }

      // Update booking status
      const updatedBooking = await prisma.booking.update({
        where: { id: bookingId },
        data: { status },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          court: {
            include: {
              venue: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          },
          timeSlot: true,
          payment: true
        }
      });

      successResponse(res, updatedBooking, 'Booking status updated successfully');
    } catch (error: any) {
      logger.error('Error updating booking status (admin):', error);
      errorResponse(res, error.message || 'Error updating booking status', 400);
    }
  }

  /**
   * Update payment status
   * @route PATCH /api/admin/bookings/:id/payment-status
   */
  async updatePaymentStatus(req: Request, res: Response): Promise<void> {
    try {
      const bookingId = Number(req.params.id);
      
      if (isNaN(bookingId)) {
        errorResponse(res, 'Invalid booking ID', 400);
        return;
      }

      const { paymentStatus } = req.body;

      // Check if booking exists
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          payment: true
        }
      });

      if (!booking) {
        errorResponse(res, 'Booking not found', 404);
        return;
      }

      // Update booking payment status
      const updatedBooking = await prisma.booking.update({
        where: { id: bookingId },
        data: { paymentStatus },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          court: {
            include: {
              venue: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          },
          payment: true
        }
      });

      // Update payment record if exists
      if (booking.payment) {
        await prisma.payment.update({
          where: { id: booking.payment.id },
          data: { status: paymentStatus }
        });
      }

      successResponse(res, updatedBooking, 'Payment status updated successfully');
    } catch (error: any) {
      logger.error('Error updating payment status (admin):', error);
      errorResponse(res, error.message || 'Error updating payment status', 400);
    }
  }

  /**
   * Cancel booking (admin)
   * @route POST /api/admin/bookings/:id/cancel
   */
  async cancelBooking(req: Request, res: Response): Promise<void> {
    try {
      const bookingId = Number(req.params.id);
      
      if (isNaN(bookingId)) {
        errorResponse(res, 'Invalid booking ID', 400);
        return;
      }

      const { reason } = req.body;

      // Check if booking exists
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          payment: true
        }
      });

      if (!booking) {
        errorResponse(res, 'Booking not found', 404);
        return;
      }

      if (booking.status === BookingStatus.CANCELLED) {
        errorResponse(res, 'Booking is already cancelled', 400);
        return;
      }

      // Cancel booking
      const cancelledBooking = await prisma.booking.update({
        where: { id: bookingId },
        data: { 
          status: BookingStatus.CANCELLED,
          // You might want to add a reason field to your schema
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          court: {
            include: {
              venue: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          },
          payment: true
        }
      });

      // Process refund if payment was made
      if (booking.payment && booking.payment.status === PaymentStatus.PAID) {
        await prisma.payment.update({
          where: { id: booking.payment.id },
          data: { status: PaymentStatus.REFUNDED }
        });

        await prisma.booking.update({
          where: { id: bookingId },
          data: { paymentStatus: PaymentStatus.REFUNDED }
        });
      }

      successResponse(res, cancelledBooking, 'Booking cancelled successfully');
    } catch (error: any) {
      logger.error('Error cancelling booking (admin):', error);
      errorResponse(res, error.message || 'Error cancelling booking', 400);
    }
  }

  /**
   * Get booking statistics
   * @route GET /api/admin/bookings/statistics
   */
  async getBookingStatistics(req: Request, res: Response): Promise<void> {
    try {
      const fromDate = req.query.fromDate ? new Date(req.query.fromDate as string) : 
                       new Date(new Date().setDate(new Date().getDate() - 30));
      const toDate = req.query.toDate ? new Date(req.query.toDate as string) : new Date();

      const [
        totalBookings,
        confirmedBookings,
        pendingBookings,
        cancelledBookings,
        completedBookings,
        totalRevenue,
        averageBookingValue
      ] = await Promise.all([
        // Total bookings in date range
        prisma.booking.count({
          where: {
            createdAt: { gte: fromDate, lte: toDate }
          }
        }),
        
        // Confirmed bookings
        prisma.booking.count({
          where: {
            status: BookingStatus.CONFIRMED,
            createdAt: { gte: fromDate, lte: toDate }
          }
        }),
        
        // Pending bookings
        prisma.booking.count({
          where: {
            status: BookingStatus.PENDING,
            createdAt: { gte: fromDate, lte: toDate }
          }
        }),
        
        // Cancelled bookings
        prisma.booking.count({
          where: {
            status: BookingStatus.CANCELLED,
            createdAt: { gte: fromDate, lte: toDate }
          }
        }),
        
        // Completed bookings
        prisma.booking.count({
          where: {
            status: BookingStatus.COMPLETED,
            createdAt: { gte: fromDate, lte: toDate }
          }
        }),
        
        // Total revenue
        prisma.payment.aggregate({
          _sum: { amount: true },
          where: {
            status: PaymentStatus.PAID,
            createdAt: { gte: fromDate, lte: toDate }
          }
        }),
        
        // Average booking value
        prisma.booking.aggregate({
          _avg: { totalAmount: true },
          where: {
            createdAt: { gte: fromDate, lte: toDate }
          }
        })
      ]);

      const statistics = {
        dateRange: { from: fromDate, to: toDate },
        bookings: {
          total: totalBookings,
          confirmed: confirmedBookings,
          pending: pendingBookings,
          cancelled: cancelledBookings,
          completed: completedBookings
        },
        revenue: {
          total: totalRevenue._sum.amount || 0,
          average: averageBookingValue._avg.totalAmount || 0
        }
      };

      successResponse(res, statistics, 'Booking statistics retrieved successfully');
    } catch (error: any) {
      logger.error('Error getting booking statistics:', error);
      errorResponse(res, error.message || 'Error retrieving booking statistics', 500);
    }
  }
}

export default new AdminBookingController();