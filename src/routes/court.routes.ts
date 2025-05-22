import express from 'express';
import { param, query } from 'express-validator';
import courtController from '../controllers/court.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { SportType } from '@prisma/client';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get all courts with filters
const getCourtsValidation = [
  query('venueId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Venue ID must be a positive integer'),
  query('sportType')
    .optional()
    .isIn(Object.values(SportType))
    .withMessage('Invalid sport type'),
  query('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  query('search')
    .optional()
    .isString()
    .withMessage('Search must be a string')
];

router.get('/', validate(getCourtsValidation), courtController.getCourts);

// Get court by ID
const courtIdValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Court ID must be a positive integer')
];

router.get('/:id', validate(courtIdValidation), courtController.getCourtById);

// Get court time slots
const getTimeSlotsValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Court ID must be a positive integer'),
  query('includeInactive')
    .optional()
    .isBoolean()
    .withMessage('includeInactive must be a boolean')
];

router.get('/:id/timeslots', validate(getTimeSlotsValidation), courtController.getCourtTimeSlots);

export default router;