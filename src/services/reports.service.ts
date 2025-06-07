
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface ReportFilters {
  fromDate: string;
  toDate: string;
  venueId?: number;
  period?: 'Range' | 'Single Day' | 'This Week' | 'This Month' | 'Last Month';
  dateRangeFor?: 'Transaction Date' | 'Booking Date' | 'Created Date';
  handler?: string;
  show?: 'All' | 'Bookings Only' | 'Payments Only' | 'Refunds Only';
  page?: number;
  limit?: number;
}

export interface ReportSummary {
  totalRecords: number;
  totalAmount?: number;
  dateRange: {
    from: string;
    to: string;
  };
  generatedAt: string;
  filters: ReportFilters;
}

export interface ReportResponse<T> {
  data: T[];
  summary: ReportSummary;
  pagination?: {
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

export class ReportsService {
  // Helper method to get date range
  private getDateRange(filters: ReportFilters) {
    const fromDate = new Date(filters.fromDate);
    fromDate.setHours(0, 0, 0, 0);
    
    const toDate = new Date(filters.toDate);
    toDate.setHours(23, 59, 59, 999);
    
    return { fromDate, toDate };
  }

  // Helper method to create pagination
  private createPagination(page: number, limit: number, totalRecords: number) {
    const totalPages = Math.ceil(totalRecords / limit);
    return {
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    };
  }

  // Get available handlers for filtering
  async getHandlers(venueId?: number): Promise<string[]> {
    const handlers = ['All', 'System', 'Manual', 'API', 'Mobile App', 'Web Portal'];
    return handlers;
  }

  // Get report statistics
  async getReportStats(venueId?: number) {
    const whereClause = venueId ? { court: { venueId } } : {};

    const [totalBookings, totalRevenue, totalCancellations, totalMembers] = await Promise.all([
      // Total bookings
      prisma.booking.count({
        where: whereClause,
      }),

      // Total revenue (sum of paid bookings)
      prisma.booking.aggregate({
        where: {
          ...whereClause,
          paymentStatus: 'PAID',
        },
        _sum: {
          totalAmount: true,
        },
      }),

      // Total cancellations
      prisma.booking.count({
        where: {
          ...whereClause,
          status: 'CANCELLED',
        },
      }),

      // Total unique members who made bookings
      prisma.booking.groupBy({
        by: ['userId'],
        where: whereClause,
      }),
    ]);

    return {
      totalBookings,
      totalRevenue: Number(totalRevenue._sum.totalAmount) || 0,
      totalCancellations,
      totalMembers: totalMembers.length,
    };
  }

  // Master Report - All transactions
  async getMasterReport(filters: ReportFilters): Promise<ReportResponse<any>> {
    const { fromDate, toDate } = this.getDateRange(filters);
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    const whereClause: any = {
      createdAt: {
        gte: fromDate,
        lte: toDate,
      },
    };

    if (filters.venueId) {
      whereClause.court = { venueId: filters.venueId };
    }

    if (filters.show && filters.show !== 'All') {
      switch (filters.show) {
        case 'Bookings Only':
          whereClause.status = 'CONFIRMED';
          break;
        case 'Payments Only':
          whereClause.paymentStatus = 'PAID';
          break;
        case 'Refunds Only':
          whereClause.paymentStatus = 'REFUNDED';
          break;
      }
    }

    const [bookings, totalCount] = await Promise.all([
      prisma.booking.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          court: {
            select: {
              id: true,
              name: true,
              sportType: true,
            },
          },
          payment: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.booking.count({ where: whereClause }),
    ]);

    const masterData = bookings.map((booking) => ({
      id: booking.id,
      transactionId: `TXN-${booking.id.toString().padStart(6, '0')}`,
      type: booking.paymentStatus === 'PAID' ? 'PAYMENT' : 
            booking.paymentStatus === 'REFUNDED' ? 'REFUND' : 'BOOKING',
      amount: Number(booking.totalAmount),
      date: booking.createdAt.toISOString(),
      handler: 'System',
      member: {
        id: booking.user.id,
        name: booking.user.name,
        email: booking.user.email,
      },
      booking: {
        id: booking.id,
        courtName: booking.court.name,
        date: booking.bookingDate.toISOString().split('T')[0],
        timeSlot: `${booking.startTime} - ${booking.endTime}`,
      },
      paymentMethod: booking.payment?.paymentMethod || 'ONLINE',
      status: booking.paymentStatus === 'PAID' ? 'SUCCESS' : 
              booking.status === 'CANCELLED' ? 'CANCELLED' : 'PENDING',
    }));

    const totalAmount = masterData.reduce((sum, item) => sum + item.amount, 0);

    const summary: ReportSummary = {
      totalRecords: totalCount,
      totalAmount,
      dateRange: {
        from: filters.fromDate,
        to: filters.toDate,
      },
      generatedAt: new Date().toISOString(),
      filters,
    };

    return {
      data: masterData,
      summary,
      pagination: this.createPagination(page, limit, totalCount),
    };
  }

  // Booking Report
  async getBookingReport(filters: ReportFilters): Promise<ReportResponse<any>> {
    const { fromDate, toDate } = this.getDateRange(filters);
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    const whereClause: any = {
      bookingDate: {
        gte: fromDate,
        lte: toDate,
      },
    };

    if (filters.venueId) {
      whereClause.court = { venueId: filters.venueId };
    }

    try {
      const [bookings, totalCount] = await Promise.all([
        prisma.booking.findMany({
          where: whereClause,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              },
            },
            court: {
              select: {
                id: true,
                name: true,
                sportType: true,
              },
            },
            addOns: true,
          },
          orderBy: {
            bookingDate: 'desc',
          },
          skip,
          take: limit,
        }),
        prisma.booking.count({ where: whereClause }),
      ]);

      const bookingData = bookings.map((booking) => ({
        id: booking.id,
        bookingId: `BKG-${booking.id.toString().padStart(6, '0')}`,
        member: {
          id: booking.user.id,
          name: booking.user.name,
          email: booking.user.email,
          phone: booking.user.phone,
        },
        court: {
          id: booking.court.id,
          name: booking.court.name,
          sportType: booking.court.sportType,
        },
        date: booking.bookingDate.toISOString(),
        timeSlot: `${booking.startTime} - ${booking.endTime}`,
        duration: this.calculateDuration(booking.startTime, booking.endTime),
        amount: Number(booking.totalAmount),
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        createdAt: booking.createdAt.toISOString(),
        handler: 'System',
        addOns: booking.addOns.map(addon => ({
          name: addon.addOnType,
          quantity: addon.quantity,
          price: Number(addon.price),
        })),
      }));

      const totalAmount = bookingData.reduce((sum, item) => sum + item.amount, 0);

      const summary: ReportSummary = {
        totalRecords: totalCount,
        totalAmount,
        dateRange: {
          from: filters.fromDate,
          to: filters.toDate,
        },
        generatedAt: new Date().toISOString(),
        filters,
      };

      return {
        data: bookingData,
        summary,
        pagination: this.createPagination(page, limit, totalCount),
      };
    } catch (error) {
      console.error('Error in getBookingReport:', error);
      // Return empty result instead of throwing
      return {
        data: [],
        summary: {
          totalRecords: 0,
          totalAmount: 0,
          dateRange: {
            from: filters.fromDate,
            to: filters.toDate,
          },
          generatedAt: new Date().toISOString(),
          filters,
        },
        pagination: this.createPagination(page, limit, 0),
      };
    }
  }

  // Balance Report
  async getBalanceReport(filters: ReportFilters): Promise<ReportResponse<any>> {
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    const whereClause: any = {};
    if (filters.venueId) {
      whereClause.bookings = {
        some: {
          court: {
            venueId: filters.venueId,
          },
        },
      };
    }

    const [users, totalCount] = await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        include: {
          bookings: {
            where: filters.venueId ? {
              court: {
                venueId: filters.venueId,
              },
            } : undefined,
            include: {
              payment: true,
            },
          },
        },
        skip,
        take: limit,
      }),
      prisma.user.count({ where: whereClause }),
    ]);

    const balanceData = users.map((user) => {
      const totalSpent = user.bookings
        .filter(b => b.paymentStatus === 'PAID')
        .reduce((sum, b) => sum + Number(b.totalAmount), 0);

      const totalRecharges = totalSpent;
      const creditBalance = 0;

      return {
        memberId: user.id,
        memberName: user.name,
        memberEmail: user.email,
        creditBalance,
        totalRecharges,
        totalSpent,
        lastActivity: user.bookings.length > 0 
          ? user.bookings[0].createdAt.toISOString()
          : user.createdAt.toISOString(),
        accountStatus: 'ACTIVE' as const,
      };
    });

    const summary: ReportSummary = {
      totalRecords: totalCount,
      dateRange: {
        from: filters.fromDate,
        to: filters.toDate,
      },
      generatedAt: new Date().toISOString(),
      filters,
    };

    return {
      data: balanceData,
      summary,
      pagination: this.createPagination(page, limit, totalCount),
    };
  }

  // Cancellation Report
  async getCancellationReport(filters: ReportFilters): Promise<ReportResponse<any>> {
    const { fromDate, toDate } = this.getDateRange(filters);
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    const whereClause: any = {
      status: 'CANCELLED',
      updatedAt: {
        gte: fromDate,
        lte: toDate,
      },
    };

    if (filters.venueId) {
      whereClause.court = { venueId: filters.venueId };
    }

    const [bookings, totalCount] = await Promise.all([
      prisma.booking.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          court: {
            select: {
              id: true,
              name: true,
              sportType: true,
            },
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.booking.count({ where: whereClause }),
    ]);

    const cancellationData = bookings.map((booking) => ({
      id: booking.id,
      bookingId: `BKG-${booking.id.toString().padStart(6, '0')}`,
      member: {
        id: booking.user.id,
        name: booking.user.name,
        email: booking.user.email,
      },
      court: {
        id: booking.court.id,
        name: booking.court.name,
        sportType: booking.court.sportType,
      },
      originalBookingDate: booking.bookingDate.toISOString(),
      originalTimeSlot: `${booking.startTime} - ${booking.endTime}`,
      cancellationDate: booking.updatedAt.toISOString(),
      cancellationReason: 'User cancelled',
      refundAmount: booking.paymentStatus === 'REFUNDED' ? Number(booking.totalAmount) : 0,
      refundStatus: booking.paymentStatus === 'REFUNDED' ? 'PROCESSED' : 'PENDING',
      handler: 'System',
    }));

    const totalAmount = cancellationData.reduce((sum, item) => sum + item.refundAmount, 0);

    const summary: ReportSummary = {
      totalRecords: totalCount,
      totalAmount,
      dateRange: {
        from: filters.fromDate,
        to: filters.toDate,
      },
      generatedAt: new Date().toISOString(),
      filters,
    };

    return {
      data: cancellationData,
      summary,
      pagination: this.createPagination(page, limit, totalCount),
    };
  }

  // Recharge Report
  async getRechargeReport(filters: ReportFilters): Promise<ReportResponse<any>> {
    const { fromDate, toDate } = this.getDateRange(filters);
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    const whereClause: any = {
      status: 'PAID',
      createdAt: {
        gte: fromDate,
        lte: toDate,
      },
    };

    if (filters.venueId) {
      whereClause.booking = {
        court: {
          venueId: filters.venueId,
        },
      };
    }

    const [payments, totalCount] = await Promise.all([
      prisma.payment.findMany({
        where: whereClause,
        include: {
          booking: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.payment.count({ where: whereClause }),
    ]);

    const rechargeData = payments.map((payment) => ({
      id: payment.id,
      transactionId: payment.transactionId || `TXN-${payment.id.toString().padStart(6, '0')}`,
      member: {
        id: payment.booking.user.id,
        name: payment.booking.user.name,
        email: payment.booking.user.email,
      },
      amount: Number(payment.amount),
      paymentMethod: payment.paymentMethod,
      transactionDate: payment.createdAt.toISOString(),
      status: payment.status === 'PAID' ? 'SUCCESS' : payment.status,
      gatewayTransactionId: payment.transactionId,
      handler: 'System',
    }));

    const totalAmount = rechargeData.reduce((sum, item) => sum + item.amount, 0);

    const summary: ReportSummary = {
      totalRecords: totalCount,
      totalAmount,
      dateRange: {
        from: filters.fromDate,
        to: filters.toDate,
      },
      generatedAt: new Date().toISOString(),
      filters,
    };

    return {
      data: rechargeData,
      summary,
      pagination: this.createPagination(page, limit, totalCount),
    };
  }

  // Credits Report
  async getCreditsReport(filters: ReportFilters): Promise<ReportResponse<any>> {
    const { fromDate, toDate } = this.getDateRange(filters);
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    const whereClause: any = {
      createdAt: {
        gte: fromDate,
        lte: toDate,
      },
    };

    if (filters.venueId) {
      whereClause.court = { venueId: filters.venueId };
    }

    const [bookings, totalCount] = await Promise.all([
      prisma.booking.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.booking.count({ where: whereClause }),
    ]);

    const creditsData = bookings.map((booking) => ({
      id: booking.id,
      member: {
        id: booking.user.id,
        name: booking.user.name,
        email: booking.user.email,
      },
      transactionType: booking.paymentStatus === 'PAID' ? 'DEBIT' : 'CREDIT',
      amount: Number(booking.totalAmount),
      description: `Booking for ${booking.startTime} - ${booking.endTime}`,
      balanceBefore: 1000,
      balanceAfter: booking.paymentStatus === 'PAID' ? 1000 - Number(booking.totalAmount) : 1000,
      date: booking.createdAt.toISOString(),
      relatedBookingId: booking.id,
    }));

    const summary: ReportSummary = {
      totalRecords: totalCount,
      dateRange: {
        from: filters.fromDate,
        to: filters.toDate,
      },
      generatedAt: new Date().toISOString(),
      filters,
    };

    return {
      data: creditsData,
      summary,
      pagination: this.createPagination(page, limit, totalCount),
    };
  }

  // Add-on Report
  async getAddonReport(filters: ReportFilters): Promise<ReportResponse<any>> {
    const { fromDate, toDate } = this.getDateRange(filters);
    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const skip = (page - 1) * limit;

    const whereClause: any = {
      booking: {
        bookingDate: {
          gte: fromDate,
          lte: toDate,
        },
      },
    };

    if (filters.venueId) {
      whereClause.booking.court = { venueId: filters.venueId };
    }

    const [addOns, totalCount] = await Promise.all([
      prisma.bookingAddOn.findMany({
        where: whereClause,
        include: {
          booking: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
              court: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          id: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.bookingAddOn.count({ where: whereClause }),
    ]);

    const addonData = addOns.reduce((acc: any[], addon) => {
      const existingBooking = acc.find(item => item.bookingId === `BKG-${addon.booking.id.toString().padStart(6, '0')}`);
      
      if (existingBooking) {
        existingBooking.addOns.push({
          id: addon.id,
          name: addon.addOnType,
          quantity: addon.quantity,
          unitPrice: Number(addon.price),
          totalPrice: Number(addon.price) * addon.quantity,
        });
        existingBooking.totalAddonAmount += Number(addon.price) * addon.quantity;
      } else {
        acc.push({
          id: addon.id,
          bookingId: `BKG-${addon.booking.id.toString().padStart(6, '0')}`,
          member: {
            id: addon.booking.user.id,
            name: addon.booking.user.name,
            email: addon.booking.user.email,
          },
          court: {
            id: addon.booking.court.id,
            name: addon.booking.court.name,
          },
          bookingDate: addon.booking.bookingDate.toISOString(),
          addOns: [{
            id: addon.id,
            name: addon.addOnType,
            quantity: addon.quantity,
            unitPrice: Number(addon.price),
            totalPrice: Number(addon.price) * addon.quantity,
          }],
          totalAddonAmount: Number(addon.price) * addon.quantity,
          handler: 'System',
        });
      }
      
      return acc;
    }, []);

    const totalAmount = addonData.reduce((sum, item) => sum + item.totalAddonAmount, 0);

    const summary: ReportSummary = {
      totalRecords: totalCount,
      totalAmount,
      dateRange: {
        from: filters.fromDate,
        to: filters.toDate,
      },
      generatedAt: new Date().toISOString(),
      filters,
    };

    return {
      data: addonData,
      summary,
      pagination: this.createPagination(page, limit, totalCount),
    };
  }

  // Helper method to calculate duration
  private calculateDuration(startTime: string, endTime: string): number {
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    return (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  }

  // Generate CSV data for downloads
  generateCSV(data: any[], reportType: string): string {
    if (data.length === 0) return '';

    const headers = this.getCSVHeaders(reportType);
    const csvData = [headers];

    data.forEach(item => {
      const row = this.transformToCSVRow(item, reportType);
      csvData.push(row);
    });

    return csvData.map(row => 
      row.map(field => `"${field}"`).join(',')
    ).join('\n');
  }

  private getCSVHeaders(reportType: string): string[] {
    switch (reportType) {
      case 'master':
        return ['Transaction ID', 'Type', 'Member Name', 'Member Email', 'Amount', 'Date', 'Status'];
      case 'booking':
        return ['Booking ID', 'Member Name', 'Court Name', 'Date', 'Time Slot', 'Amount', 'Status', 'Payment Status'];
      case 'balance':
        return ['Member Name', 'Email', 'Credit Balance', 'Total Recharges', 'Total Spent', 'Last Activity'];
      case 'cancellation':
        return ['Booking ID', 'Member Name', 'Court Name', 'Original Date', 'Cancellation Date', 'Refund Amount'];
      case 'recharge':
        return ['Transaction ID', 'Member Name', 'Amount', 'Payment Method', 'Date', 'Status'];
      case 'credits':
        return ['Member Name', 'Transaction Type', 'Amount', 'Description', 'Date'];
      case 'addon':
        return ['Booking ID', 'Member Name', 'Court Name', 'Add-ons', 'Total Amount', 'Date'];
      default:
        return [];
    }
  }

  private transformToCSVRow(item: any, reportType: string): string[] {
    switch (reportType) {
      case 'master':
        return [
          item.transactionId,
          item.type,
          item.member.name,
          item.member.email,
          item.amount.toString(),
          new Date(item.date).toLocaleDateString(),
          item.status
        ];
      case 'booking':
        return [
          item.bookingId,
          item.member.name,
          item.court.name,
          new Date(item.date).toLocaleDateString(),
          item.timeSlot,
          item.amount.toString(),
          item.status,
          item.paymentStatus
        ];
      case 'balance':
        return [
          item.memberName,
          item.memberEmail,
          item.creditBalance.toString(),
          item.totalRecharges.toString(),
          item.totalSpent.toString(),
          new Date(item.lastActivity).toLocaleDateString()
        ];
      case 'cancellation':
        return [
          item.bookingId,
          item.member.name,
          item.court.name,
          new Date(item.originalBookingDate).toLocaleDateString(),
          new Date(item.cancellationDate).toLocaleDateString(),
          item.refundAmount.toString()
        ];
      case 'recharge':
        return [
          item.transactionId,
          item.member.name,
          item.amount.toString(),
          item.paymentMethod,
          new Date(item.transactionDate).toLocaleDateString(),
          item.status
        ];
      case 'credits':
        return [
          item.member.name,
          item.transactionType,
          item.amount.toString(),
          item.description,
          new Date(item.date).toLocaleDateString()
        ];
      case 'addon':
        return [
          item.bookingId,
          item.member.name,
          item.court.name,
          item.addOns.map((a: any) => `${a.name} x ${a.quantity}`).join(', '),
          item.totalAddonAmount.toString(),
          new Date(item.bookingDate).toLocaleDateString()
        ];
      default:
        return [];
    }
  }
}

export const reportsService = new ReportsService();