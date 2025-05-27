import express from 'express';
import { body, param, query } from 'express-validator';
import adminApprovalController from '../../controllers/admin/approval.controller';
import { authenticate, authorize } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { ApprovalStatus, Role } from '@prisma/client';

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ 
    message: 'Admin approval routes working!',
  });
});

router.use(authenticate);
router.use(authorize([Role.VENUE_MANAGER, Role.ADMIN, Role.SUPERADMIN]));

const getApprovalsValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('search')
    .optional()
    .isString()
    .withMessage('Search must be a string'),
  query('status')
    .optional()
    .isIn(Object.values(ApprovalStatus))
    .withMessage('Invalid approval status')
];

router.get('/', validate(getApprovalsValidation), adminApprovalController.getApprovalRequests);

// Get approval statistics
router.get('/statistics', adminApprovalController.getApprovalStatistics);

// Get approval dashboard data
router.get('/dashboard', adminApprovalController.getApprovalDashboard);

// Get approval by ID
const approvalIdValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Approval ID must be a positive integer')
];

router.get('/:id', validate(approvalIdValidation), adminApprovalController.getApprovalById);

// Process approval (approve/reject)
const processApprovalValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Approval ID must be a positive integer'),
  body('status')
    .isIn([ApprovalStatus.APPROVED, ApprovalStatus.REJECTED])
    .withMessage('Status must be either APPROVED or REJECTED'),
  body('processorComments')
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage('Processor comments must not exceed 1000 characters')
];

router.post('/:id/process', validate(processApprovalValidation), adminApprovalController.processApproval);

// Bulk process approvals
const bulkProcessValidation = [
  body('approvalIds')
    .isArray({ min: 1 })
    .withMessage('Approval IDs array is required'),
  body('approvalIds.*')
    .isInt({ min: 1 })
    .withMessage('Each approval ID must be a positive integer'),
  body('status')
    .isIn([ApprovalStatus.APPROVED, ApprovalStatus.REJECTED])
    .withMessage('Status must be either APPROVED or REJECTED'),
  body('processorComments')
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .withMessage('Processor comments must not exceed 1000 characters')
];

router.post('/bulk-process', validate(bulkProcessValidation), adminApprovalController.bulkProcessApprovals);

export default router;