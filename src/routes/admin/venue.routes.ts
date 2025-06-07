import express from "express";
import { body, param, query } from "express-validator";
import adminVenueController from "../../controllers/admin/venue.controller";
import venueSportsController from "../../controllers/admin/venueSports.controller";
import { authenticate, adminOnly } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { VenueType } from "@prisma/client";

const router = express.Router();

router.use(authenticate);
router.use(adminOnly);

const getVenuesValidation = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
  query("search")
    .optional()
    .isString()
    .withMessage("Search must be a string")
    .trim(),
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

const createVenueValidation = [
  body("name")
    .notEmpty()
    .withMessage("Venue name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters")
    .trim(),
  body("location")
    .notEmpty()
    .withMessage("Location is required")
    .isLength({ min: 2, max: 200 })
    .withMessage("Location must be between 2 and 200 characters")
    .trim(),
  body("venueType")
    .notEmpty()
    .withMessage("Venue type is required")
    .isIn(Object.values(VenueType))
    .withMessage(
      `Valid venue type is required. Must be one of: ${Object.values(
        VenueType
      ).join(", ")}`
    ),
  body("description")
    .optional()
    .custom((value) => {
      // Allow null, undefined, or empty string
      if (value === null || value === undefined || value === "") return true;
      if (typeof value !== "string") {
        throw new Error("Description must be a string");
      }
      if (value.length > 500) {
        throw new Error("Description must not exceed 500 characters");
      }
      return true;
    })
    .customSanitizer((value) => {
      // Convert empty string to null
      if (value === "" || value === undefined) return null;
      return typeof value === "string" ? value.trim() : value;
    }),
  body("latitude")
    .optional()
    .custom((value) => {
      if (value === null || value === undefined || value === "") return true;
      const num = parseFloat(value);
      if (isNaN(num) || num < -90 || num > 90) {
        throw new Error("Latitude must be a number between -90 and 90");
      }
      return true;
    })
    .customSanitizer((value) => {
      // Convert empty string and undefined to null
      if (value === "" || value === undefined) return null;
      const num = parseFloat(value);
      return isNaN(num) ? null : num;
    }),
  body("longitude")
    .optional()
    .custom((value) => {
      if (value === null || value === undefined || value === "") return true;
      const num = parseFloat(value);
      if (isNaN(num) || num < -180 || num > 180) {
        throw new Error("Longitude must be a number between -180 and 180");
      }
      return true;
    })
    .customSanitizer((value) => {
      if (value === "" || value === undefined) return null;
      const num = parseFloat(value);
      return isNaN(num) ? null : num;
    }),
  body("contactPhone")
    .optional()
    .custom((value) => {
      if (value === null || value === undefined || value === "") return true;
      if (typeof value !== "string" || value.trim().length < 10) {
        throw new Error("Phone number must be at least 10 characters");
      }
      return true;
    })
    .customSanitizer((value) => {
      if (value === "" || value === undefined) return null;
      return typeof value === "string" ? value.trim() : value;
    }),
  body("contactEmail")
    .optional()
    .custom((value) => {
      if (value === null || value === undefined || value === "") return true;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        throw new Error("Valid email is required");
      }
      return true;
    })
    .customSanitizer((value) => {
      if (value === "" || value === undefined) return null;
      return typeof value === "string" ? value.trim() : value;
    }),
  body("societyId")
    .optional()
    .custom((value, { req }) => {
      // For PUBLIC venues, societyId should be null/undefined
      if (req.body.venueType === "PUBLIC") {
        if (value !== undefined && value !== null && value !== "") {
          throw new Error("Public venues cannot have a society association");
        }
        return true;
      }
      
      // For PRIVATE venues, societyId is required
      if (req.body.venueType === "PRIVATE") {
        if (value === undefined || value === null || value === "") {
          throw new Error("Private venues must be associated with a society");
        }
        const num = parseInt(value);
        if (isNaN(num) || num <= 0) {
          throw new Error("Society ID must be a positive integer");
        }
        return true;
      }
      
      // For other cases, allow null/undefined or valid integer
      if (value === undefined || value === null || value === "") {
        return true;
      }
      const num = parseInt(value);
      if (isNaN(num) || num <= 0) {
        throw new Error("Society ID must be a positive integer");
      }
      return true;
    })
    .customSanitizer((value, { req }) => {
      // Convert undefined/empty to null for PUBLIC venues
      if (req.body.venueType === "PUBLIC" || value === "" || value === undefined) {
        return null;
      }
      const num = parseInt(value);
      return isNaN(num) ? null : num;
    }),
  body("services")
    .optional({ nullable: true })
    .isArray()
    .withMessage("Services must be an array"),
  body("services.*")
    .optional()
    .isString()
    .withMessage("Each service must be a string"),
  body("amenities")
    .optional({ nullable: true })
    .isArray()
    .withMessage("Amenities must be an array"),
  body("amenities.*")
    .optional()
    .isString()
    .withMessage("Each amenity must be a string"),
  body("images")
    .optional({ nullable: true })
    .isArray()
    .withMessage("Images must be an array"),
  body("images.*.imageUrl")
    .optional()
    .isString()
    .isLength({ min: 1 })
    .withMessage("Image URL is required and must be a valid string"),
  body("images.*.isDefault")
    .optional()
    .isBoolean()
    .withMessage("isDefault must be a boolean"),
];

router.post(
  "/",
  validate(createVenueValidation),
  adminVenueController.createVenue
);

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

const updateVenueValidation = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("Venue ID must be a positive integer"),
  body("name")
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters")
    .trim(),
  body("location")
    .optional()
    .isLength({ min: 2, max: 200 })
    .withMessage("Location must be between 2 and 200 characters")
    .trim(),
  body("description")
    .optional({ nullable: true, checkFalsy: false })
    .isString()
    .isLength({ max: 500 })
    .withMessage("Description must not exceed 500 characters")
    .trim(),
  body("latitude")
    .optional({ nullable: true, checkFalsy: false })
    .custom((value) => {
      if (value === null || value === undefined || value === "") return true;
      const num = parseFloat(value);
      if (isNaN(num) || num < -90 || num > 90) {
        throw new Error("Latitude must be a number between -90 and 90");
      }
      return true;
    }),
  body("longitude")
    .optional({ nullable: true, checkFalsy: false })
    .custom((value) => {
      if (value === null || value === undefined || value === "") return true;
      const num = parseFloat(value);
      if (isNaN(num) || num < -180 || num > 180) {
        throw new Error("Longitude must be a number between -180 and 180");
      }
      return true;
    }),
  body("contactPhone")
    .optional({ nullable: true, checkFalsy: false })
    .custom((value) => {
      if (value === null || value === undefined || value === "") return true;
      if (typeof value !== "string" || value.trim().length < 10) {
        throw new Error("Phone number must be at least 10 characters");
      }
      return true;
    }),
  body("contactEmail")
    .optional({ nullable: true, checkFalsy: false })
    .custom((value) => {
      if (value === null || value === undefined || value === "") return true;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        throw new Error("Valid email is required");
      }
      return true;
    }),
  body("venueType")
    .optional()
    .isIn(Object.values(VenueType))
    .withMessage("Invalid venue type"),
  body("societyId")
    .optional({ nullable: true, checkFalsy: false })
    .custom((value) => {
      if (value === null || value === undefined || value === "") return true;
      const num = parseInt(value);
      if (isNaN(num) || num <= 0) {
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

router.delete(
  "/:id",
  validate(venueIdValidation),
  adminVenueController.deleteVenue
);

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

// Fixed sport validation
const addSportValidation = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("Venue ID must be a positive integer"),
  body("sportType")
    .notEmpty()
    .withMessage("Sport type is required")
    .isString()
    .withMessage("Sport type must be a string")
    .isLength({ min: 1, max: 50 })
    .withMessage("Sport type must be between 1 and 50 characters")
    .custom((value) => {
      // Allow any non-empty string, but trim whitespace
      const trimmed = value.trim();
      if (!trimmed) {
        throw new Error("Sport type cannot be empty or only whitespace");
      }
      return true;
    }),
  body("maxCourts")
    .isInt({ min: 1, max: 50 })
    .withMessage("Max courts must be between 1 and 50"),
];

router.post(
  "/:id/sports",
  validate(addSportValidation),
  venueSportsController.addSportToVenue
);

router.get(
  "/:id/sports",
  validate(venueIdValidation),
  venueSportsController.getVenueSports
);

const updateSportValidation = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("Venue ID must be a positive integer"),
  param("sportId")
    .isInt({ min: 1 })
    .withMessage("Sport ID must be a positive integer"),
  body("maxCourts")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Max courts must be between 1 and 50"),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),
];

router.put(
  "/:id/sports/:sportId",
  validate(updateSportValidation),
  venueSportsController.updateSportConfig
);

const removeSportValidation = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("Venue ID must be a positive integer"),
  param("sportId")
    .isInt({ min: 1 })
    .withMessage("Sport ID must be a positive integer"),
];

router.delete(
  "/:id/sports/:sportId",
  validate(removeSportValidation),
  venueSportsController.removeSportFromVenue
);

// Fixed court validation
const addCourtValidation = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("Venue ID must be a positive integer"),
  body("name")
    .notEmpty()
    .withMessage("Court name is required")
    .isLength({ min: 1, max: 100 })
    .withMessage("Court name must be between 1 and 100 characters")
    .trim(),
  body("sportType")
    .notEmpty()
    .withMessage("Sport type is required")
    .isString()
    .withMessage("Sport type must be a string")
    .isLength({ min: 1, max: 50 })
    .withMessage("Sport type must be between 1 and 50 characters"),
  body("pricePerHour")
    .isFloat({ min: 0 })
    .withMessage("Price per hour must be a positive number"),
  body("description")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Description must not exceed 500 characters")
    .trim(),
  body("timeSlots")
    .isArray({ min: 1 })
    .withMessage("At least one time slot is required"),
  body("timeSlots.*.dayOfWeek")
    .isInt({ min: 0, max: 6 })
    .withMessage("Day of week must be between 0 (Sunday) and 6 (Saturday)"),
  body("timeSlots.*.startTime")
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage("Start time must be in HH:MM format"),
  body("timeSlots.*.endTime")
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage("End time must be in HH:MM format"),
];

router.post(
  "/:id/courts",
  validate(addCourtValidation),
  venueSportsController.addCourtToVenue
);

const getCourtsValidation = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("Venue ID must be a positive integer"),
  query("sportType")
    .optional()
    .isString()
    .withMessage("Sport type must be a string"),
];

router.get(
  "/:id/courts",
  validate(getCourtsValidation),
  venueSportsController.getVenueCourts
);

const updateCourtValidation = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("Venue ID must be a positive integer"),
  param("courtId")
    .isInt({ min: 1 })
    .withMessage("Court ID must be a positive integer"),
  body("name")
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage("Court name must be between 1 and 100 characters")
    .trim(),
  body("pricePerHour")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Price per hour must be a positive number"),
  body("description")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Description must not exceed 500 characters")
    .trim(),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),
];

router.put(
  "/:id/courts/:courtId",
  validate(updateCourtValidation),
  venueSportsController.updateCourt
);

const courtIdValidation = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("Venue ID must be a positive integer"),
  param("courtId")
    .isInt({ min: 1 })
    .withMessage("Court ID must be a positive integer"),
];

router.delete(
  "/:id/courts/:courtId",
  validate(courtIdValidation),
  venueSportsController.deleteCourt
);

const addTimeSlotValidation = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("Venue ID must be a positive integer"),
  param("courtId")
    .isInt({ min: 1 })
    .withMessage("Court ID must be a positive integer"),
  body("dayOfWeek")
    .isInt({ min: 0, max: 6 })
    .withMessage("Day of week must be between 0 (Sunday) and 6 (Saturday)"),
  body("startTime")
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage("Start time must be in HH:MM format"),
  body("endTime")
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage("End time must be in HH:MM format"),
];

router.post(
  "/:id/courts/:courtId/timeslots",
  validate(addTimeSlotValidation),
  venueSportsController.addTimeSlotToCourt
);

const updateTimeSlotValidation = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("Venue ID must be a positive integer"),
  param("courtId")
    .isInt({ min: 1 })
    .withMessage("Court ID must be a positive integer"),
  param("slotId")
    .isInt({ min: 1 })
    .withMessage("Slot ID must be a positive integer"),
  body("dayOfWeek")
    .optional()
    .isInt({ min: 0, max: 6 })
    .withMessage("Day of week must be between 0 (Sunday) and 6 (Saturday)"),
  body("startTime")
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage("Start time must be in HH:MM format"),
  body("endTime")
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage("End time must be in HH:MM format"),
  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),
];

router.put(
  "/:id/courts/:courtId/timeslots/:slotId",
  validate(updateTimeSlotValidation),
  venueSportsController.updateTimeSlot
);

const timeSlotValidation = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("Venue ID must be a positive integer"),
  param("courtId")
    .isInt({ min: 1 })
    .withMessage("Court ID must be a positive integer"),
  param("slotId")
    .isInt({ min: 1 })
    .withMessage("Slot ID must be a positive integer"),
];

router.delete(
  "/:id/courts/:courtId/timeslots/:slotId",
  validate(timeSlotValidation),
  venueSportsController.deleteTimeSlot
);

export default router;