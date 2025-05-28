import express from "express";
import { body, param, query } from "express-validator";
import adminHolidayController from "../../controllers/admin/holiday.controller";
import { authenticate, adminOnly } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";

const router = express.Router();

router.use(authenticate);
router.use(adminOnly);

const getUpcomingValidation = [
  query("venueId")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Venue ID must be a positive integer"),
  query("days")
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage("Days must be between 1 and 365"),
];

router.get(
  "/upcoming",
  validate(getUpcomingValidation),
  adminHolidayController.getUpcomingHolidays
);

const checkHolidayValidation = [
  param("date")
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage("Date must be in YYYY-MM-DD format"),
  query("venueId")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Venue ID must be a positive integer"),
];

router.get(
  "/check/:date",
  validate(checkHolidayValidation),
  adminHolidayController.checkHoliday
);

const getHolidaysValidation = [
  query("venueId")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Venue ID must be a positive integer"),
  query("includeInactive")
    .optional()
    .isBoolean()
    .withMessage("includeInactive must be a boolean"),
];

router.get(
  "/",
  validate(getHolidaysValidation),
  adminHolidayController.getAllHolidays
);

const createHolidayValidation = [
  body("name")
    .notEmpty()
    .withMessage("Holiday name is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters"),
  body("date")
    .isISO8601()
    .withMessage("Date must be a valid ISO date (YYYY-MM-DD)"),
  body("venueId")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Venue ID must be a positive integer"),
  body("multiplier")
    .optional()
    .isFloat({ min: 1, max: 10 })
    .withMessage("Multiplier must be between 1 and 10"),
  body("description")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Description must not exceed 500 characters"),
];

router.post(
  "/",
  validate(createHolidayValidation),
  adminHolidayController.createHoliday
);

const holidayIdValidation = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("Holiday ID must be a positive integer"),
];

router.get(
  "/:id",
  validate(holidayIdValidation),
  adminHolidayController.getHolidayById
);

const updateHolidayValidation = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("Holiday ID must be a positive integer"),
  body("name")
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters"),
  body("date")
    .optional()
    .isISO8601()
    .withMessage("Date must be a valid ISO date (YYYY-MM-DD)"),
  body("multiplier")
    .optional()
    .isFloat({ min: 1, max: 10 })
    .withMessage("Multiplier must be between 1 and 10"),
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
  "/:id",
  validate(updateHolidayValidation),
  adminHolidayController.updateHoliday
);

router.delete(
  "/:id",
  validate(holidayIdValidation),
  adminHolidayController.deleteHoliday
);

export default router;
