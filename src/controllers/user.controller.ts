import { Request, Response } from 'express';
import userService from '../services/user.service';
import { successResponse, errorResponse } from '../utils/response';
import logger from '../utils/logger';
import { BookingStatus } from '@prisma/client';

/**
 * Controller for user-related endpoints
 */
export class UserController {
  /**
   * Get user profile
   * @route GET /api/users/profile
   */
  async getProfile(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        errorResponse(res, 'Unauthorized', 401);
        return;
      }

      const profile = await userService.getUserProfile(req.user.userId);
      successResponse(res, profile, 'User profile retrieved successfully');
    } catch (error: any) {
      logger.error('Error getting user profile:', error);
      errorResponse(res, error.message, 404);
    }
  }

  /**
   * Update user profile
   * @route PUT /api/users/profile
   */
  async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        errorResponse(res, 'Unauthorized', 401);
        return;
      }

      const { name, phone, gender } = req.body;
      
      const updatedProfile = await userService.updateProfile(req.user.userId, {
        name,
        phone,
        gender
      });

      successResponse(res, updatedProfile, 'Profile updated successfully');
    } catch (error: any) {
      logger.error('Error updating user profile:', error);
      errorResponse(res, error.message, 400);
    }
  }

  /**
   * Get user societies
   * @route GET /api/users/societies
   */
  async getSocieties(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        errorResponse(res, 'Unauthorized', 401);
        return;
      }

      const societies = await userService.getUserSocieties(req.user.userId);
      successResponse(res, societies, 'User societies retrieved successfully');
    } catch (error: any) {
      logger.error('Error getting user societies:', error);
      errorResponse(res, error.message, 400);
    }
  }

  /**
   * Apply for society membership
   * @route POST /api/users/societies
   */
  async applyForSociety(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        errorResponse(res, 'Unauthorized', 401);
        return;
      }

      const { societyId } = req.body;

      if (!societyId || isNaN(Number(societyId))) {
        errorResponse(res, 'Valid society ID is required', 400);
        return;
      }

      const membership = await userService.applyForSociety(
        req.user.userId,
        Number(societyId)
      );

      successResponse(res, membership, 'Society membership application successful');
    } catch (error: any) {
      logger.error('Error applying for society:', error);
      errorResponse(res, error.message, 400);
    }
  }

  /**
   * Get user bookings
   * @route GET /api/users/bookings
   */
  async getBookings(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        errorResponse(res, 'Unauthorized', 401);
        return;
      }

      // Parse filter options from query params
      const status = req.query.status as BookingStatus | undefined;
      const fromDate = req.query.fromDate ? new Date(req.query.fromDate as string) : undefined;
      const toDate = req.query.toDate ? new Date(req.query.toDate as string) : undefined;

      const bookings = await userService.getUserBookings(req.user.userId, {
        status,
        fromDate,
        toDate
      });

      successResponse(res, bookings, 'User bookings retrieved successfully');
    } catch (error: any) {
      logger.error('Error getting user bookings:', error);
      errorResponse(res, error.message, 400);
    }
  }

  /**
   * Get a specific booking by ID
   * @route GET /api/users/bookings/:id
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

      const booking = await userService.getUserBookingById(req.user.userId, bookingId);
      successResponse(res, booking, 'Booking retrieved successfully');
    } catch (error: any) {
      logger.error('Error getting booking by ID:', error);
      errorResponse(res, error.message, error.message.includes('not found') ? 404 : 400);
    }
  }

  /**
   * Cancel a booking
   * @route POST /api/users/bookings/:id/cancel
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

      const cancelledBooking = await userService.cancelBooking(req.user.userId, bookingId);
      successResponse(res, cancelledBooking, 'Booking cancelled successfully');
    } catch (error: any) {
      logger.error('Error cancelling booking:', error);
      errorResponse(res, error.message, error.message.includes('not found') ? 404 : 400);
    }
  }

  /**
   * Get user course enrollments
   * @route GET /api/users/courses
   */
  async getCourseEnrollments(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        errorResponse(res, 'Unauthorized', 401);
        return;
      }

      const enrollments = await userService.getUserCourseEnrollments(req.user.userId);
      successResponse(res, enrollments, 'Course enrollments retrieved successfully');
    } catch (error: any) {
      logger.error('Error getting course enrollments:', error);
      errorResponse(res, error.message, 400);
    }
  }
}

export default new UserController();