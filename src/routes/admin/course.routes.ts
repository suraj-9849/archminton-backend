import express from 'express';
import { body, param, query } from 'express-validator';
import adminCourseController from '../../controllers/admin/course.controller';
import { authenticate, adminOnly } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { SportType, PaymentStatus } from '@prisma/client';

const router = express.Router();

// All routes require authentication and admin access
router.use(authenticate);
router.use(adminOnly);

// Get all courses
const getCoursesValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('sportType')
    .optional()
    .isIn(Object.values(SportType))
    .withMessage('Invalid sport type'),
  query('venueId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Venue ID must be a positive integer'),
  query('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  query('search')
    .optional()
    .isString()
    .withMessage('Search must be a string')
];

router.get('/', validate(getCoursesValidation), adminCourseController.getAllCourses);

// Create course
const createCourseValidation = [
  body('name')
    .notEmpty()
    .withMessage('Course name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('sportType')
    .isIn(Object.values(SportType))
    .withMessage('Valid sport type is required'),
  body('venueId')
    .isInt({ min: 1 })
    .withMessage('Venue ID must be a positive integer'),
  body('price')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  body('duration')
    .isInt({ min: 1 })
    .withMessage('Duration must be a positive integer (in days)'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO date'),
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO date')
];

router.post('/', validate(createCourseValidation), adminCourseController.createCourse);

// Get course by ID
const courseIdValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Course ID must be a positive integer')
];

router.get('/:id', validate(courseIdValidation), adminCourseController.getCourseById);

// Update course
const updateCourseValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Course ID must be a positive integer'),
  body('name')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('sportType')
    .optional()
    .isIn(Object.values(SportType))
    .withMessage('Invalid sport type'),
  body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  body('duration')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Duration must be a positive integer (in days)'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO date'),
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO date'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean')
];

router.put('/:id', validate(updateCourseValidation), adminCourseController.updateCourse);

// Delete course
router.delete('/:id', validate(courseIdValidation), adminCourseController.deleteCourse);

// Get course enrollments
const getEnrollmentsValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Course ID must be a positive integer'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('paymentStatus')
    .optional()
    .isIn(Object.values(PaymentStatus))
    .withMessage('Invalid payment status')
];

router.get('/:id/enrollments', validate(getEnrollmentsValidation), adminCourseController.getCourseEnrollments);

// Update enrollment payment status
const updateEnrollmentPaymentValidation = [
  param('enrollmentId')
    .isInt({ min: 1 })
    .withMessage('Enrollment ID must be a positive integer'),
  body('paymentStatus')
    .isIn(Object.values(PaymentStatus))
    .withMessage('Valid payment status is required')
];

router.patch('/enrollments/:enrollmentId/payment-status', validate(updateEnrollmentPaymentValidation), adminCourseController.updateEnrollmentPaymentStatus);

// Cancel enrollment
const cancelEnrollmentValidation = [
  param('enrollmentId')
    .isInt({ min: 1 })
    .withMessage('Enrollment ID must be a positive integer'),
  body('reason')
    .optional()
    .isString()
    .withMessage('Reason must be a string')
];

router.post('/enrollments/:enrollmentId/cancel', validate(cancelEnrollmentValidation), adminCourseController.cancelEnrollment);

// Get course statistics
router.get('/:id/statistics', validate(courseIdValidation), adminCourseController.getCourseStatistics);

export default router;