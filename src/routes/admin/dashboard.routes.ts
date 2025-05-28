import express from 'express';
import { query } from 'express-validator';
import adminDashboardController from '../../controllers/admin/dashboard.controller';
import { authenticate, adminOnly } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';

const router = express.Router();

router.use(authenticate);
router.use(adminOnly);

const dateAndVenueValidation = [
  query('fromDate')
    .optional()
    .isISO8601()
    .withMessage('From date must be a valid ISO date'),
  query('toDate')
    .optional()
    .isISO8601()
    .withMessage('To date must be a valid ISO date'),
  query('venueId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Venue ID must be a positive integer')
];

// Main dashboard analytics endpoint
router.get(
  '/analytics',
  validate(dateAndVenueValidation),
  adminDashboardController.getDashboardAnalytics
);

// Revenue analytics with grouping support
const revenueAnalyticsValidation = [
  ...dateAndVenueValidation,
  query('groupBy')
    .optional()
    .isIn(['hour', 'day', 'week', 'month'])
    .withMessage('Group by must be one of: hour, day, week, month')
];

router.get(
  '/revenue-analytics',
  validate(revenueAnalyticsValidation),
  adminDashboardController.getRevenueAnalytics
);

// Booking statistics endpoint
router.get(
  '/booking-statistics',
  validate(dateAndVenueValidation),
  adminDashboardController.getBookingStatistics
);

// Legacy endpoints for backward compatibility
router.get('/stats', adminDashboardController.getStats);

router.get(
  '/booking-stats',
  validate(dateAndVenueValidation),
  adminDashboardController.getBookingStats
);

router.get(
  '/revenue-stats',
  validate(dateAndVenueValidation),
  adminDashboardController.getRevenueStats
);

router.get('/user-stats', adminDashboardController.getUserStats);

export default router;