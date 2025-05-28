import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { successResponse, errorResponse } from "../../utils/response";
import logger from "../../utils/logger";

const prisma = new PrismaClient();

/**
 * Enhanced controller for admin dashboard with comprehensive analytics
 */
export class AdminDashboardController {
  /**
   * Get comprehensive dashboard analytics
   * @route GET /api/admin/dashboard/analytics
   */
  async getDashboardAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const venueId = req.query.venueId ? Number(req.query.venueId) : undefined;
      const fromDate = req.query.fromDate
        ? new Date(req.query.fromDate as string)
        : new Date(new Date().setDate(new Date().getDate() - 30));
      const toDate = req.query.toDate
        ? new Date(req.query.toDate as string)
        : new Date();

      // Base where clause for venue filtering
      const venueFilter = venueId ? { court: { venueId } } : {};
      const venueDirectFilter = venueId ? { venueId } : {};

      // Get parallel analytics data
      const [
        // Basic counts
        totalUsers,
        totalVenues,
        totalBookings,
        totalCourts,

        // Booking analytics
        bookingsByStatus,
        bookingsByPaymentStatus,
        recentBookings,

        // Revenue analytics
        totalRevenue,
        revenueByPaymentMethod,
        monthlyRevenue,

        // User analytics
        uniqueUsersCount,
        userRegistrationTrend,

        // Court utilization
        courtUtilization,

        // Sport-wise analytics
        bookingsBySport,

        // Time-based analytics
        dailyBookings,

        // Cancellation analytics
        cancellationData,

        // Top performers
        topUsers,
        topCourts,
      ] = await Promise.all([
        // Basic counts
        prisma.user.count(),
        prisma.venue.count({
          where: { isActive: true, ...(venueId && { id: venueId }) },
        }),
        prisma.booking.count({
          where: {
            ...venueFilter,
            createdAt: { gte: fromDate, lte: toDate },
          },
        }),
        prisma.court.count({
          where: {
            isActive: true,
            ...venueDirectFilter,
          },
        }),

        // Booking analytics
        prisma.booking.groupBy({
          by: ["status"],
          _count: { id: true },
          where: {
            ...venueFilter,
            createdAt: { gte: fromDate, lte: toDate },
          },
        }),

        prisma.booking.groupBy({
          by: ["paymentStatus"],
          _count: { id: true },
          _sum: { totalAmount: true },
          where: {
            ...venueFilter,
            createdAt: { gte: fromDate, lte: toDate },
          },
        }),

        prisma.booking.findMany({
          where: {
            ...venueFilter,
            createdAt: { gte: fromDate, lte: toDate },
          },
          include: {
            user: { select: { id: true, name: true, email: true } },
            court: {
              select: {
                id: true,
                name: true,
                sportType: true,
                venue: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        }),

        // Revenue analytics
        prisma.booking.aggregate({
          _sum: { totalAmount: true },
          where: {
            ...venueFilter,
            paymentStatus: "PAID",
            createdAt: { gte: fromDate, lte: toDate },
          },
        }),

        prisma.payment.groupBy({
          by: ["paymentMethod"],
          _sum: { amount: true },
          _count: { id: true },
          where: {
            status: "PAID",
            createdAt: { gte: fromDate, lte: toDate },
            ...(venueId && {
              booking: { court: { venueId } },
            }),
          },
        }),

        // Monthly revenue for the last 12 months
        this.getMonthlyRevenue(venueId, 12),

        // Unique users who made bookings
        prisma.booking.groupBy({
          by: ["userId"],
          where: {
            ...venueFilter,
            createdAt: { gte: fromDate, lte: toDate },
          },
        }),

        // User registration trend (last 6 months)
        this.getUserRegistrationTrend(6),

        // Court utilization
        this.getCourtUtilization(venueId, fromDate, toDate),

        // Bookings by sport
        prisma.booking
          .groupBy({
            by: ["courtId"],
            _count: { id: true },
            where: {
              ...venueFilter,
              createdAt: { gte: fromDate, lte: toDate },
            },
          })
          .then(async (results) => {
            const courtIds = results.map((r) => r.courtId);
            const courts = await prisma.court.findMany({
              where: { id: { in: courtIds } },
              select: { id: true, sportType: true },
            });

            const sportCounts = courts.reduce((acc, court) => {
              const bookingCount =
                results.find((r: any) => r.court === court.id)?._count.id || 0;
              acc[court.sportType] = (acc[court.sportType] || 0) + bookingCount;
              return acc;
            }, {} as Record<string, number>);

            return Object.entries(sportCounts).map(([sport, count]) => ({
              sportType: sport,
              count,
            }));
          }),

        // Daily bookings for chart
        this.getDailyBookings(venueId, fromDate, toDate),

        // Cancellation analytics
        this.getCancellationAnalytics(venueId, fromDate, toDate),

        // Top users by booking count
        this.getTopUsers(venueId, fromDate, toDate, 5),

        // Top courts by booking count
        this.getTopCourts(venueId, fromDate, toDate, 5),
      ]);

      // Process and format the data
      const analytics = {
        summary: {
          totalUsers,
          totalVenues,
          totalBookings,
          totalCourts,
          totalRevenue: Number(totalRevenue._sum.totalAmount) || 0,
          uniqueUsers: uniqueUsersCount.length,
          dateRange: { from: fromDate, to: toDate },
        },

        bookings: {
          byStatus: bookingsByStatus.map((item) => ({
            status: item.status,
            count: item._count.id,
          })),
          byPaymentStatus: bookingsByPaymentStatus.map((item) => ({
            status: item.paymentStatus,
            count: item._count.id,
            amount: Number(item._sum.totalAmount) || 0,
          })),
          recent: recentBookings,
          bySport: bookingsBySport,
          daily: dailyBookings,
        },

        revenue: {
          total: Number(totalRevenue._sum.totalAmount) || 0,
          byPaymentMethod: revenueByPaymentMethod.map((item) => ({
            method: item.paymentMethod,
            amount: Number(item._sum.amount) || 0,
            count: item._count.id,
          })),
          monthly: monthlyRevenue,
        },

        users: {
          total: totalUsers,
          unique: uniqueUsersCount.length,
          registrationTrend: userRegistrationTrend,
          top: topUsers,
        },

        courts: {
          total: totalCourts,
          utilization: courtUtilization,
          top: topCourts,
        },

        cancellations: cancellationData,

        performance: {
          topUsers,
          topCourts,
        },
      };

      successResponse(
        res,
        analytics,
        "Dashboard analytics retrieved successfully"
      );
    } catch (error: any) {
      logger.error("Error retrieving dashboard analytics:", error);
      errorResponse(
        res,
        error.message || "Error retrieving dashboard analytics",
        500
      );
    }
  }

  /**
   * Get revenue analytics specifically
   * @route GET /api/admin/dashboard/revenue-analytics
   */
  async getRevenueAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const venueId = req.query.venueId ? Number(req.query.venueId) : undefined;
      const fromDate = req.query.fromDate
        ? new Date(req.query.fromDate as string)
        : new Date(new Date().setDate(new Date().getDate() - 30));
      const toDate = req.query.toDate
        ? new Date(req.query.toDate as string)
        : new Date();
      const groupBy = (req.query.groupBy as string) || "day";

      const revenueData = await this.getRevenueChartData(
        venueId,
        fromDate,
        toDate,
        groupBy
      );

      successResponse(
        res,
        {
          data: revenueData,
          summary: {
            total: revenueData.reduce((sum, item) => sum + item.revenue, 0),
            average:
              revenueData.length > 0
                ? revenueData.reduce((sum, item) => sum + item.revenue, 0) /
                  revenueData.length
                : 0,
            dateRange: { from: fromDate, to: toDate },
            groupBy,
          },
        },
        "Revenue analytics retrieved successfully"
      );
    } catch (error: any) {
      logger.error("Error retrieving revenue analytics:", error);
      errorResponse(
        res,
        error.message || "Error retrieving revenue analytics",
        500
      );
    }
  }

  /**
   * Get booking statistics for a specific period
   * @route GET /api/admin/dashboard/booking-statistics
   */
  async getBookingStatistics(req: Request, res: Response): Promise<void> {
    try {
      const venueId = req.query.venueId ? Number(req.query.venueId) : undefined;
      const fromDate = req.query.fromDate
        ? new Date(req.query.fromDate as string)
        : new Date(new Date().setDate(new Date().getDate() - 30));
      const toDate = req.query.toDate
        ? new Date(req.query.toDate as string)
        : new Date();

      const venueFilter = venueId ? { court: { venueId } } : {};

      const [
        totalBookings,
        confirmedBookings,
        pendingBookings,
        cancelledBookings,
        completedBookings,
        onlineBookings,
        offlineBookings,
        averageBookingValue,
        bookingTrends,
      ] = await Promise.all([
        prisma.booking.count({
          where: {
            ...venueFilter,
            createdAt: { gte: fromDate, lte: toDate },
          },
        }),
        prisma.booking.count({
          where: {
            ...venueFilter,
            status: "CONFIRMED",
            createdAt: { gte: fromDate, lte: toDate },
          },
        }),
        prisma.booking.count({
          where: {
            ...venueFilter,
            status: "PENDING",
            createdAt: { gte: fromDate, lte: toDate },
          },
        }),
        prisma.booking.count({
          where: {
            ...venueFilter,
            status: "CANCELLED",
            createdAt: { gte: fromDate, lte: toDate },
          },
        }),
        prisma.booking.count({
          where: {
            ...venueFilter,
            status: "COMPLETED",
            createdAt: { gte: fromDate, lte: toDate },
          },
        }),
        // Simulate online/offline booking detection
        prisma.booking.count({
          where: {
            ...venueFilter,
            paymentStatus: "PAID",
            createdAt: { gte: fromDate, lte: toDate },
          },
        }),
        prisma.booking.count({
          where: {
            ...venueFilter,
            paymentStatus: { in: ["PENDING", "FAILED"] },
            createdAt: { gte: fromDate, lte: toDate },
          },
        }),
        prisma.booking.aggregate({
          _avg: { totalAmount: true },
          where: {
            ...venueFilter,
            createdAt: { gte: fromDate, lte: toDate },
          },
        }),
        this.getDailyBookings(venueId, fromDate, toDate),
      ]);

      const statistics = {
        total: totalBookings,
        confirmed: confirmedBookings,
        pending: pendingBookings,
        cancelled: cancelledBookings,
        completed: completedBookings,
        online: onlineBookings,
        offline: offlineBookings,
        averageValue: Number(averageBookingValue._avg.totalAmount) || 0,
        trends: bookingTrends,
        dateRange: { from: fromDate, to: toDate },
      };

      successResponse(
        res,
        statistics,
        "Booking statistics retrieved successfully"
      );
    } catch (error: any) {
      logger.error("Error retrieving booking statistics:", error);
      errorResponse(
        res,
        error.message || "Error retrieving booking statistics",
        500
      );
    }
  }

  // Helper methods
  private async getMonthlyRevenue(venueId?: number, months: number = 12) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const bookings = await prisma.booking.findMany({
      where: {
        paymentStatus: "PAID",
        createdAt: { gte: startDate, lte: endDate },
        ...(venueId && { court: { venueId } }),
      },
      select: {
        totalAmount: true,
        createdAt: true,
      },
    });

    const monthlyData = bookings.reduce((acc, booking) => {
      const monthKey = `${booking.createdAt.getFullYear()}-${
        booking.createdAt.getMonth() + 1
      }`;
      if (!acc[monthKey]) {
        acc[monthKey] = {
          month: booking.createdAt.getMonth() + 1,
          year: booking.createdAt.getFullYear(),
          revenue: 0,
          count: 0,
        };
      }
      acc[monthKey].revenue += Number(booking.totalAmount);
      acc[monthKey].count += 1;
      return acc;
    }, {} as Record<string, any>);

    return Object.values(monthlyData).sort((a: any, b: any) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });
  }

  private async getUserRegistrationTrend(months: number = 6) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const users = await prisma.user.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
      select: {
        createdAt: true,
      },
    });

    const monthlyData = users.reduce((acc, user) => {
      const monthKey = `${user.createdAt.getFullYear()}-${
        user.createdAt.getMonth() + 1
      }`;
      if (!acc[monthKey]) {
        acc[monthKey] = {
          month: user.createdAt.getMonth() + 1,
          year: user.createdAt.getFullYear(),
          count: 0,
        };
      }
      acc[monthKey].count += 1;
      return acc;
    }, {} as Record<string, any>);

    return Object.values(monthlyData).sort((a: any, b: any) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });
  }

  private async getCourtUtilization(
    venueId?: number,
    fromDate?: Date,
    toDate?: Date
  ) {
    // Default dates if they are undefined
    const from =
      fromDate || new Date(new Date().setDate(new Date().getDate() - 30));
    const to = toDate || new Date();

    const courts = await prisma.court.findMany({
      where: {
        isActive: true,
        ...(venueId && { venueId }),
      },
      include: {
        bookings: {
          where: {
            createdAt: { gte: from, lte: to },
            status: { in: ["CONFIRMED", "COMPLETED"] },
          },
        },
        timeSlots: {
          where: { isActive: true },
        },
      },
    });

    return courts.map((court) => {
      const totalSlots =
        court.timeSlots.length *
        Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
      const bookedSlots = court.bookings.length;
      const utilization = totalSlots > 0 ? (bookedSlots / totalSlots) * 100 : 0;

      return {
        courtId: court.id,
        courtName: court.name,
        totalSlots,
        bookedSlots,
        utilization: Math.round(utilization * 100) / 100,
      };
    });
  }

  private async getDailyBookings(
    venueId?: number,
    fromDate?: Date,
    toDate?: Date
  ) {
    const bookings = await prisma.booking.findMany({
      where: {
        createdAt: { gte: fromDate, lte: toDate },
        ...(venueId && { court: { venueId } }),
      },
      select: {
        createdAt: true,
        totalAmount: true,
      },
    });

    const dailyData = bookings.reduce((acc, booking) => {
      const dateKey = booking.createdAt.toISOString().split("T")[0];
      if (!acc[dateKey]) {
        acc[dateKey] = {
          date: dateKey,
          count: 0,
          revenue: 0,
        };
      }
      acc[dateKey].count += 1;
      acc[dateKey].revenue += Number(booking.totalAmount);
      return acc;
    }, {} as Record<string, any>);

    return Object.values(dailyData).sort((a: any, b: any) =>
      a.date.localeCompare(b.date)
    );
  }

  private async getCancellationAnalytics(
    venueId?: number,
    fromDate?: Date,
    toDate?: Date
  ) {
    const cancellations = await prisma.booking.findMany({
      where: {
        status: "CANCELLED",
        updatedAt: { gte: fromDate, lte: toDate },
        ...(venueId && { court: { venueId } }),
      },
      include: {
        court: { select: { sportType: true } },
      },
    });

    const totalCancellations = cancellations.length;
    const cancellationsBySport = cancellations.reduce((acc, booking) => {
      const sport = booking.court.sportType;
      acc[sport] = (acc[sport] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const refundAmount = cancellations
      .filter((booking) => booking.paymentStatus === "REFUNDED")
      .reduce((sum, booking) => sum + Number(booking.totalAmount), 0);

    return {
      total: totalCancellations,
      bySport: Object.entries(cancellationsBySport).map(([sport, count]) => ({
        sport,
        count,
      })),
      totalRefunds: refundAmount,
      refundedCount: cancellations.filter((b) => b.paymentStatus === "REFUNDED")
        .length,
    };
  }

  private async getTopUsers(
    venueId?: number,
    fromDate?: Date,
    toDate?: Date,
    limit: number = 5
  ) {
    const userBookings = await prisma.booking.groupBy({
      by: ["userId"],
      _count: { id: true },
      _sum: { totalAmount: true },
      where: {
        createdAt: { gte: fromDate, lte: toDate },
        ...(venueId && { court: { venueId } }),
      },
      orderBy: {
        _count: { id: "desc" },
      },
      take: limit,
    });

    const userIds = userBookings.map((ub) => ub.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    });

    return userBookings.map((ub) => {
      const user = users.find((u) => u.id === ub.userId);
      return {
        user,
        bookingCount: ub._count.id,
        totalSpent: Number(ub._sum.totalAmount) || 0,
      };
    });
  }

  private async getTopCourts(
    venueId?: number,
    fromDate?: Date,
    toDate?: Date,
    limit: number = 5
  ) {
    const courtBookings = await prisma.booking.groupBy({
      by: ["courtId"],
      _count: { id: true },
      _sum: { totalAmount: true },
      where: {
        createdAt: { gte: fromDate, lte: toDate },
        ...(venueId && { court: { venueId } }),
      },
      orderBy: {
        _count: { id: "desc" },
      },
      take: limit,
    });

    const courtIds = courtBookings.map((cb) => cb.courtId);
    const courts = await prisma.court.findMany({
      where: { id: { in: courtIds } },
      select: {
        id: true,
        name: true,
        sportType: true,
        venue: { select: { id: true, name: true } },
      },
    });

    return courtBookings.map((cb) => {
      const court = courts.find((c) => c.id === cb.courtId);
      return {
        court,
        bookingCount: cb._count.id,
        totalRevenue: Number(cb._sum.totalAmount) || 0,
      };
    });
  }

  private async getRevenueChartData(
    venueId?: number,
    fromDate?: Date,
    toDate?: Date,
    groupBy: string = "day"
  ) {
    const bookings = await prisma.booking.findMany({
      where: {
        paymentStatus: "PAID",
        createdAt: { gte: fromDate, lte: toDate },
        ...(venueId && { court: { venueId } }),
      },
      select: {
        totalAmount: true,
        createdAt: true,
      },
    });

    const groupedData = bookings.reduce((acc, booking) => {
      let key: string;
      const date = booking.createdAt;

      switch (groupBy) {
        case "hour":
          key = `${date.toISOString().split("T")[0]} ${date.getHours()}:00`;
          break;
        case "day":
          key = date.toISOString().split("T")[0];
          break;
        case "week":
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split("T")[0];
          break;
        case "month":
          key = `${date.getFullYear()}-${date.getMonth() + 1}`;
          break;
        default:
          key = date.toISOString().split("T")[0];
      }

      if (!acc[key]) {
        acc[key] = {
          date: key,
          revenue: 0,
          bookings: 0,
        };
      }
      acc[key].revenue += Number(booking.totalAmount);
      acc[key].bookings += 1;
      return acc;
    }, {} as Record<string, any>);

    return Object.values(groupedData).sort((a: any, b: any) =>
      a.date.localeCompare(b.date)
    );
  }

  // Keep existing methods for backward compatibility
  async getStats(req: Request, res: Response): Promise<void> {
    // Redirect to the new comprehensive analytics
    req.query.fromDate =
      req.query.fromDate ||
      new Date(new Date().setDate(new Date().getDate() - 30)).toISOString();
    req.query.toDate = req.query.toDate || new Date().toISOString();
    await this.getDashboardAnalytics(req, res);
  }

  async getBookingStats(req: Request, res: Response): Promise<void> {
    await this.getBookingStatistics(req, res);
  }

  async getRevenueStats(req: Request, res: Response): Promise<void> {
    await this.getRevenueAnalytics(req, res);
  }

  async getUserStats(req: Request, res: Response): Promise<void> {
    try {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          createdAt: true,
          role: true,
        },
      });

      const monthlyRegistrations = users.reduce((acc, user) => {
        const date = user.createdAt;
        const monthYear = `${date.getFullYear()}-${date.getMonth() + 1}`;

        if (!acc[monthYear]) {
          acc[monthYear] = {
            month: date.getMonth() + 1,
            year: date.getFullYear(),
            count: 0,
          };
        }

        acc[monthYear].count += 1;
        return acc;
      }, {} as Record<string, { month: number; year: number; count: number }>);

      const roleCountMap = users.reduce((acc, user) => {
        const role = user.role;
        acc[role] = (acc[role] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const usersByRole = Object.entries(roleCountMap).map(([role, count]) => ({
        role,
        count,
      }));

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const bookings = await prisma.booking.findMany({
        where: {
          createdAt: {
            gte: thirtyDaysAgo,
          },
        },
        select: {
          userId: true,
        },
        distinct: ["userId"],
      });

      const activeUserIds = new Set(bookings.map((booking) => booking.userId));

      successResponse(
        res,
        {
          totalUsers: users.length,
          activeUsersLast30Days: activeUserIds.size,
          byRole: usersByRole,
          monthlyRegistrations: Object.values(monthlyRegistrations).sort(
            (a, b) => {
              if (a.year !== b.year) return a.year - b.year;
              return a.month - b.month;
            }
          ),
        },
        "User statistics retrieved successfully"
      );
    } catch (error: any) {
      logger.error("Error retrieving user stats:", error);
      errorResponse(
        res,
        error.message || "Error retrieving user statistics",
        500
      );
    }
  }
}

export default new AdminDashboardController();
