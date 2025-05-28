import express from "express";
import { body, param, query } from "express-validator";
import staffManagementController from "../../controllers/admin/staffManagement.controller";
import {
  authenticate,
  adminOnly,
  venueManagerOnly,
} from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";

const router = express.Router();

router.use((req, res, next) => {
  console.log(`🔍 Staff Route: ${req.method} ${req.path}`);
  console.log(`🔍 Params:`, req.params);
  console.log(`🔍 Query:`, req.query);
  next();
});

router.get("/permissions", (req, res, next) => {
  console.log('🎯 Permissions route hit - bypassing all validation');
  next();
}, authenticate, venueManagerOnly, staffManagementController.getAvailablePermissions);

// Apply middleware to all other routes
router.use(authenticate);
router.use(venueManagerOnly);

// Venue parameter validation
const venueIdValidation = [
  param("venueId")
    .isInt({ min: 1 })
    .withMessage("Venue ID must be a positive integer"),
];

const userIdValidation = [
  param("userId")
    .isInt({ min: 1 })
    .withMessage("User ID must be a positive integer"),
];

// Get staff statistics - MUST come before /:venueId/staff/:userId route
router.get(
  "/:venueId/staff/statistics",
  validate(venueIdValidation),
  staffManagementController.getStaffStatistics
);

// Get all staff members for a venue
const getStaffValidation = [
  ...venueIdValidation,
  query("includeInactive")
    .optional()
    .isBoolean()
    .withMessage("includeInactive must be a boolean"),
];

router.get(
  "/:venueId/staff",
  validate(getStaffValidation),
  staffManagementController.getVenueStaff
);

// Create new staff member
const createStaffValidation = [
  ...venueIdValidation,
  body("firstName")
    .notEmpty()
    .withMessage("First name is required")
    .isLength({ min: 2, max: 50 })
    .withMessage("First name must be between 2 and 50 characters"),
  body("lastName")
    .optional()
    .isLength({ max: 50 })
    .withMessage("Last name must not exceed 50 characters"),
  body("email")
    .isEmail()
    .withMessage("Valid email is required")
    .normalizeEmail(),
  body("phone")
    .optional()
    .isMobilePhone("any")
    .withMessage("Valid phone number is required"),
  body("username")
    .notEmpty()
    .withMessage("Username is required")
    .isLength({ min: 3, max: 30 })
    .withMessage("Username must be between 3 and 30 characters")
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage("Username can only contain letters, numbers, and underscores"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage(
      "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    ),
  body("confirmPassword")
    .notEmpty()
    .withMessage("Password confirmation is required")
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error("Passwords do not match");
      }
      return true;
    }),
  body("role")
    .isIn(["ADMIN", "DESK"])
    .withMessage("Role must be either ADMIN or DESK"),
  body("permissions")
    .optional()
    .isArray()
    .withMessage("Permissions must be an array"),
];

router.post(
  "/:venueId/staff",
  validate(createStaffValidation),
  staffManagementController.createStaff
);

// Get staff member details
router.get(
  "/:venueId/staff/:userId",
  validate([...venueIdValidation, ...userIdValidation]),
  staffManagementController.getStaffById
);

// Update staff member
const updateStaffValidation = [
  ...venueIdValidation,
  ...userIdValidation,
  body("firstName")
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage("First name must be between 2 and 50 characters"),
  body("lastName")
    .optional()
    .isLength({ max: 50 })
    .withMessage("Last name must not exceed 50 characters"),
  body("email")
    .optional()
    .isEmail()
    .withMessage("Valid email is required")
    .normalizeEmail(),
  body("phone")
    .optional()
    .isMobilePhone("any")
    .withMessage("Valid phone number is required"),
  body("username")
    .optional()
    .isLength({ min: 3, max: 30 })
    .withMessage("Username must be between 3 and 30 characters")
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage("Username can only contain letters, numbers, and underscores"),
  body("role")
    .optional()
    .isIn(["ADMIN", "DESK"])
    .withMessage("Role must be either ADMIN or DESK"),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),
];

router.put(
  "/:venueId/staff/:userId",
  validate(updateStaffValidation),
  staffManagementController.updateStaff
);

// Remove staff member
router.delete(
  "/:venueId/staff/:userId",
  validate([...venueIdValidation, ...userIdValidation]),
  staffManagementController.removeStaff
);

// Update staff permissions
const updatePermissionsValidation = [
  ...venueIdValidation,
  ...userIdValidation,
  body("permissions")
    .isArray()
    .withMessage("Permissions must be an array")
    .custom((permissions) => {
      // Validate that all permissions are strings
      if (!permissions.every((p: any) => typeof p === "string")) {
        throw new Error("All permissions must be strings");
      }
      return true;
    }),
];

router.patch(
  "/:venueId/staff/:userId/permissions",
  validate(updatePermissionsValidation),
  staffManagementController.updateStaffPermissions
);

// Check specific permission
const checkPermissionValidation = [
  ...venueIdValidation,
  ...userIdValidation,
  param("permission")
    .notEmpty()
    .withMessage("Permission is required")
    .isString()
    .withMessage("Permission must be a string"),
];

router.get(
  "/:venueId/staff/:userId/permissions/:permission",
  validate(checkPermissionValidation),
  staffManagementController.checkPermission
);

export default router;