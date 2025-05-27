import express from "express";
import { body, param, query } from "express-validator";
import adminVenueController from "../../controllers/admin/venue.controller";
import venueSportsController from "../../controllers/admin/venueSports.controller";
import { authenticate, adminOnly } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { VenueType, SportType } from "@prisma/client";

const router = express.Router();

router.get("/test", (req, res) => {
  res.json({
    message: "Admin venue routes working!",
  });
}
);

// All routes require authentication and admin access
router.use(authenticate);
router.use(adminOnly);

// ================ VENUE MANAGEMENT ROUTES ================

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

// ================ VENUE ACCESS MANAGEMENT ================

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

// ================ SPORTS CONFIGURATION ROUTES ================

// Add sport to venue
const addSportValidation = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("Venue ID must be a positive integer"),
  body("sportType")
    .isIn(Object.values(SportType))
    .withMessage("Valid sport type is required"),
  body("maxCourts")
    .isInt({ min: 1, max: 50 })
    .withMessage("Max courts must be between 1 and 50"),
];

router.post(
  "/:id/sports",
  validate(addSportValidation),
  venueSportsController.addSportToVenue
);

// Get venue sports
router.get(
  "/:id/sports",
  validate(venueIdValidation),
  venueSportsController.getVenueSports
);

// Update sport configuration
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

// Remove sport from venue
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

// ================ COURT MANAGEMENT ROUTES ================

// Add court to venue
const addCourtValidation = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("Venue ID must be a positive integer"),
  body("name")
    .notEmpty()
    .withMessage("Court name is required")
    .isLength({ min: 1, max: 100 })
    .withMessage("Court name must be between 1 and 100 characters"),
  body("sportType")
    .isIn(Object.values(SportType))
    .withMessage("Valid sport type is required"),
  body("pricePerHour")
    .isFloat({ min: 0 })
    .withMessage("Price per hour must be a positive number"),
  body("description")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Description must not exceed 500 characters"),
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

// Get venue courts
const getCourtsValidation = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("Venue ID must be a positive integer"),
  query("sportType")
    .optional()
    .isIn(Object.values(SportType))
    .withMessage("Invalid sport type"),
];

router.get(
  "/:id/courts",
  validate(getCourtsValidation),
  venueSportsController.getVenueCourts
);

// Update court
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
    .withMessage("Court name must be between 1 and 100 characters"),
  body("pricePerHour")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Price per hour must be a positive number"),
  body("description")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Description must not exceed 500 characters"),
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

// Delete court
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

// ================ TIME SLOT MANAGEMENT ROUTES ================

// Add time slot to court
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

// Update time slot
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

// Delete time slot
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