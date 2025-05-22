import express from 'express';
import { body, param, query } from 'express-validator';
import adminBookingController from '../../controllers/admin/booking.controller';
import { authenticate, adminOnly } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { BookingStatus, PaymentStatus } from '@prisma/client';

const router = express.Router();

// All routes require authentication and admin access
router.use(authenticate);
router.use(adminOnly);

// Get booking statistics
const getStatisticsValidation = [
  query('fromDate')
    .optional()
    .isISO8601()
    .withMessage('From date must be a valid ISO date'),
  query('toDate')
    .optional()
    .isISO8601()
    .withMessage('To date must be a valid ISO date')
];

router.get('/statistics', validate(getStatisticsValidation), adminBookingController.getBookingStatistics);

// Get all bookings
const getBookingsValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('status')
    .optional()
    .isIn(Object.values(BookingStatus))
    .withMessage('Invalid booking status'),
  query('paymentStatus')
    .optional()
    .isIn(Object.values(PaymentStatus))
    .withMessage('Invalid payment status'),
  query('venueId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Venue ID must be a positive integer'),
  query('userId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('User ID must be a positive integer'),
  query('fromDate')
    .optional()
    .isISO8601()
    .withMessage('From date must be a valid ISO date'),
  query('toDate')
    .optional()
    .isISO8601()
    .withMessage('To date must be a valid ISO date')
];

router.get('/', validate(getBookingsValidation), adminBookingController.getAllBookings);

// Get booking by ID
const bookingIdValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Booking ID must be a positive integer')
];

router.get('/:id', validate(bookingIdValidation), adminBookingController.getBookingById);

// Update booking status
const updateStatusValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Booking ID must be a positive integer'),
  body('status')
    .isIn(Object.values(BookingStatus))
    .withMessage('Valid booking status is required')
];

router.patch('/:id/status', validate(updateStatusValidation), adminBookingController.updateBookingStatus);

// Update payment status
const updatePaymentStatusValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Booking ID must be a positive integer'),
  body('paymentStatus')
    .isIn(Object.values(PaymentStatus))
    .withMessage('Valid payment status is required')
];

router.patch('/:id/payment-status', validate(updatePaymentStatusValidation), adminBookingController.updatePaymentStatus);

// Cancel booking
const cancelBookingValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Booking ID must be a positive integer'),
  body('reason')
    .optional()
    .isString()
    .withMessage('Reason must be a string')
];

router.post('/:id/cancel', validate(cancelBookingValidation), adminBookingController.cancelBooking);

export default router;