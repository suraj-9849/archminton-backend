import { Request, Response } from 'express';
import bookingService from '../services/booking.service';
import { successResponse, errorResponse } from '../utils/response';
import logger from '../utils/logger';
import { BookingStatus, PaymentMethod, Role } from '@prisma/client';

/**
 * Controller for booking-related endpoints
 */
export class BookingController {
  /**
   * Create a new booking
   * @route POST /api/bookings
   */
  async createBooking(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        errorResponse(res, 'Unauthorized', 401);
        return;
      }

      const { courtId, timeSlotId, bookingDate, addOns } = req.body;

      // Validate required fields
      if (!courtId || !timeSlotId || !bookingDate) {
        errorResponse(res, 'Court ID, time slot ID, and booking date are required', 400);
        return;
      }

      // Parse booking date
      const parsedDate = new Date(bookingDate);
      if (isNaN(parsedDate.getTime())) {
        errorResponse(res, 'Invalid booking date format', 400);
        return;
      }

      // Create booking
      const booking = await bookingService.createBooking(req.user.userId, {
        courtId: Number(courtId),
        timeSlotId: Number(timeSlotId),
        bookingDate: parsedDate,
        addOns
      });

      successResponse(res, booking, 'Booking created successfully', 201);
    } catch (error: any) {
      logger.error('Error creating booking:', error);
      errorResponse(res, error.message, 400);
    }
  }

  /**
   * Process payment for a booking
   * @route POST /api/bookings/:id/payment
   */
  async processPayment(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        errorResponse(res, 'Unauthorized', 401);
        return;
      }

      const bookingId = Number(req.params.id);
      
      if (isNaN(bookingId)) {
        errorResponse(res, 'Invalid booking ID', 400);
        return;
      }

      const { amount, paymentMethod, transactionId } = req.body;

      if (!amount || !paymentMethod) {
        errorResponse(res, 'Amount and payment method are required', 400);
        return;
      }

      // Check if payment method is valid
      if (!Object.values(PaymentMethod).includes(paymentMethod)) {
        errorResponse(res, 'Invalid payment method', 400);
        return;
      }

      const result = await bookingService.processPayment(bookingId, {
        bookingId,
        amount: Number(amount),
        paymentMethod,
        transactionId
      });

      successResponse(res, result, 'Payment processed successfully');
    } catch (error: any) {
      logger.error('Error processing payment:', error);
      errorResponse(res, error.message, 400);
    }
  }

  /**
   * Get booking availability for a court on a specific date
   * @route GET /api/bookings/availability
   */
  async getAvailability(req: Request, res: Response): Promise<void> {
    try {
      const { courtId, date } = req.query;

      if (!courtId || !date) {
        errorResponse(res, 'Court ID and date are required', 400);
        return;
      }

      const parsedDate = new Date(date as string);
      if (isNaN(parsedDate.getTime())) {
        errorResponse(res, 'Invalid date format', 400);
        return;
      }

      const availability = await bookingService.getCourtAvailability(
        Number(courtId),
        parsedDate
      );

      successResponse(res, availability, 'Availability retrieved successfully');
    } catch (error: any) {
      logger.error('Error getting availability:', error);
      errorResponse(res, error.message, 400);
    }
  }

  /**
   * Cancel a booking
   * @route POST /api/bookings/:id/cancel
   */
  async cancelBooking(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        errorResponse(res, 'Unauthorized', 401);
        return;
      }

      const bookingId = Number(req.params.id);
      
      if (isNaN(bookingId)) {
        errorResponse(res, 'Invalid booking ID', 400);
        return;
      }

      // Check if user is admin (admins can cancel any booking)
      const isAdmin = req.user.role === Role.ADMIN || req.user.role === Role.SUPERADMIN;

      const cancelledBooking = await bookingService.cancelBooking(
        bookingId,
        req.user.userId,
        isAdmin
      );

      successResponse(res, cancelledBooking, 'Booking cancelled successfully');
    } catch (error: any) {
      logger.error('Error cancelling booking:', error);
      errorResponse(res, error.message, 400);
    }
  }

  /**
   * Get booking by ID
   * @route GET /api/bookings/:id
   */
  async getBookingById(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        errorResponse(res, 'Unauthorized', 401);
        return;
      }

      const bookingId = Number(req.params.id);
      
      if (isNaN(bookingId)) {
        errorResponse(res, 'Invalid booking ID', 400);
        return;
      }

      const booking = await bookingService.getBookingById(bookingId);

      // Only the booking owner or admin/venue manager can view bookings
      const isAdmin = req.user.role === Role.ADMIN || 
                      req.user.role === Role.SUPERADMIN || 
                      req.user.role === Role.VENUE_MANAGER;
                      
      if (!isAdmin && booking.userId !== req.user.userId) {
        errorResponse(res, 'You are not authorized to view this booking', 403);
        return;
      }

      successResponse(res, booking, 'Booking retrieved successfully');
    } catch (error: any) {
      logger.error('Error getting booking by ID:', error);
      errorResponse(res, error.message, error.message.includes('not found') ? 404 : 400);
    }
  }

  /**
   * Update booking status (admin only)
   * @route PATCH /api/bookings/:id/status
   */
  async updateBookingStatus(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        errorResponse(res, 'Unauthorized', 401);
        return;
      }

      // Only admins or venue managers can update booking status
      if (
        req.user.role !== Role.ADMIN && 
        req.user.role !== Role.SUPERADMIN &&
        req.user.role !== Role.VENUE_MANAGER
      ) {
        errorResponse(res, 'You are not authorized to update booking status', 403);
        return;
      }

      const bookingId = Number(req.params.id);
      
      if (isNaN(bookingId)) {
        errorResponse(res, 'Invalid booking ID', 400);
        return;
      }

      const { status } = req.body;

      if (!status || !Object.values(BookingStatus).includes(status)) {
        errorResponse(res, 'Valid booking status is required', 400);
        return;
      }

      const updatedBooking = await bookingService.updateBookingStatus(bookingId, status);
      successResponse(res, updatedBooking, 'Booking status updated successfully');
    } catch (error: any) {
      logger.error('Error updating booking status:', error);
      errorResponse(res, error.message, error.message.includes('not found') ? 404 : 400);
    }
  }
}

export default new BookingController();