import express from 'express';
import { body, param, query } from 'express-validator';
import courseController from '../controllers/course.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { SportType } from '@prisma/client';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get upcoming courses (public route)
router.get('/upcoming', courseController.getUpcomingCourses);

// Get courses by venue
const coursesByVenueValidation = [
  param('venueId')
    .isInt({ min: 1 })
    .withMessage('Venue ID must be a positive integer'),
  query('includeInactive')
    .optional()
    .isBoolean()
    .withMessage('includeInactive must be a boolean')
];

router.get('/venue/:venueId', validate(coursesByVenueValidation), courseController.getCoursesByVenue);

// Get all courses with filters
const getCoursesValidation = [
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

router.get('/', validate(getCoursesValidation), courseController.getCourses);

// Get course by ID
const courseIdValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Course ID must be a positive integer')
];

router.get('/:id', validate(courseIdValidation), courseController.getCourseById);

// Enroll in course
const enrollValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Course ID must be a positive integer'),
  body('startDate')
    .isISO8601()
    .withMessage('Start date must be a valid ISO date'),
  body('endDate')
    .isISO8601()
    .withMessage('End date must be a valid ISO date')
];

router.post('/:id/enroll', validate(enrollValidation), courseController.enrollInCourse);

export default router;