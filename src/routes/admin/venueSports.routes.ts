import express from "express";
import { body, param, query } from "express-validator";
import venueSportsController from "../../controllers/admin/venueSports.controller";
import { authenticate, adminOnly } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { SportType } from "@prisma/client";

const router = express.Router();

// All routes require authentication and admin access
router.use(authenticate);
router.use(adminOnly);

// Venue ID validation
const venueIdValidation = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("Venue ID must be a positive integer"),
];

// Court ID validation
const courtIdValidation = [
  param("courtId")
    .isInt({ min: 1 })
    .withMessage("Court ID must be a positive integer"),
];

// Time slot ID validation
const slotIdValidation = [
  param("slotId")
    .isInt({ min: 1 })
    .withMessage("Slot ID must be a positive integer"),
];

// Add sport to venue
const addSportValidation = [
  ...venueIdValidation,
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
  ...venueIdValidation,
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
  ...venueIdValidation,
  param("sportId")
    .isInt({ min: 1 })
    .withMessage("Sport ID must be a positive integer"),
];

router.delete(
  "/:id/sports/:sportId",
  validate(removeSportValidation),
  venueSportsController.removeSportFromVenue
);

// Add court to venue
const addCourtValidation = [
  ...venueIdValidation,
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
  ...venueIdValidation,
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
  ...venueIdValidation,
  ...courtIdValidation,
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
router.delete(
  "/:id/courts/:courtId",
  validate([...venueIdValidation, ...courtIdValidation]),
  venueSportsController.deleteCourt
);

// Add time slot to court
const addTimeSlotValidation = [
  ...venueIdValidation,
  ...courtIdValidation,
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
  ...venueIdValidation,
  ...courtIdValidation,
  ...slotIdValidation,
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
router.delete(
  "/:id/courts/:courtId/timeslots/:slotId",
  validate([...venueIdValidation, ...courtIdValidation, ...slotIdValidation]),
  venueSportsController.deleteTimeSlot
);

export default router;