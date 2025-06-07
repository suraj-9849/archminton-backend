import { Request, Response } from "express";
import {
  PrismaClient,
  BookingStatus,
  PaymentStatus,
  Role,
  PaymentMethod,
} from "@prisma/client";
import { successResponse, errorResponse } from "../../utils/response";
import logger from "../../utils/logger";
import bookingService from "../../services/booking.service";

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
      const paymentStatus = req.query.paymentStatus as
        | PaymentStatus
        | undefined;
      const venueId = req.query.venueId ? Number(req.query.venueId) : undefined;
      const userId = req.query.userId ? Number(req.query.userId) : undefined;

      let fromDate: Date | undefined;
      let toDate: Date | undefined;

      if (req.query.fromDate) {
        const dateStr = req.query.fromDate as string;
        fromDate = new Date(dateStr + "T00:00:00.000Z");
        if (isNaN(fromDate.getTime())) {
          errorResponse(res, "Invalid fromDate format. Use YYYY-MM-DD", 400);
          return;
        }
      }

      if (req.query.toDate) {
        const dateStr = req.query.toDate as string;
        toDate = new Date(dateStr + "T23:59:59.999Z");
        if (isNaN(toDate.getTime())) {
          errorResponse(res, "Invalid toDate format. Use YYYY-MM-DD", 400);
          return;
        }
      }

      const where: any = {};

      if (status) {
        where.status = status;
      }

      if (paymentStatus) {
        where.paymentStatus = paymentStatus;
      }

      if (venueId) {
        where.court = {
          venueId,
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
                phone: true,
              },
            },
            court: {
              include: {
                venue: {
                  select: {
                    id: true,
                    name: true,
                    location: true,
                  },
                },
              },
            },
            timeSlot: true,
            addOns: true,
            payment: true,
          },
          orderBy: {
            createdAt: "desc",
          },
          skip,
          take: limit,
        }),
        prisma.booking.count({ where }),
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
            hasPrevious: page > 1,
          },
        },
        "Bookings retrieved successfully"
      );
    } catch (error: any) {
      logger.error("Error getting bookings (admin):", error);
      errorResponse(res, error.message || "Error retrieving bookings", 500);
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
        errorResponse(res, "Invalid booking ID", 400);
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
              gender: true,
            },
          },
          court: {
            include: {
              venue: {
                include: {
                  society: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
          timeSlot: true,
          addOns: true,
          payment: true,
        },
      });

      if (!booking) {
        errorResponse(res, "Booking not found", 404);
        return;
      }

      successResponse(res, booking, "Booking details retrieved successfully");
    } catch (error: any) {
      logger.error("Error getting booking details (admin):", error);
      errorResponse(
        res,
        error.message || "Error retrieving booking details",
        500
      );
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
        errorResponse(res, "Invalid booking ID", 400);
        return;
      }

      const { status } = req.body;

      if (!Object.values(BookingStatus).includes(status)) {
        errorResponse(res, "Invalid booking status", 400);
        return;
      }

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
      });

      if (!booking) {
        errorResponse(res, "Booking not found", 404);
        return;
      }

      const updatedBooking = await prisma.booking.update({
        where: { id: bookingId },
        data: { status },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          court: {
            include: {
              venue: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          timeSlot: true,
          payment: true,
        },
      });

      successResponse(
        res,
        updatedBooking,
        "Booking status updated successfully"
      );
    } catch (error: any) {
      logger.error("Error updating booking status (admin):", error);
      errorResponse(res, error.message || "Error updating booking status", 400);
    }
  }

  /**
   * Update payment status
   * @route PATCH /api/admin/bookings/:id/payment-status
   */

  async updatePaymentStatus(req: Request, res: Response): Promise<void> {
    try {
      const bookingId = Number(req.params.id);
      const {
        paymentStatus,
        paidAmount,
        balanceAmount,
        transactionId,
        lastPaymentAmount,
        lastPaymentMethod,
      } = req.body;

      console.log("=== PAYMENT STATUS UPDATE ===");
      console.log("Booking ID:", bookingId);
      console.log("Request Body:", req.body);

      if (!Object.values(PaymentStatus).includes(paymentStatus)) {
        errorResponse(res, "Invalid payment status", 400);
        return;
      }

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { payment: true },
      });

      if (!booking) {
        errorResponse(res, "Booking not found", 404);
        return;
      }

      console.log("Current booking state:", {
        totalAmount: booking.totalAmount,
        paidAmount: booking.paidAmount,
        balanceAmount: booking.balanceAmount,
        paymentStatus: booking.paymentStatus,
      });

      let newPaidAmount = paidAmount;
      let newBalanceAmount = balanceAmount;

      if (newPaidAmount === undefined || newBalanceAmount === undefined) {
        const currentPaid = Number(booking.paidAmount) || 0;
        const total = Number(booking.totalAmount) || 0;
        const additionalPayment = Number(lastPaymentAmount) || 0;

        newPaidAmount = currentPaid + additionalPayment;
        newBalanceAmount = total - newPaidAmount;
      }

      const totalAmount = Number(booking.totalAmount) || 0;
      if (newPaidAmount > totalAmount) {
        newPaidAmount = totalAmount;
        newBalanceAmount = 0;
      }
      if (newBalanceAmount < 0) {
        newBalanceAmount = 0;
      }

      const finalPaymentStatus =
        newBalanceAmount <= 0 ? PaymentStatus.PAID : PaymentStatus.PENDING;

      console.log("Calculated amounts:", {
        newPaidAmount,
        newBalanceAmount,
        finalPaymentStatus,
      });

      const updatedBooking = await prisma.booking.update({
        where: { id: bookingId },
        data: {
          paymentStatus: finalPaymentStatus,
          paidAmount: newPaidAmount,
          balanceAmount: newBalanceAmount,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          court: {
            include: {
              venue: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          payment: true,
        },
      });

      if (lastPaymentAmount && Number(lastPaymentAmount) > 0) {
        console.log("Creating payment record for amount:", lastPaymentAmount);

        const paymentMethodMap: Record<string, PaymentMethod> = {
          Cash: PaymentMethod.CASH,
          Card: PaymentMethod.ONLINE,
          UPI: PaymentMethod.ONLINE,
          "Bank Transfer": PaymentMethod.BANK_TRANSFER,
          Cheque: PaymentMethod.CASH,
          Other: PaymentMethod.CASH,
        };

        const mappedPaymentMethod =
          paymentMethodMap[lastPaymentMethod as string] || PaymentMethod.CASH;

        console.log("Payment method mapping:", {
          original: lastPaymentMethod,
          mapped: mappedPaymentMethod,
        });

        if (booking.payment) {
          await prisma.payment.update({
            where: { id: booking.payment.id },
            data: {
              amount: newPaidAmount,
              status: finalPaymentStatus,
              transactionId: transactionId || `TXN_${Date.now()}`,
            },
          });
          console.log("Updated existing payment record");
        } else {
          await prisma.payment.create({
            data: {
              bookingId,
              amount: Number(lastPaymentAmount),
              paymentMethod: mappedPaymentMethod,
              transactionId: transactionId || `TXN_${Date.now()}`,
              status: PaymentStatus.PAID,
            },
          });
          console.log("Created new payment record");
        }
      }

      console.log("Final booking state:", {
        id: updatedBooking.id,
        paymentStatus: updatedBooking.paymentStatus,
        paidAmount: updatedBooking.paidAmount,
        balanceAmount: updatedBooking.balanceAmount,
      });
      console.log("=== PAYMENT UPDATE COMPLETE ===");

      successResponse(
        res,
        updatedBooking,
        "Payment status updated successfully"
      );
    } catch (error: any) {
      console.error("Error updating payment status:", error);
      logger.error("Error updating payment status (admin):", error);
      errorResponse(res, error.message || "Error updating payment status", 400);
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
        errorResponse(res, "Invalid booking ID", 400);
        return;
      }

      const { reason } = req.body;

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          payment: true,
        },
      });

      if (!booking) {
        errorResponse(res, "Booking not found", 404);
        return;
      }

      if (booking.status === BookingStatus.CANCELLED) {
        errorResponse(res, "Booking is already cancelled", 400);
        return;
      }

      const cancelledBooking = await prisma.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.CANCELLED,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          court: {
            include: {
              venue: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          payment: true,
        },
      });

      if (booking.payment && booking.payment.status === PaymentStatus.PAID) {
        await prisma.payment.update({
          where: { id: booking.payment.id },
          data: { status: PaymentStatus.REFUNDED },
        });

        await prisma.booking.update({
          where: { id: bookingId },
          data: { paymentStatus: PaymentStatus.REFUNDED },
        });
      }

      successResponse(res, cancelledBooking, "Booking cancelled successfully");
    } catch (error: any) {
      logger.error("Error cancelling booking (admin):", error);
      errorResponse(res, error.message || "Error cancelling booking", 400);
    }
  }

  /**
   * Get booking statistics
   * @route GET /api/admin/bookings/statistics
   */
  async getBookingStatistics(req: Request, res: Response): Promise<void> {
    try {
      const fromDate = req.query.fromDate
        ? new Date(req.query.fromDate as string)
        : new Date(new Date().setDate(new Date().getDate() - 30));
      const toDate = req.query.toDate
        ? new Date(req.query.toDate as string)
        : new Date();

      const [
        totalBookings,
        confirmedBookings,
        pendingBookings,
        cancelledBookings,
        completedBookings,
        totalRevenue,
        averageBookingValue,
      ] = await Promise.all([
        prisma.booking.count({
          where: {
            createdAt: { gte: fromDate, lte: toDate },
          },
        }),

        prisma.booking.count({
          where: {
            status: BookingStatus.CONFIRMED,
            createdAt: { gte: fromDate, lte: toDate },
          },
        }),

        prisma.booking.count({
          where: {
            status: BookingStatus.PENDING,
            createdAt: { gte: fromDate, lte: toDate },
          },
        }),

        prisma.booking.count({
          where: {
            status: BookingStatus.CANCELLED,
            createdAt: { gte: fromDate, lte: toDate },
          },
        }),

        prisma.booking.count({
          where: {
            status: BookingStatus.COMPLETED,
            createdAt: { gte: fromDate, lte: toDate },
          },
        }),

        prisma.payment.aggregate({
          _sum: { amount: true },
          where: {
            status: PaymentStatus.PAID,
            createdAt: { gte: fromDate, lte: toDate },
          },
        }),

        prisma.booking.aggregate({
          _avg: { totalAmount: true },
          where: {
            createdAt: { gte: fromDate, lte: toDate },
          },
        }),
      ]);

      const statistics = {
        dateRange: { from: fromDate, to: toDate },
        bookings: {
          total: totalBookings,
          confirmed: confirmedBookings,
          pending: pendingBookings,
          cancelled: cancelledBookings,
          completed: completedBookings,
        },
        revenue: {
          total: totalRevenue._sum.amount || 0,
          average: averageBookingValue._avg.totalAmount || 0,
        },
      };

      successResponse(
        res,
        statistics,
        "Booking statistics retrieved successfully"
      );
    } catch (error: any) {
      logger.error("Error getting booking statistics:", error);
      errorResponse(
        res,
        error.message || "Error retrieving booking statistics",
        500
      );
    }
  }

  /**
   * Check bulk availability
   * @route POST /api/bookings/bulk-availability
   */
  async checkBulkAvailability(req: Request, res: Response): Promise<void> {
    try {
      const { sportType, venueId, courts, fromDate, toDate, days, timeSlots } =
        req.body;

      if (!sportType || !fromDate || !toDate || !days || !timeSlots) {
        errorResponse(
          res,
          "Missing required fields: sportType, fromDate, toDate, days, timeSlots",
          400
        );
        return;
      }

      if (!Array.isArray(days) || days.length === 0) {
        errorResponse(res, "Days must be a non-empty array", 400);
        return;
      }

      if (!Array.isArray(timeSlots) || timeSlots.length === 0) {
        errorResponse(res, "Time slots must be a non-empty array", 400);
        return;
      }

      const parsedFromDate = new Date(fromDate);
      const parsedToDate = new Date(toDate);

      if (isNaN(parsedFromDate.getTime()) || isNaN(parsedToDate.getTime())) {
        errorResponse(res, "Invalid date format. Use YYYY-MM-DD", 400);
        return;
      }

      if (parsedFromDate > parsedToDate) {
        errorResponse(
          res,
          "From date must be before or equal to the to date",
          400
        );
        return;
      }

      const invalidDays = days.filter(
        (day: any) => typeof day !== "number" || day < 0 || day > 6
      );
      if (invalidDays.length > 0) {
        errorResponse(
          res,
          "Days must be integers between 0 (Sunday) and 6 (Saturday)",
          400
        );
        return;
      }

      for (const slot of timeSlots) {
        if (!slot.startTime || !slot.endTime) {
          errorResponse(
            res,
            "Each time slot must have startTime and endTime",
            400
          );
          return;
        }

        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(slot.startTime) || !timeRegex.test(slot.endTime)) {
          errorResponse(res, "Time must be in HH:MM format", 400);
          return;
        }

        if (slot.startTime >= slot.endTime) {
          errorResponse(
            res,
            `Start time (${slot.startTime}) must be before end time (${slot.endTime})`,
            400
          );
          return;
        }
      }

      const result = await bookingService.checkBulkAvailability({
        sportType,
        venueId: venueId ? Number(venueId) : undefined,
        courts: courts ? courts.map((id: any) => Number(id)) : undefined,
        fromDate,
        toDate,
        days,
        timeSlots,
      });

      successResponse(res, result, "Bulk availability check completed");
    } catch (error: any) {
      logger.error("Error in bulk availability check:", error);
      errorResponse(res, error.message, 400);
    }
  }

  /**
   * Create booking (admin)
   * @route POST /api/admin/bookings
   */
  /**
   * Create booking (admin)
   * @route POST /api/admin/bookings
   */
  async createBooking(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        errorResponse(res, "Unauthorized", 401);
        return;
      }

      const { courtId, timeSlotId, bookingDate, userId, addOns } = req.body;

      if (!courtId || !timeSlotId || !bookingDate) {
        errorResponse(
          res,
          "Missing required fields: courtId, timeSlotId, bookingDate",
          400
        );
        return;
      }

      let targetUserId = userId;

      if (!targetUserId) {
        targetUserId = req.user.userId;

        if (!targetUserId) {
          errorResponse(res, "User ID is required", 400);
          return;
        }
      }

      const bookingData = {
        courtId: Number(courtId),
        timeSlotId: Number(timeSlotId),
        bookingDate: new Date(bookingDate),
        addOns: addOns || [],
      };

      console.log("Creating booking with:", { targetUserId, bookingData });

      const booking = await bookingService.createBooking(
        targetUserId,
        bookingData
      );

      successResponse(res, booking, "Booking created successfully", 201);
    } catch (error: any) {
      logger.error("Error creating booking (admin):", error);
      errorResponse(res, error.message || "Error creating booking", 400);
    }
  }

  /**
   * Create bulk booking (Admin only)
   * @route POST /api/admin/bookings/bulk
   */
  async createBulkBooking(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        errorResponse(res, "Unauthorized", 401);
        return;
      }

      if (
        req.user.role !== Role.ADMIN &&
        req.user.role !== Role.SUPERADMIN &&
        req.user.role !== Role.VENUE_MANAGER
      ) {
        errorResponse(
          res,
          "You are not authorized to create bulk bookings",
          403
        );
        return;
      }

      const {
        sportType,
        venueId,
        courts,
        fromDate,
        toDate,
        days,
        timeSlots,
        ignoreUnavailable,
        userId,
      } = req.body;

      if (!sportType || !fromDate || !toDate || !days || !timeSlots) {
        errorResponse(
          res,
          "Missing required fields: sportType, fromDate, toDate, days, timeSlots",
          400
        );
        return;
      }

      if (!Array.isArray(days) || days.length === 0) {
        errorResponse(res, "Days must be a non-empty array", 400);
        return;
      }

      if (!Array.isArray(timeSlots) || timeSlots.length === 0) {
        errorResponse(res, "Time slots must be a non-empty array", 400);
        return;
      }

      const parsedFromDate = new Date(fromDate);
      const parsedToDate = new Date(toDate);

      if (isNaN(parsedFromDate.getTime()) || isNaN(parsedToDate.getTime())) {
        errorResponse(res, "Invalid date format. Use YYYY-MM-DD", 400);
        return;
      }

      if (parsedFromDate > parsedToDate) {
        errorResponse(
          res,
          "From date must be before or equal to the to date",
          400
        );
        return;
      }

      const invalidDays = days.filter(
        (day: any) => typeof day !== "number" || day < 0 || day > 6
      );
      if (invalidDays.length > 0) {
        errorResponse(
          res,
          "Days must be integers between 0 (Sunday) and 6 (Saturday)",
          400
        );
        return;
      }

      for (const slot of timeSlots) {
        if (!slot.startTime || !slot.endTime) {
          errorResponse(
            res,
            "Each time slot must have startTime and endTime",
            400
          );
          return;
        }

        const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(slot.startTime) || !timeRegex.test(slot.endTime)) {
          errorResponse(res, "Time must be in HH:MM format", 400);
          return;
        }

        if (slot.startTime >= slot.endTime) {
          errorResponse(
            res,
            `Start time (${slot.startTime}) must be before end time (${slot.endTime})`,
            400
          );
          return;
        }
      }

      if (courts && Array.isArray(courts)) {
        const invalidCourts = courts.filter(
          (courtId: any) =>
            !Number.isInteger(Number(courtId)) || Number(courtId) <= 0
        );
        if (invalidCourts.length > 0) {
          errorResponse(res, "All court IDs must be positive integers", 400);
          return;
        }
      }

      if (
        venueId &&
        (!Number.isInteger(Number(venueId)) || Number(venueId) <= 0)
      ) {
        errorResponse(res, "Venue ID must be a positive integer", 400);
        return;
      }

      if (
        userId &&
        (!Number.isInteger(Number(userId)) || Number(userId) <= 0)
      ) {
        errorResponse(res, "User ID must be a positive integer", 400);
        return;
      }

      const targetUserId = userId || req.user.userId;

      const daysDifference = Math.ceil(
        (parsedToDate.getTime() - parsedFromDate.getTime()) /
          (1000 * 60 * 60 * 24)
      );
      if (daysDifference > 90) {
        errorResponse(res, "Date range cannot exceed 90 days", 400);
        return;
      }

      const estimatedBookings =
        daysDifference *
        days.length *
        timeSlots.length *
        (courts?.length || 10);
      if (estimatedBookings > 1000) {
        errorResponse(
          res,
          `This operation would create approximately ${estimatedBookings} bookings. Please reduce the scope or contact system administrator.`,
          400
        );
        return;
      }

      const result = await bookingService.createBulkBooking(targetUserId, {
        sportType,
        venueId: venueId ? Number(venueId) : undefined,
        courts: courts ? courts.map((id: any) => Number(id)) : undefined,
        fromDate,
        toDate,
        days,
        timeSlots,
        ignoreUnavailable: ignoreUnavailable || false,
        userId: targetUserId,
      });

      successResponse(res, result, result.message, 201);
    } catch (error: any) {
      logger.error("Error creating bulk booking:", error);
      errorResponse(res, error.message, 400);
    }
  }
}

export default new AdminBookingController();
