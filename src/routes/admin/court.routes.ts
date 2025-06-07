import express from 'express';
import { body, param, query } from 'express-validator';
import adminCourtController from '../../controllers/admin/court.controller';
import { authenticate, adminOnly } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';

const router = express.Router();

// All routes require authentication and admin access
router.use(authenticate);
router.use(adminOnly);

// Get all courts
const getCourtsValidation = [
  query('venueId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Venue ID must be a positive integer'),
  query('sportType')
    .optional(),
  query('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  query('search')
    .optional()
    .isString()
    .withMessage('Search must be a string')
];

router.get('/', validate(getCourtsValidation), adminCourtController.getAllCourts);

// Create court
const createCourtValidation = [
  body('name')
    .notEmpty()
    .withMessage('Court name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('sportType'),
  body('venueId')
    .isInt({ min: 1 })
    .withMessage('Venue ID must be a positive integer'),
  body('pricePerHour')
    .isFloat({ min: 0 })
    .withMessage('Price per hour must be a positive number'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters')
];

router.post('/', validate(createCourtValidation), adminCourtController.createCourt);

// Update court
const updateCourtValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Court ID must be a positive integer'),
  body('name')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('sportType')
    .optional(),
  body('pricePerHour')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Price per hour must be a positive number'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean')
];

router.put('/:id', validate(updateCourtValidation), adminCourtController.updateCourt);

// Delete court
const courtIdValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Court ID must be a positive integer')
];

router.delete('/:id', validate(courtIdValidation), adminCourtController.deleteCourt);

// Create time slot for court
const createTimeSlotValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Court ID must be a positive integer'),
  body('dayOfWeek')
    .isInt({ min: 0, max: 6 })
    .withMessage('Day of week must be between 0 (Sunday) and 6 (Saturday)'),
  body('startTime')
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Start time must be in HH:MM format'),
  body('endTime')
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('End time must be in HH:MM format')
];

router.post('/:id/timeslots', validate(createTimeSlotValidation), adminCourtController.createTimeSlot);

// Bulk create time slots
const bulkCreateTimeSlotsValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Court ID must be a positive integer'),
  body('timeSlots')
    .isArray({ min: 1 })
    .withMessage('Time slots array is required'),
  body('timeSlots.*.dayOfWeek')
    .isInt({ min: 0, max: 6 })
    .withMessage('Day of week must be between 0 (Sunday) and 6 (Saturday)'),
  body('timeSlots.*.startTime')
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Start time must be in HH:MM format'),
  body('timeSlots.*.endTime')
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('End time must be in HH:MM format')
];

router.post('/:id/timeslots/bulk', validate(bulkCreateTimeSlotsValidation), adminCourtController.bulkCreateTimeSlots);

// Update time slot status
const updateTimeSlotValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Time slot ID must be a positive integer'),
  body('isActive')
    .isBoolean()
    .withMessage('isActive must be a boolean')
];

router.patch('/timeslots/:id', validate(updateTimeSlotValidation), adminCourtController.updateTimeSlot);

// Delete time slot
const timeSlotIdValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Time slot ID must be a positive integer')
];

router.delete('/timeslots/:id', validate(timeSlotIdValidation), adminCourtController.deleteTimeSlot);

router.get('/:id', validate(courtIdValidation), adminCourtController.getCourtById);


export default router;