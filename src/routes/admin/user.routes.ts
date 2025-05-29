import express from 'express';
import { body, param, query } from 'express-validator';
import adminUserController from '../../controllers/admin/user.controller';
import { authenticate, adminOnly } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';
import { Role } from '@prisma/client';

const router = express.Router();

// All routes require authentication and admin access
router.use(authenticate);
router.use(adminOnly);

// Get all users with pagination and filters
const getUsersValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('role')
    .optional()
    .isIn(Object.values(Role))
    .withMessage('Invalid role'),
  query('sortBy')
    .optional()
    .isIn(['id', 'name', 'email', 'role', 'createdAt', 'updatedAt'])
    .withMessage('Invalid sort field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc')
];

router.get('/', validate(getUsersValidation), adminUserController.getUsers);

// Get user by ID
const userIdValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('User ID must be a positive integer')
];

router.get('/:id', validate(userIdValidation), adminUserController.getUserById);

// Get user's membership requests
const userMembershipRequestsValidation = [
  param('userId')
    .isInt({ min: 1 })
    .withMessage('User ID must be a positive integer')
];

router.get('/:userId/membership-requests', validate(userMembershipRequestsValidation), adminUserController.getUserMembershipRequests);

// Create a new user
const createUserValidation = [
  body('email')
    .isEmail()
    .withMessage('Valid email is required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
  body('name')
    .notEmpty()
    .withMessage('Name is required'),
  body('phone')
    .optional()
    .isMobilePhone('any')
    .withMessage('Valid phone number is required'),
  body('gender')
    .optional()
    .isIn(['male', 'female', 'other'])
    .withMessage('Gender must be male, female, or other'),
  body('role')
    .optional()
    .isIn(Object.values(Role))
    .withMessage('Invalid role'),
  body('selectedSocieties')
    .optional()
    .isArray()
    .withMessage('Selected societies must be an array'),
  body('selectedSocieties.*')
    .optional()
    .isInt({ min: 1 })
    .withMessage('All society IDs must be positive integers')
];

router.post('/', validate(createUserValidation), adminUserController.createUser);

// Update a user
const updateUserValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('User ID must be a positive integer'),
  body('name')
    .optional()
    .notEmpty()
    .withMessage('Name cannot be empty'),
  body('phone')
    .optional()
    .isMobilePhone('any')
    .withMessage('Valid phone number is required'),
  body('gender')
    .optional()
    .isIn(['male', 'female', 'other'])
    .withMessage('Gender must be male, female, or other'),
  body('role')
    .optional()
    .isIn(Object.values(Role))
    .withMessage('Invalid role')
];

router.put('/:id', validate(updateUserValidation), adminUserController.updateUser);

// Reset user password
const resetPasswordValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('User ID must be a positive integer'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters')
];

router.post(
  '/:id/reset-password',
  validate(resetPasswordValidation),
  adminUserController.resetPassword
);

// Delete a user
router.delete('/:id', validate(userIdValidation), adminUserController.deleteUser);

export default router;