import express from 'express';
import { param, query } from 'express-validator';
import societyController from '../controllers/society.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get all societies with optional filters
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

router.get('/', validate(getSocietiesValidation), societyController.getSocieties);

// Get society by ID
const societyIdValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Society ID must be a positive integer')
];

router.get('/:id', validate(societyIdValidation), societyController.getSocietyById);

// Get society members
const getSocietyMembersValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Society ID must be a positive integer'),
  query('includeInactive')
    .optional()
    .isBoolean()
    .withMessage('includeInactive must be a boolean')
];

router.get(
  '/:id/members', 
  validate(getSocietyMembersValidation), 
  societyController.getSocietyMembers
);

export default router;