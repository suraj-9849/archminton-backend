import express from "express";
import { body, param, query } from "express-validator";
import adminBookingController from "../../controllers/admin/booking.controller";
import { authenticate, adminOnly } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { BookingStatus, PaymentStatus, SportType, Role } from "@prisma/client";

const router = express.Router();

router.use(authenticate);
router.use(adminOnly);

const getStatisticsValidation = [
  query("fromDate")
    .optional()
    .isISO8601()
    .withMessage("From date must be a valid ISO date"),
  query("toDate")
    .optional()
    .isISO8601()
    .withMessage("To date must be a valid ISO date"),
];

router.get(
  "/statistics",
  validate(getStatisticsValidation),
  adminBookingController.getBookingStatistics
);
const getBookingsValidation = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),
  query("status")
    .optional()
    .isIn(Object.values(BookingStatus))
    .withMessage("Invalid booking status"),
  query("paymentStatus")
    .optional()
    .isIn(Object.values(PaymentStatus))
    .withMessage("Invalid payment status"),
  query("venueId")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Venue ID must be a positive integer"),
  query("userId")
    .optional()
    .isInt({ min: 1 })
    .withMessage("User ID must be a positive integer"),
  query("fromDate")
    .optional()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage("From date must be in YYYY-MM-DD format"),
  query("toDate")
    .optional()
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage("To date must be in YYYY-MM-DD format"),
];
router.get(
  "/",
  validate(getBookingsValidation),
  adminBookingController.getAllBookings
);

const bulkAvailabilityValidation = [
  body("sportType")
    .isIn(Object.values(SportType))
    .withMessage("Invalid sport type"),
  body("venueId")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Venue ID must be a positive integer"),
  body("courts").optional().isArray().withMessage("Courts must be an array"),
  body("courts.*")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Court IDs must be positive integers"),
  body("fromDate")
    .isISO8601()
    .withMessage("From date must be in ISO format (YYYY-MM-DD)"),
  body("toDate")
    .isISO8601()
    .withMessage("To date must be in ISO format (YYYY-MM-DD)")
    .custom((value, { req }) => {
      if (new Date(value) < new Date(req.body.fromDate)) {
        throw new Error("To date must be after or equal to from date");
      }
      return true;
    }),
  body("days")
    .isArray({ min: 1 })
    .withMessage("Days must be a non-empty array"),
  body("days.*")
    .isInt({ min: 0, max: 6 })
    .withMessage("Days must be integers between 0 (Sunday) and 6 (Saturday)"),
  body("timeSlots")
    .isArray({ min: 1 })
    .withMessage("Time slots must be a non-empty array"),
  body("timeSlots.*.startTime")
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage("Start time must be in HH:MM format"),
  body("timeSlots.*.endTime")
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage("End time must be in HH:MM format")
    .custom((value, { req }) => {
      const timeSlotIndex = req.body.timeSlots.findIndex(
        (slot: any) => slot.endTime === value
      );
      if (timeSlotIndex !== -1) {
        const startTime = req.body.timeSlots[timeSlotIndex].startTime;
        if (value <= startTime) {
          throw new Error("End time must be after start time");
        }
      }
      return true;
    }),
];

// Add this to your admin booking routes file
const createBookingValidation = [
  body("courtId")
    .isInt({ min: 1 })
    .withMessage("Court ID must be a positive integer"),
  body("timeSlotId")
    .isInt({ min: 1 })
    .withMessage("Time slot ID must be a positive integer"),
  body("bookingDate")
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage("Booking date must be in YYYY-MM-DD format"),
  body("userId")
    .optional()
    .isInt({ min: 1 })
    .withMessage("User ID must be a positive integer"),
  body("addOns").optional().isArray().withMessage("Add-ons must be an array"),
];

// Add this route BEFORE your router.get("/:id", ...) route

const bulkBookingValidation = [
  body("sportType")
    .isIn(Object.values(SportType))
    .withMessage("Invalid sport type"),
  body("venueId")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Venue ID must be a positive integer"),
  body("courts").optional().isArray().withMessage("Courts must be an array"),
  body("courts.*")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Court IDs must be positive integers"),
  body("fromDate")
    .isISO8601()
    .withMessage("From date must be in ISO format (YYYY-MM-DD)")
    .custom((value) => {
      const date = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (date < today) {
        throw new Error("From date cannot be in the past");
      }
      return true;
    }),
  body("toDate")
    .isISO8601()
    .withMessage("To date must be in ISO format (YYYY-MM-DD)")
    .custom((value, { req }) => {
      const fromDate = new Date(req.body.fromDate);
      const toDate = new Date(value);

      if (toDate < fromDate) {
        throw new Error("To date must be after or equal to from date");
      }

      const daysDifference = Math.ceil(
        (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysDifference > 90) {
        throw new Error("Date range cannot exceed 90 days");
      }

      return true;
    }),
  body("days")
    .isArray({ min: 1 })
    .withMessage("Days must be a non-empty array"),
  body("days.*")
    .isInt({ min: 0, max: 6 })
    .withMessage("Days must be integers between 0 (Sunday) and 6 (Saturday)"),
  body("timeSlots")
    .isArray({ min: 1, max: 20 })
    .withMessage("Time slots must be a non-empty array with maximum 20 slots"),
  body("timeSlots.*.startTime")
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage("Start time must be in HH:MM format"),
  body("timeSlots.*.endTime")
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage("End time must be in HH:MM format")
    .custom((value, { req }) => {
      const timeSlotIndex = req.body.timeSlots.findIndex(
        (slot: any) => slot.endTime === value
      );
      if (timeSlotIndex !== -1) {
        const startTime = req.body.timeSlots[timeSlotIndex].startTime;
        if (value <= startTime) {
          throw new Error("End time must be after start time");
        }
      }
      return true;
    }),
  body("ignoreUnavailable")
    .optional()
    .isBoolean()
    .withMessage("Ignore unavailable must be a boolean"),
  body("userId")
    .optional()
    .isInt({ min: 1 })
    .withMessage("User ID must be a positive integer"),
];

const canCreateBulkBookings = (req: any, res: any, next: any) => {
  if (
    req.user?.role === Role.ADMIN ||
    req.user?.role === Role.SUPERADMIN ||
    req.user?.role === Role.VENUE_MANAGER
  ) {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: "You are not authorized to create bulk bookings",
  });
};
router.post(
  "/",
  validate(createBookingValidation),
  adminBookingController.createBooking
);

router.post(
  "/bulk-availability",
  validate(bulkAvailabilityValidation),
  adminBookingController.checkBulkAvailability
);
router.post(
  "/bulk",
  canCreateBulkBookings,
  validate(bulkBookingValidation),
  adminBookingController.createBulkBooking
);

const bookingIdValidation = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("Booking ID must be a positive integer"),
];

const updateStatusValidation = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("Booking ID must be a positive integer"),
  body("status")
    .isIn(Object.values(BookingStatus))
    .withMessage("Valid booking status is required"),
];

router.patch(
  "/:id/status",
  validate(updateStatusValidation),
  adminBookingController.updateBookingStatus
);

router.get(
  "/:id",
  validate(bookingIdValidation),
  adminBookingController.getBookingById
);
const updatePaymentStatusValidation = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("Booking ID must be a positive integer"),
  body("paymentStatus")
    .isIn(Object.values(PaymentStatus))
    .withMessage("Valid payment status is required"),
];

router.patch(
  "/:id/payment-status",
  validate(updatePaymentStatusValidation),
  adminBookingController.updatePaymentStatus
);

const cancelBookingValidation = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("Booking ID must be a positive integer"),
  body("reason").optional().isString().withMessage("Reason must be a string"),
];

router.post(
  "/:id/cancel",
  validate(cancelBookingValidation),
  adminBookingController.cancelBooking
);

export default router;
