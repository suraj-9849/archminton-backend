import express from 'express';
import { body, param, query } from 'express-validator';
import adminMembershipRequestController from '../../controllers/admin/membershipRequest.controller';
import { authenticate, adminOnly } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { MembershipRequestStatus } from '@prisma/client';

const router = express.Router();

// All routes require authentication and admin access
router.use(authenticate);
router.use(adminOnly);

// Create membership requests for a specific user (admin only)
const createForUserValidation = [
  body('userId')
    .isInt({ min: 1 })
    .withMessage('User ID must be a positive integer'),
  body('societyIds')
    .isArray({ min: 1 })
    .withMessage('Society IDs must be a non-empty array'),
  body('societyIds.*')
    .isInt({ min: 1 })
    .withMessage('All society IDs must be positive integers')
];

router.post('/create-for-user', validate(createForUserValidation), adminMembershipRequestController.createMembershipRequestsForUser);

// Get membership request statistics
const getStatisticsValidation = [
  query('societyId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Society ID must be a positive integer')
];

router.get('/statistics', validate(getStatisticsValidation), adminMembershipRequestController.getMembershipRequestStatistics);

// Get pending membership requests
const getPendingValidation = [
  query('societyId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Society ID must be a positive integer'),
  query('userId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('User ID must be a positive integer')
];

router.get('/pending', validate(getPendingValidation), adminMembershipRequestController.getPendingMembershipRequests);

// Get all membership requests with pagination
const getAllRequestsValidation = [
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
    .isIn(Object.values(MembershipRequestStatus))
    .withMessage('Invalid membership request status'),
  query('societyId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Society ID must be a positive integer')
];

router.get('/', validate(getAllRequestsValidation), adminMembershipRequestController.getAllMembershipRequests);

// Review membership request
const reviewRequestValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Request ID must be a positive integer'),
  body('status')
    .isIn([MembershipRequestStatus.APPROVED, MembershipRequestStatus.REJECTED])
    .withMessage('Status must be APPROVED or REJECTED'),
  body('reviewNote')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('Review note must not exceed 500 characters')
];

router.post('/:id/review', validate(reviewRequestValidation), adminMembershipRequestController.reviewMembershipRequest);

// Bulk review membership requests
const bulkReviewValidation = [
  body('requestIds')
    .isArray({ min: 1 })
    .withMessage('Request IDs must be a non-empty array'),
  body('requestIds.*')
    .isInt({ min: 1 })
    .withMessage('All request IDs must be positive integers'),
  body('status')
    .isIn([MembershipRequestStatus.APPROVED, MembershipRequestStatus.REJECTED])
    .withMessage('Status must be APPROVED or REJECTED'),
  body('reviewNote')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('Review note must not exceed 500 characters')
];

router.post('/bulk-review', validate(bulkReviewValidation), adminMembershipRequestController.bulkReviewMembershipRequests);

export default router;