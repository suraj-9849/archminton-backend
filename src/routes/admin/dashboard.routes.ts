import express from 'express';
import { query } from 'express-validator';
import adminDashboardController from '../../controllers/admin/dashboard.controller';
import { authenticate, adminOnly } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';

const router = express.Router();

// All routes require authentication and admin access
router.use(authenticate);
router.use(adminOnly);

// Dashboard statistics route
router.get('/stats', adminDashboardController.getStats);

// Booking statistics route
const dateValidation = [
  query('fromDate')
    .optional()
    .isISO8601()
    .withMessage('From date must be a valid ISO date'),
  query('toDate')
    .optional()
    .isISO8601()
    .withMessage('To date must be a valid ISO date')
];

router.get(
  '/booking-stats',
  validate(dateValidation),
  adminDashboardController.getBookingStats
);

// Revenue statistics route
router.get(
  '/revenue-stats',
  validate(dateValidation),
  adminDashboardController.getRevenueStats
);

// User statistics route
router.get('/user-stats', adminDashboardController.getUserStats);

export default router;