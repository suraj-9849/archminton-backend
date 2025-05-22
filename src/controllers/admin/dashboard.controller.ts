import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { successResponse, errorResponse } from '../../utils/response';
import logger from '../../utils/logger';

const prisma = new PrismaClient();

/**
 * Controller for admin dashboard
 */
export class AdminDashboardController {
  /**
   * Get dashboard summary statistics
   * @route GET /api/admin/dashboard/stats
   */
  async getStats(req: Request, res: Response): Promise<void> {
    try {
      // Get counts for various entities
      const [
        userCount,
        venueCount,
        bookingsCount,
        pendingBookingsCount,
        activeCourtsCount,
        societiesCount,
        totalRevenue
      ] = await Promise.all([
        // Count total users
        prisma.user.count(),
        
        // Count active venues
        prisma.venue.count({
          where: { isActive: true }
        }),
        
        // Count all bookings
        prisma.booking.count(),
        
        // Count pending bookings
        prisma.booking.count({
          where: { status: 'PENDING' }
        }),
        
        // Count active courts
        prisma.court.count({
          where: { isActive: true }
        }),
        
        // Count societies
        prisma.society.count(),
        
        // Calculate total revenue
        prisma.payment.aggregate({
          _sum: {
            amount: true
          },
          where: {
            status: 'PAID'
          }
        })
      ]);

      // Get recent bookings
      const recentBookings = await prisma.booking.findMany({
        take: 10,
        orderBy: {
          createdAt: 'desc'
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

      // Construct dashboard data
      const dashboardData = {
        counts: {
          users: userCount,
          venues: venueCount,
          bookings: bookingsCount,
          pendingBookings: pendingBookingsCount,
          activeCourts: activeCourtsCount,
          societies: societiesCount
        },
        revenue: {
          total: totalRevenue._sum.amount || 0
        },
        recentBookings
      };

      successResponse(res, dashboardData, 'Dashboard statistics retrieved successfully');
    } catch (error: any) {
      logger.error('Error retrieving dashboard stats:', error);
      errorResponse(res, error.message || 'Error retrieving dashboard statistics', 500);
    }
  }

  /**
   * Get booking statistics
   * @route GET /api/admin/dashboard/booking-stats
   */
  async getBookingStats(req: Request, res: Response): Promise<void> {
    try {
      // Parse date range from query parameters
      const fromDate = req.query.fromDate ? new Date(req.query.fromDate as string) : 
                       new Date(new Date().setDate(new Date().getDate() - 30)); // Default to last 30 days
      
      const toDate = req.query.toDate ? new Date(req.query.toDate as string) : new Date();

      // Get booking counts by status
      const bookingsByStatus = await prisma.booking.groupBy({
        by: ['status'],
        _count: {
          id: true
        },
        where: {
          createdAt: {
            gte: fromDate,
            lte: toDate
          }
        }
      });

      // Get bookings with sport type info
      const bookings = await prisma.booking.findMany({
        where: {
          createdAt: {
            gte: fromDate,
            lte: toDate
          }
        },
        include: {
          court: {
            select: {
              sportType: true,
              venue: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        }
      });

      // Manually group by sport type
      const sportTypeMap = new Map<string, number>();
      bookings.forEach(booking => {
        const sportType = booking.court.sportType;
        sportTypeMap.set(sportType, (sportTypeMap.get(sportType) || 0) + 1);
      });

      // Manually group by venue
      const venueMap = new Map<number, { name: string; count: number }>();
      bookings.forEach(booking => {
        const venueId = booking.court.venue.id;
        const venueName = booking.court.venue.name;
        const currentCount = venueMap.get(venueId)?.count || 0;
        venueMap.set(venueId, { name: venueName, count: currentCount + 1 });
      });

      // Format the results
      const formattedStatusStats = bookingsByStatus.map(item => ({
        status: item.status,
        count: item._count.id
      }));

      const formattedSportStats = Array.from(sportTypeMap.entries()).map(([sportType, count]) => ({
        sportType,
        count
      }));

      const formattedVenueStats = Array.from(venueMap.entries()).map(([venueId, data]) => ({
        venueId,
        venueName: data.name,
        count: data.count
      }));

      successResponse(
        res, 
        {
          byStatus: formattedStatusStats,
          bySport: formattedSportStats,
          byVenue: formattedVenueStats,
          dateRange: {
            from: fromDate,
            to: toDate
          }
        },
        'Booking statistics retrieved successfully'
      );
    } catch (error: any) {
      logger.error('Error retrieving booking stats:', error);
      errorResponse(res, error.message || 'Error retrieving booking statistics', 500);
    }
  }

  /**
   * Get revenue statistics
   * @route GET /api/admin/dashboard/revenue-stats
   */
  async getRevenueStats(req: Request, res: Response): Promise<void> {
    try {
      // Parse date range from query parameters
      const fromDate = req.query.fromDate ? new Date(req.query.fromDate as string) : 
                       new Date(new Date().setDate(new Date().getDate() - 30)); // Default to last 30 days
      
      const toDate = req.query.toDate ? new Date(req.query.toDate as string) : new Date();

      // Get revenue by payment method
      const revenueByPaymentMethod = await prisma.payment.groupBy({
        by: ['paymentMethod'],
        _sum: {
          amount: true
        },
        where: {
          status: 'PAID',
          createdAt: {
            gte: fromDate,
            lte: toDate
          }
        }
      });

      // Get payments with venue info
      const payments = await prisma.payment.findMany({
        where: {
          status: 'PAID',
          createdAt: {
            gte: fromDate,
            lte: toDate
          }
        },
        include: {
          booking: {
            include: {
              court: {
                include: {
                  venue: {
                    select: {
                      id: true,
                      name: true
                    }
                  }
                }
              }
            }
          }
        }
      });

      // Manually group by venue
      const venueRevenueMap = new Map<number, { venueName: string; totalAmount: number }>();
      payments.forEach(payment => {
        const venueId = payment.booking.court.venue.id;
        const venueName = payment.booking.court.venue.name;
        const currentTotal = venueRevenueMap.get(venueId)?.totalAmount || 0;
        
        venueRevenueMap.set(venueId, {
          venueName,
          totalAmount: currentTotal + Number(payment.amount)
        });
      });

      // Format venue revenue data
      const formattedVenueRevenue = Array.from(venueRevenueMap.entries()).map(([venueId, data]) => ({
        venueId,
        venueName: data.venueName,
        totalAmount: data.totalAmount
      }));

      // Get total revenue
      const totalRevenue = await prisma.payment.aggregate({
        _sum: {
          amount: true
        },
        where: {
          status: 'PAID',
          createdAt: {
            gte: fromDate,
            lte: toDate
          }
        }
      });

      // Get payments for the past year
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      
      const yearlyPayments = await prisma.payment.findMany({
        where: {
          status: 'PAID',
          createdAt: {
            gte: oneYearAgo
          }
        },
        select: {
          amount: true,
          createdAt: true
        }
      });

      // Group by month and year
      const monthlyRevenue = yearlyPayments.reduce((acc, payment) => {
        const date = payment.createdAt;
        const monthYear = `${date.getFullYear()}-${date.getMonth() + 1}`;
        
        if (!acc[monthYear]) {
          acc[monthYear] = {
            month: date.getMonth() + 1,
            year: date.getFullYear(),
            total: 0
          };
        }
        
        acc[monthYear].total += Number(payment.amount);
        return acc;
      }, {} as Record<string, { month: number; year: number; total: number }>);

      successResponse(
        res, 
        {
          byPaymentMethod: revenueByPaymentMethod.map(item => ({
            paymentMethod: item.paymentMethod,
            totalAmount: item._sum.amount || 0
          })),
          byVenue: formattedVenueRevenue,
          totalRevenue: totalRevenue._sum.amount || 0,
          monthlyRevenue: Object.values(monthlyRevenue).sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;
            return a.month - b.month;
          })
        },
        'Revenue statistics retrieved successfully'
      );
    } catch (error: any) {
      logger.error('Error retrieving revenue stats:', error);
      errorResponse(res, error.message || 'Error retrieving revenue statistics', 500);
    }
  }

  /**
   * Get user statistics
   * @route GET /api/admin/dashboard/user-stats
   */
  async getUserStats(req: Request, res: Response): Promise<void> {
    try {
      // Get all users with creation date
      const users = await prisma.user.findMany({
        select: {
          id: true,
          createdAt: true,
          role: true
        }
      });

      // Group by month and year
      const monthlyRegistrations = users.reduce((acc, user) => {
        const date = user.createdAt;
        const monthYear = `${date.getFullYear()}-${date.getMonth() + 1}`;
        
        if (!acc[monthYear]) {
          acc[monthYear] = {
            month: date.getMonth() + 1,
            year: date.getFullYear(),
            count: 0
          };
        }
        
        acc[monthYear].count += 1;
        return acc;
      }, {} as Record<string, { month: number; year: number; count: number }>);

      // Group by role
      const roleCountMap = users.reduce((acc, user) => {
        const role = user.role;
        acc[role] = (acc[role] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const usersByRole = Object.entries(roleCountMap).map(([role, count]) => ({
        role,
        count
      }));

      // Get active users (users with bookings in the last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const bookings = await prisma.booking.findMany({
        where: {
          createdAt: {
            gte: thirtyDaysAgo
          }
        },
        select: {
          userId: true
        },
        distinct: ['userId']
      });

      const activeUserIds = new Set(bookings.map(booking => booking.userId));

      successResponse(
        res, 
        {
          totalUsers: users.length,
          activeUsersLast30Days: activeUserIds.size,
          byRole: usersByRole,
          monthlyRegistrations: Object.values(monthlyRegistrations).sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;
            return a.month - b.month;
          })
        },
        'User statistics retrieved successfully'
      );
    } catch (error: any) {
      logger.error('Error retrieving user stats:', error);
      errorResponse(res, error.message || 'Error retrieving user statistics', 500);
    }
  }
}

export default new AdminDashboardController();