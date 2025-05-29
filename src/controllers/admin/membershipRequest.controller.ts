import { Request, Response } from "express";
import { MembershipRequestStatus } from "@prisma/client";
import { successResponse, errorResponse } from "../../utils/response";
import logger from "../../utils/logger";
import societyMembershipRequestService from "../../services/societyMembershipRequest.service";

export class AdminMembershipRequestController {
  /**
   * Create membership requests for a specific user (admin only)
   * @route POST /api/admin/membership-requests/create-for-user
   */
  async createMembershipRequestsForUser(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        errorResponse(res, "Unauthorized", 401);
        return;
      }

      // Only admins can create requests for other users
      if (req.user.role !== "ADMIN" && req.user.role !== "SUPERADMIN") {
        errorResponse(res, "Insufficient permissions", 403);
        return;
      }

      const { userId, societyIds } = req.body;

      if (
        !userId ||
        !societyIds ||
        !Array.isArray(societyIds) ||
        societyIds.length === 0
      ) {
        errorResponse(res, "User ID and society IDs are required", 400);
        return;
      }

      // Validate all IDs are numbers
      const validSocietyIds = societyIds.filter(
        (id) => Number.isInteger(Number(id)) && Number(id) > 0
      );
      if (validSocietyIds.length !== societyIds.length) {
        errorResponse(res, "All society IDs must be positive integers", 400);
        return;
      }

      if (!Number.isInteger(Number(userId)) || Number(userId) <= 0) {
        errorResponse(res, "Valid user ID is required", 400);
        return;
      }

      console.log(
        `Admin ${req.user.userId} creating membership requests for user ${userId} to societies:`,
        validSocietyIds
      );

      const result =
        await societyMembershipRequestService.createMembershipRequests({
          userId: Number(userId),
          societyIds: validSocietyIds.map((id) => Number(id)),
        });

      successResponse(
        res,
        result,
        `Membership requests created successfully for user ${userId}`,
        201
      );
    } catch (error: any) {
      logger.error("Error creating membership requests for user:", error);
      errorResponse(
        res,
        error.message || "Error creating membership requests",
        400
      );
    }
  }

  /**
   * Get all membership requests with pagination and filters
   * @route GET /api/admin/membership-requests
   */
  async getAllMembershipRequests(req: Request, res: Response): Promise<void> {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;
      const status = req.query.status as MembershipRequestStatus | undefined;
      const societyId = req.query.societyId
        ? Number(req.query.societyId)
        : undefined;

      const result =
        await societyMembershipRequestService.getAllMembershipRequests({
          status,
          societyId,
          page,
          limit,
        });

      successResponse(
        res,
        result,
        "Membership requests retrieved successfully"
      );
    } catch (error: any) {
      logger.error("Error getting membership requests:", error);
      errorResponse(
        res,
        error.message || "Error retrieving membership requests",
        500
      );
    }
  }

  /**
   * Get pending membership requests
   * @route GET /api/admin/membership-requests/pending
   */
  async getPendingMembershipRequests(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const societyId = req.query.societyId
        ? Number(req.query.societyId)
        : undefined;
      const userId = req.query.userId ? Number(req.query.userId) : undefined;

      const requests =
        await societyMembershipRequestService.getPendingMembershipRequests({
          societyId,
          userId,
        });

      successResponse(
        res,
        requests,
        "Pending membership requests retrieved successfully"
      );
    } catch (error: any) {
      logger.error("Error getting pending membership requests:", error);
      errorResponse(
        res,
        error.message || "Error retrieving pending requests",
        500
      );
    }
  }

  /**
   * Review membership request (approve/reject)
   * @route POST /api/admin/membership-requests/:id/review
   */
  async reviewMembershipRequest(req: Request, res: Response): Promise<void> {
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

      const { status, reviewNote } = req.body;

      if (!status || !Object.values(MembershipRequestStatus).includes(status)) {
        errorResponse(
          res,
          "Valid status is required (APPROVED, REJECTED)",
          400
        );
        return;
      }

      if (status === MembershipRequestStatus.PENDING) {
        errorResponse(res, "Cannot set status back to PENDING", 400);
        return;
      }

      const reviewedRequest =
        await societyMembershipRequestService.reviewMembershipRequest({
          requestId,
          status,
          reviewedBy: req.user.userId,
          reviewNote,
        });

      const action =
        status === MembershipRequestStatus.APPROVED ? "approved" : "rejected";
      successResponse(
        res,
        reviewedRequest,
        `Membership request ${action} successfully`
      );
    } catch (error: any) {
      logger.error("Error reviewing membership request:", error);
      errorResponse(
        res,
        error.message || "Error reviewing membership request",
        400
      );
    }
  }

  /**
   * Bulk review membership requests
   * @route POST /api/admin/membership-requests/bulk-review
   */
  async bulkReviewMembershipRequests(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      if (!req.user) {
        errorResponse(res, "Unauthorized", 401);
        return;
      }

      const { requestIds, status, reviewNote } = req.body;

      if (
        !requestIds ||
        !Array.isArray(requestIds) ||
        requestIds.length === 0
      ) {
        errorResponse(res, "Request IDs array is required", 400);
        return;
      }

      if (!status || !Object.values(MembershipRequestStatus).includes(status)) {
        errorResponse(
          res,
          "Valid status is required (APPROVED, REJECTED)",
          400
        );
        return;
      }

      if (status === MembershipRequestStatus.PENDING) {
        errorResponse(res, "Cannot set status back to PENDING", 400);
        return;
      }

      // Validate all IDs are numbers
      const validIds = requestIds.filter(
        (id) => Number.isInteger(Number(id)) && Number(id) > 0
      );
      if (validIds.length !== requestIds.length) {
        errorResponse(res, "All request IDs must be positive integers", 400);
        return;
      }

      const result = await societyMembershipRequestService.bulkReviewRequests(
        validIds.map((id) => Number(id)),
        status,
        req.user.userId,
        reviewNote
      );

      const action =
        status === MembershipRequestStatus.APPROVED ? "approved" : "rejected";
      successResponse(
        res,
        result,
        `${result.processed} membership requests ${action} successfully`
      );
    } catch (error: any) {
      logger.error("Error bulk reviewing membership requests:", error);
      errorResponse(res, error.message || "Error processing bulk review", 400);
    }
  }

  /**
   * Get membership request statistics
   * @route GET /api/admin/membership-requests/statistics
   */
  async getMembershipRequestStatistics(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const societyId = req.query.societyId
        ? Number(req.query.societyId)
        : undefined;

      const statistics =
        await societyMembershipRequestService.getMembershipRequestStatistics(
          societyId
        );

      successResponse(
        res,
        statistics,
        "Membership request statistics retrieved successfully"
      );
    } catch (error: any) {
      logger.error("Error getting membership request statistics:", error);
      errorResponse(res, error.message || "Error retrieving statistics", 500);
    }
  }

  /**
   * Get membership requests by user (for admin to see user's history)
   * @route GET /api/admin/users/:userId/membership-requests
   */
  async getUserMembershipRequests(req: Request, res: Response): Promise<void> {
    try {
      const userId = Number(req.params.userId);

      if (isNaN(userId)) {
        errorResponse(res, "Invalid user ID", 400);
        return;
      }

      const requests =
        await societyMembershipRequestService.getUserMembershipRequests(userId);

      successResponse(
        res,
        requests,
        "User membership requests retrieved successfully"
      );
    } catch (error: any) {
      logger.error("Error getting user membership requests:", error);
      errorResponse(
        res,
        error.message || "Error retrieving user requests",
        500
      );
    }
  }
}

export default new AdminMembershipRequestController();
