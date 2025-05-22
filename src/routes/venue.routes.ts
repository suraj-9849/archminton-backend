import express from 'express';
import { param, query } from 'express-validator';
import venueController from '../controllers/venue.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { SportType } from '@prisma/client';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Venue search route
const searchVenueValidation = [
  query('q')
    .isString()
    .isLength({ min: 2 })
    .withMessage('Search query must be at least 2 characters')
];

router.get('/search', validate(searchVenueValidation), venueController.searchVenues);

// Get venues by sport type
const sportTypeValidation = [
  param('sportType')
    .isIn(Object.values(SportType))
    .withMessage('Valid sport type is required')
];

router.get('/sport/:sportType', validate(sportTypeValidation), venueController.getVenuesBySport);

// Get all accessible venues
const getVenuesValidation = [
  query('sportType')
    .optional()
    .isIn(Object.values(SportType))
    .withMessage('Valid sport type is required'),
  query('location')
    .optional()
    .isString()
    .withMessage('Location must be a string'),
  query('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean')
];

router.get('/', validate(getVenuesValidation), venueController.getVenues);

// Get venue by ID
const venueIdValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Venue ID must be a positive integer')
];

router.get('/:id', validate(venueIdValidation), venueController.getVenueById);

// Get sports available at a venue
router.get('/:id/sports', validate(venueIdValidation), venueController.getVenueSports);

// Get courts by venue and sport type
const getVenueCourtValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Venue ID must be a positive integer'),
  query('sportType')
    .isIn(Object.values(SportType))
    .withMessage('Valid sport type is required'),
  query('date')
    .optional()
    .isISO8601()
    .withMessage('Valid ISO date format required')
];

router.get('/:id/courts', validate(getVenueCourtValidation), venueController.getVenueCourts);

export default router;