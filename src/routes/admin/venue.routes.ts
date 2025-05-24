import express from "express";
import { body, param, query } from "express-validator";
import adminVenueController from "../../controllers/admin/venue.controller";
import { authenticate, adminOnly } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { VenueType } from "@prisma/client";

const router = express.Router();

// All routes require authentication and admin access
router.use(authenticate);
router.use(adminOnly);

// Get all venues
const getVenuesValidation = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
  query("search").optional().isString().withMessage("Search must be a string"),
  query("venueType")
    .optional()
    .isIn(Object.values(VenueType))
    .withMessage("Invalid venue type"),
  query("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),
];

router.get(
  "/",
  validate(getVenuesValidation),
  adminVenueController.getAllVenues
);

// Create venue
const createVenueValidation = [
  body("name")
    .notEmpty()
    .withMessage("Venue name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters"),
  body("location")
    .notEmpty()
    .withMessage("Location is required")
    .isLength({ min: 2, max: 200 })
    .withMessage("Location must be between 2 and 200 characters"),
  body("description")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Description must not exceed 500 characters"),
  body("latitude")
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage("Latitude must be between -90 and 90"),
  body("longitude")
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage("Longitude must be between -180 and 180"),
  body("contactPhone")
    .optional()
    .isMobilePhone("any")
    .withMessage("Valid phone number is required"),
  body("contactEmail")
    .optional()
    .isEmail()
    .withMessage("Valid email is required"),
  body("venueType")
    .isIn(Object.values(VenueType))
    .withMessage("Valid venue type is required"),
  body("societyId")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Society ID must be a positive integer"),
];

router.post(
  "/",
  validate(createVenueValidation),
  adminVenueController.createVenue
);

// Get venue by ID
const venueIdValidation = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("Venue ID must be a positive integer"),
];

router.get(
  "/:id",
  validate(venueIdValidation),
  adminVenueController.getVenueById
);

// Update venue
const updateVenueValidation = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("Venue ID must be a positive integer"),
  body("name")
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters"),
  body("location")
    .optional()
    .isLength({ min: 2, max: 200 })
    .withMessage("Location must be between 2 and 200 characters"),
  body("description")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Description must not exceed 500 characters"),
  body("latitude")
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage("Latitude must be between -90 and 90"),
  body("longitude")
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage("Longitude must be between -180 and 180"),
  body("contactPhone")
    .optional()
    .isMobilePhone("any")
    .withMessage("Valid phone number is required"),
  body("contactEmail")
    .optional()
    .isEmail()
    .withMessage("Valid email is required"),
  body("venueType")
    .optional()
    .isIn(Object.values(VenueType))
    .withMessage("Invalid venue type"),
  body("societyId")
    .optional()
    .custom((value) => {
      if (value === null || value === undefined || value === "") {
        return true;
      }
      const num = Number(value);
      if (!Number.isInteger(num) || num <= 0) {
        throw new Error("Society ID must be a positive integer");
      }
      return true;
    }),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),
];

router.put(
  "/:id",
  validate(updateVenueValidation),
  adminVenueController.updateVenue
);

// Delete venue
router.delete(
  "/:id",
  validate(venueIdValidation),
  adminVenueController.deleteVenue
);

// Grant venue access
const grantAccessValidation = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("Venue ID must be a positive integer"),
  body("userId")
    .isInt({ min: 1 })
    .withMessage("User ID must be a positive integer"),
];

router.post(
  "/:id/access",
  validate(grantAccessValidation),
  adminVenueController.grantVenueAccess
);

// Revoke venue access
const revokeAccessValidation = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("Venue ID must be a positive integer"),
  param("userId")
    .isInt({ min: 1 })
    .withMessage("User ID must be a positive integer"),
];

router.delete(
  "/:id/access/:userId",
  validate(revokeAccessValidation),
  adminVenueController.revokeVenueAccess
);

export default router;
