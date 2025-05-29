import { Request, Response } from "express";
import { successResponse, errorResponse } from "../utils/response";
import logger from "../utils/logger";
import societyMembershipRequestService from "../services/societyMembershipRequest.service";

export class UserMembershipRequestController {
  /**
   * Create membership requests for selected societies
   * @route POST /api/users/membership-requests
   */
  async createMembershipRequests(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        errorResponse(res, "Unauthorized", 401);
        return;
      }

      const { societyIds } = req.body;

      if (
        !societyIds ||
        !Array.isArray(societyIds) ||
        societyIds.length === 0
      ) {
        errorResponse(res, "At least one society must be selected", 400);
        return;
      }

      // Validate all IDs are numbers
      const validIds = societyIds.filter(
        (id) => Number.isInteger(Number(id)) && Number(id) > 0
      );
      if (validIds.length !== societyIds.length) {
        errorResponse(res, "All society IDs must be positive integers", 400);
        return;
      }

      const result =
        await societyMembershipRequestService.createMembershipRequests({
          userId: req.user.userId,
          societyIds: validIds.map((id) => Number(id)),
        });

      successResponse(res, result, result.message, 201);
    } catch (error: any) {
      logger.error("Error creating membership requests:", error);
      errorResponse(
        res,
        error.message || "Error creating membership requests",
        400
      );
    }
  }

  /**
   * Get user's membership requests
   * @route GET /api/users/membership-requests
   */
  async getMyMembershipRequests(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        errorResponse(res, "Unauthorized", 401);
        return;
      }

      const requests =
        await societyMembershipRequestService.getUserMembershipRequests(
          req.user.userId
        );

      successResponse(
        res,
        requests,
        "Your membership requests retrieved successfully"
      );
    } catch (error: any) {
      logger.error("Error getting user membership requests:", error);
      errorResponse(
        res,
        error.message || "Error retrieving your requests",
        500
      );
    }
  }

  /**
   * Cancel pending membership request
   * @route DELETE /api/users/membership-requests/:id
   */
  async cancelMembershipRequest(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        errorResponse(res, "Unauthorized", 401);
        return;
      }

      const requestId = Number(req.params.id);

      if (isNaN(requestId)) {
        errorResponse(res, "Invalid request ID", 400);
        return;
      }

      await societyMembershipRequestService.cancelMembershipRequest(
        requestId,
        req.user.userId
      );

      successResponse(res, null, "Membership request cancelled successfully");
    } catch (error: any) {
      logger.error("Error cancelling membership request:", error);
      errorResponse(res, error.message || "Error cancelling request", 400);
    }
  }
}

export default new UserMembershipRequestController();
