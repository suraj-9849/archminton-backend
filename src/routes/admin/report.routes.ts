import express from "express";
import { query } from "express-validator";
import adminReportController from "../../controllers/admin/report.controller";
import { authenticate, adminOnly } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";

const router = express.Router();

router.use(authenticate);
router.use(adminOnly);

const reportFiltersValidation = [
  query("fromDate")
    .notEmpty()
    .withMessage("fromDate is required")
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage("fromDate must be in YYYY-MM-DD format"),

  query("toDate")
    .notEmpty()
    .withMessage("toDate is required")
    .matches(/^\d{4}-\d{2}-\d{2}$/)
    .withMessage("toDate must be in YYYY-MM-DD format"),

  query("venueId")
    .optional()
    .isInt({ min: 1 })
    .withMessage("venueId must be a positive integer"),

  query("period")
    .optional()
    .isIn(["Range", "Single Day", "This Week", "This Month", "Last Month"])
    .withMessage("Invalid period value"),

  query("dateRangeFor")
    .optional()
    .isIn(["Transaction Date", "Booking Date", "Created Date"])
    .withMessage("Invalid dateRangeFor value"),

  query("handler")
    .optional()
    .isString()
    .withMessage("handler must be a string"),

  query("show")
    .optional()
    .isIn(["All", "Bookings Only", "Payments Only", "Refunds Only"])
    .withMessage("Invalid show value"),

  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage("limit must be between 1 and 1000"),
];

// Optional validation for venue access
const venueAccessValidation = [
  query("venueId")
    .optional()
    .isInt({ min: 1 })
    .withMessage("venueId must be a positive integer"),
];

// UTILITY ROUTES
router.get(
  "/handlers",
  validate(venueAccessValidation),
  adminReportController.getHandlers
);
router.get(
  "/stats",
  validate(venueAccessValidation),
  adminReportController.getReportStats
);

// MASTER REPORT ROUTES
router.get(
  "/master",
  validate(reportFiltersValidation),
  adminReportController.getMasterReport
);
router.get(
  "/master/download",
  validate(reportFiltersValidation),
  adminReportController.downloadMasterReport
);

// BOOKING REPORT ROUTES
router.get(
  "/bookings",
  validate(reportFiltersValidation),
  adminReportController.getBookingReport
);
router.get(
  "/bookings/download",
  validate(reportFiltersValidation),
  adminReportController.downloadBookingReport
);

// BALANCE REPORT ROUTES
router.get(
  "/balance",
  validate(reportFiltersValidation),
  adminReportController.getBalanceReport
);
router.get(
  "/balance/download",
  validate(reportFiltersValidation),
  adminReportController.downloadBalanceReport
);

// CANCELLATION REPORT ROUTES
router.get(
  "/cancellations",
  validate(reportFiltersValidation),
  adminReportController.getCancellationReport
);
router.get(
  "/cancellations/download",
  validate(reportFiltersValidation),
  adminReportController.downloadCancellationReport
);

// RECHARGE REPORT ROUTES
router.get(
  "/recharges",
  validate(reportFiltersValidation),
  adminReportController.getRechargeReport
);
router.get(
  "/recharges/download",
  validate(reportFiltersValidation),
  adminReportController.downloadRechargeReport
);

// CREDITS REPORT ROUTES
router.get(
  "/credits",
  validate(reportFiltersValidation),
  adminReportController.getCreditsReport
);
router.get(
  "/credits/download",
  validate(reportFiltersValidation),
  adminReportController.downloadCreditsReport
);

// ADDON REPORT ROUTES
router.get(
  "/addons",
  validate(reportFiltersValidation),
  adminReportController.getAddonReport
);
router.get(
  "/addons/download",
  validate(reportFiltersValidation),
  adminReportController.downloadAddonReport
);

export default router;
