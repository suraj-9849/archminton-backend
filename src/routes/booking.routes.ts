import express from 'express';
import { body, param, query } from 'express-validator';
import bookingController from '../controllers/booking.controller';
import { authenticate, adminOnly, venueManagerOnly } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { BookingStatus, PaymentMethod } from '@prisma/client';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get availability for a court on a specific date
const availabilityValidation = [
  query('courtId')
    .isInt({ min: 1 })
    .withMessage('Court ID must be a positive integer'),
  query('date')
    .isISO8601()
    .withMessage('Date must be in ISO format (YYYY-MM-DD)')
];

router.get('/availability', validate(availabilityValidation), bookingController.getAvailability);

// Create a new booking
const createBookingValidation = [
  body('courtId')
    .isInt({ min: 1 })
    .withMessage('Court ID must be a positive integer'),
  body('timeSlotId')
    .isInt({ min: 1 })
    .withMessage('Time slot ID must be a positive integer'),
  body('bookingDate')
    .isISO8601()
    .withMessage('Booking date must be in ISO format (YYYY-MM-DD)'),
  body('addOns')
    .optional()
    .isArray()
    .withMessage('Add-ons must be an array'),
  body('addOns.*.addOnType')
    .optional()
    .isString()
    .withMessage('Add-on type must be a string'),
  body('addOns.*.quantity')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Add-on quantity must be a positive integer'),
  body('addOns.*.price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Add-on price must be a positive number')
];

router.post('/', validate(createBookingValidation), bookingController.createBooking);

// Process payment for a booking
const processPaymentValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Booking ID must be a positive integer'),
  body('amount')
    .isFloat({ min: 0 })
    .withMessage('Amount must be a positive number'),
  body('paymentMethod')
    .isIn(Object.values(PaymentMethod))
    .withMessage('Invalid payment method'),
  body('transactionId')
    .optional()
    .isString()
    .withMessage('Transaction ID must be a string')
];

router.post('/:id/payment', validate(processPaymentValidation), bookingController.processPayment);

// Get booking by ID
const bookingIdValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Booking ID must be a positive integer')
];

router.get('/:id', validate(bookingIdValidation), bookingController.getBookingById);

// Cancel a booking
router.post('/:id/cancel', validate(bookingIdValidation), bookingController.cancelBooking);

// Update booking status (admin/venue manager only)
const updateStatusValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Booking ID must be a positive integer'),
  body('status')
    .isIn(Object.values(BookingStatus))
    .withMessage('Invalid booking status')
];

router.patch(
  '/:id/status', 
  validate(updateStatusValidation),
  (req, res, next) => {
    if (req.user?.role === 'ADMIN' || req.user?.role === 'SUPERADMIN') {
      adminOnly(req, res, next);
    } else {
      venueManagerOnly(req, res, next);
    }
  },
  bookingController.updateBookingStatus
);

export default router;