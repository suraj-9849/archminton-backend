// src/routes/admin/membership.routes.ts
import express from 'express';
import { body, param, query } from 'express-validator';
import { adminMembershipController } from '../../controllers/admin/membership.controller';
import { authenticate, adminOnly } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { MembershipType, MembershipStatus, SportType } from '@prisma/client';

const router = express.Router();

// All routes require authentication and admin access
router.use(authenticate);
router.use(adminOnly);

// Package Management Routes
const getPackagesValidation = [
  query('type')
    .optional()
    .isIn(Object.values(MembershipType))
    .withMessage('Invalid membership type'),
  query('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  query('venueId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Venue ID must be a positive integer')
];

router.get('/packages', validate(getPackagesValidation), adminMembershipController.getAllPackages);

const packageIdValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Package ID must be a positive integer')
];

router.get('/packages/:id', validate(packageIdValidation), adminMembershipController.getPackageById);

const createPackageValidation = [
  body('name')
    .notEmpty()
    .withMessage('Package name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('type')
    .isIn(Object.values(MembershipType))
    .withMessage('Valid membership type is required'),
  body('price')
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  body('durationMonths')
    .isInt({ min: 1 })
    .withMessage('Duration must be at least 1 month'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  body('credits')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Credits must be a non-negative integer'),
  body('maxBookingsPerMonth')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Max bookings per month must be a positive integer'),
  body('allowedSports')
    .optional()
    .isArray()
    .withMessage('Allowed sports must be an array'),
  body('allowedSports.*')
    .optional()
    .isIn(Object.values(SportType))
    .withMessage('Invalid sport type'),
  body('venueAccess')
    .optional()
    .isArray()
    .withMessage('Venue access must be an array'),
  body('venueAccess.*')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Venue IDs must be positive integers'),
  body('features')
    .optional()
    .isObject()
    .withMessage('Features must be an object')
];

router.post('/packages', validate(createPackageValidation), adminMembershipController.createPackage);

const updatePackageValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Package ID must be a positive integer'),
  body('name')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('type')
    .optional()
    .isIn(Object.values(MembershipType))
    .withMessage('Invalid membership type'),
  body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Price must be a positive number'),
  body('durationMonths')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Duration must be at least 1 month'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  body('credits')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Credits must be a non-negative integer'),
  body('maxBookingsPerMonth')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Max bookings per month must be a positive integer'),
  body('allowedSports')
    .optional()
    .isArray()
    .withMessage('Allowed sports must be an array'),
  body('venueAccess')
    .optional()
    .isArray()
    .withMessage('Venue access must be an array'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean')
];

router.put('/packages/:id', validate(updatePackageValidation), adminMembershipController.updatePackage);

router.delete('/packages/:id', validate(packageIdValidation), adminMembershipController.deletePackage);

// Membership Management Routes
const getMembershipsValidation = [
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
    .isIn(Object.values(MembershipStatus))
    .withMessage('Invalid membership status'),
  query('packageId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Package ID must be a positive integer'),
  query('userId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('User ID must be a positive integer'),
  query('venueId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Venue ID must be a positive integer')
];

router.get('/memberships', validate(getMembershipsValidation), adminMembershipController.getAllMemberships);

const membershipIdValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Membership ID must be a positive integer')
];

router.get('/memberships/:id', validate(membershipIdValidation), adminMembershipController.getMembershipById);

const createMembershipValidation = [
  body('userId')
    .isInt({ min: 1 })
    .withMessage('User ID must be a positive integer'),
  body('packageId')
    .isInt({ min: 1 })
    .withMessage('Package ID must be a positive integer'),
  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO date'),
  body('autoRenew')
    .optional()
    .isBoolean()
    .withMessage('Auto renew must be a boolean'),
  body('paymentMethod')
    .optional()
    .isString()
    .withMessage('Payment method must be a string'),
  body('paymentReference')
    .optional()
    .isString()
    .withMessage('Payment reference must be a string')
];

router.post('/memberships', validate(createMembershipValidation), adminMembershipController.createMembership);

const renewMembershipValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Membership ID must be a positive integer'),
  body('paymentReference')
    .optional()
    .isString()
    .withMessage('Payment reference must be a string')
];

router.post('/memberships/:id/renew', validate(renewMembershipValidation), adminMembershipController.renewMembership);

const cancelMembershipValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Membership ID must be a positive integer'),
  body('reason')
    .optional()
    .isString()
    .withMessage('Reason must be a string')
];

router.post('/memberships/:id/cancel', validate(cancelMembershipValidation), adminMembershipController.cancelMembership);

const updateMembershipStatusValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Membership ID must be a positive integer'),
  body('status')
    .isIn(Object.values(MembershipStatus))
    .withMessage('Valid membership status is required')
];

router.patch('/memberships/:id/status', validate(updateMembershipStatusValidation), adminMembershipController.updateMembershipStatus);

// Statistics and Reports
const statisticsValidation = [
  query('venueId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Venue ID must be a positive integer')
];

router.get('/statistics', validate(statisticsValidation), adminMembershipController.getMembershipStatistics);

const expiringValidation = [
  query('days')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Days must be between 1 and 365'),
  query('venueId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Venue ID must be a positive integer')
];

router.get('/expiring', validate(expiringValidation), adminMembershipController.getExpiringMemberships);

export default router;
