import express from 'express';
import { body, param } from 'express-validator';
import userMembershipRequestController from '../controllers/membershipRequest.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';

const userRouter = express.Router();

// All routes require authentication
userRouter.use(authenticate);

// Create membership requests
const createRequestsValidation = [
  body('societyIds')
    .isArray({ min: 1 })
    .withMessage('At least one society must be selected'),
  body('societyIds.*')
    .isInt({ min: 1 })
    .withMessage('All society IDs must be positive integers')
];

userRouter.post('/', validate(createRequestsValidation), userMembershipRequestController.createMembershipRequests);

// Get user's membership requests
userRouter.get('/', userMembershipRequestController.getMyMembershipRequests);

// Cancel membership request
const cancelRequestValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Request ID must be a positive integer')
];

userRouter.delete('/:id', validate(cancelRequestValidation), userMembershipRequestController.cancelMembershipRequest);

export default userRouter;
