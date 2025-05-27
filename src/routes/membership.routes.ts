import express from "express";
import { body, param, query } from "express-validator";
import { membershipController } from "../controllers/admin/membership.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";

const userRouter = express.Router();

userRouter.use(authenticate);

const getAvailablePackagesValidation = [
  query("venueId")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Venue ID must be a positive integer"),
];

userRouter.get(
  "/packages",
  validate(getAvailablePackagesValidation),
  membershipController.getAvailablePackages
);

// Get user's memberships
const getMyMembershipsValidation = [
  query("includeExpired")
    .optional()
    .isBoolean()
    .withMessage("includeExpired must be a boolean"),
];

userRouter.get(
  "/my-memberships",
  validate(getMyMembershipsValidation),
  membershipController.getMyMemberships
);

// Purchase membership
const purchaseMembershipValidation = [
  body("packageId")
    .isInt({ min: 1 })
    .withMessage("Package ID must be a positive integer"),
  body("autoRenew")
    .optional()
    .isBoolean()
    .withMessage("Auto renew must be a boolean"),
  body("paymentMethod").isString().withMessage("Payment method is required"),
  body("paymentReference")
    .optional()
    .isString()
    .withMessage("Payment reference must be a string"),
];

userRouter.post(
  "/purchase",
  validate(purchaseMembershipValidation),
  membershipController.purchaseMembership
);

// Cancel membership
const cancelMyMembershipValidation = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("Membership ID must be a positive integer"),
  body("reason").optional().isString().withMessage("Reason must be a string"),
];

userRouter.post(
  "/cancel/:id",
  validate(cancelMyMembershipValidation),
  membershipController.cancelMyMembership
);

export { userRouter as membershipRoutes };
