import express from 'express';
import { body, param, query } from 'express-validator';
import adminSocietyController from '../../controllers/admin/society.controller';
import { authenticate, adminOnly } from '../../middlewares/auth.middleware';
import { validate } from '../../middlewares/validate.middleware';

const router = express.Router();

// All routes require authentication and admin access
router.use(authenticate);
router.use(adminOnly);

// Get all societies
const getSocietiesValidation = [
  query('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  query('search')
    .optional()
    .isString()
    .withMessage('Search must be a string')
];

router.get('/', validate(getSocietiesValidation), adminSocietyController.getAllSocieties);

// Create society
const createSocietyValidation = [
  body('name')
    .notEmpty()
    .withMessage('Society name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('location')
    .notEmpty()
    .withMessage('Location is required')
    .isLength({ min: 2, max: 200 })
    .withMessage('Location must be between 2 and 200 characters'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  body('contactPerson')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Contact person name must be between 2 and 100 characters'),
  body('contactPhone')
    .optional()
    .isMobilePhone('any')
    .withMessage('Valid phone number is required')
];

router.post('/', validate(createSocietyValidation), adminSocietyController.createSociety);

// Update society
const updateSocietyValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Society ID must be a positive integer'),
  body('name')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('location')
    .optional()
    .isLength({ min: 2, max: 200 })
    .withMessage('Location must be between 2 and 200 characters'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  body('contactPerson')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Contact person name must be between 2 and 100 characters'),
  body('contactPhone')
    .optional()
    .isMobilePhone('any')
    .withMessage('Valid phone number is required'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean')
];

router.put('/:id', validate(updateSocietyValidation), adminSocietyController.updateSociety);

// Delete society
const societyIdValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Society ID must be a positive integer')
];

router.delete('/:id', validate(societyIdValidation), adminSocietyController.deleteSociety);

// Add member to society
const addMemberValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Society ID must be a positive integer'),
  body('userId')
    .isInt({ min: 1 })
    .withMessage('User ID must be a positive integer')
];

router.post('/:id/members', validate(addMemberValidation), adminSocietyController.addMember);

// Remove member from society
const removeMemberValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Society ID must be a positive integer'),
  param('userId')
    .isInt({ min: 1 })
    .withMessage('User ID must be a positive integer')
];

router.delete(
  '/:id/members/:userId', 
  validate(removeMemberValidation), 
  adminSocietyController.removeMember
);

export default router;