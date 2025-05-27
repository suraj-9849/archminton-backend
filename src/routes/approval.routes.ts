// routes/approval.routes.ts
import express from 'express';
import { body, param, query } from 'express-validator';
import userApprovalController from '../controllers/approval.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { ApprovalStatus } from '@prisma/client';

const router = express.Router();

router.use(authenticate);

router.get('/test', (req, res) => {
  res.json({ 
    message: 'Admin approval routes working!',
  });
});


const societyMembershipValidation = [
  body('societyId')
    .isInt({ min: 1 })
    .withMessage('Society ID must be a positive integer'),
  body('comments')
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage('Comments must not exceed 500 characters')
];

router.post(
  '/society-membership',
  validate(societyMembershipValidation),
  userApprovalController.requestSocietyMembership
);

// Get user's approval requests
const getUserApprovalsValidation = [
  query('status')
    .optional()
    .isIn(Object.values(ApprovalStatus))
    .withMessage('Invalid approval status')
];

router.get(
  '/',
  validate(getUserApprovalsValidation),
  userApprovalController.getUserApprovals
);

// Get user's approval summary
router.get('/summary', userApprovalController.getUserApprovalSummary);

// Check eligibility for society membership
const checkEligibilityValidation = [
  query('societyId')
    .isInt({ min: 1 })
    .withMessage('Society ID must be a positive integer')
];

router.get(
  '/check-eligibility',
  validate(checkEligibilityValidation),
  userApprovalController.checkApprovalEligibility
);

// Get specific approval by ID
const approvalIdValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Approval ID must be a positive integer')
];

router.get(
  '/:id',
  validate(approvalIdValidation),
  userApprovalController.getUserApprovalById
);

// Cancel user's approval request
router.delete(
  '/:id',
  validate(approvalIdValidation),
  userApprovalController.cancelUserApproval
);

export default router;