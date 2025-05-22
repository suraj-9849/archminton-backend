import express from 'express';
import { body, param, query } from 'express-validator';
import userController from '../controllers/user.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { BookingStatus } from '@prisma/client';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Profile routes
router.get('/profile', userController.getProfile);

// Validation rules for profile update
const updateProfileValidation = [
  body('name')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('phone')
    .optional()
    .isMobilePhone('any')
    .withMessage('Invalid phone number format'),
  body('gender')
    .optional()
    .isIn(['male', 'female', 'other'])
    .withMessage('Gender must be one of: male, female, other')
];

router.put('/profile', validate(updateProfileValidation), userController.updateProfile);

// Society routes
router.get('/societies', userController.getSocieties);

const applyForSocietyValidation = [
  body('societyId')
    .notEmpty()
    .withMessage('Society ID is required')
    .isInt({ min: 1 })
    .withMessage('Society ID must be a positive integer')
];

router.post('/societies', validate(applyForSocietyValidation), userController.applyForSociety);

// Booking routes
const getBookingsValidation = [
  query('status')
    .optional()
    .isIn(Object.values(BookingStatus))
    .withMessage('Invalid booking status'),
  query('fromDate')
    .optional()
    .isISO8601()
    .withMessage('From date must be a valid ISO date'),
  query('toDate')
    .optional()
    .isISO8601()
    .withMessage('To date must be a valid ISO date')
];

router.get('/bookings', validate(getBookingsValidation), userController.getBookings);

const bookingIdValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Booking ID must be a positive integer')
];

router.get('/bookings/:id', validate(bookingIdValidation), userController.getBookingById);
router.post('/bookings/:id/cancel', validate(bookingIdValidation), userController.cancelBooking);

// Course enrollment routes
router.get('/courses', userController.getCourseEnrollments);

export default router;