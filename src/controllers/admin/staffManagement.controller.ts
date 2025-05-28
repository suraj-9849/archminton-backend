import { Request, Response } from "express";
import staffManagementService, {
  CreateStaffInput,
  UpdateStaffInput,
} from "../../services/staffManagement.service";
import { successResponse, errorResponse } from "../../utils/response";
import logger from "../../utils/logger";

/**
 * Controller for staff management operations
 */
export class StaffManagementController {
  /**
   * Get all staff members for a venue
   * @route GET /api/admin/venues/:venueId/staff
   */
  async getVenueStaff(req: Request, res: Response): Promise<void> {
    try {
      const venueId = parseInt(req.params.venueId, 10);

      if (isNaN(venueId) || venueId <= 0) {
        errorResponse(res, "Invalid venue ID", 400);
        return;
      }

      const includeInactive = req.query.includeInactive === "true";
      const staff = await staffManagementService.getVenueStaff(
        venueId,
        includeInactive
      );

      successResponse(res, staff, "Staff members retrieved successfully");
    } catch (error: any) {
      logger.error("Error getting venue staff:", error);
      errorResponse(
        res,
        error.message || "Error retrieving staff members",
        500
      );
    }
  }

  /**
   * Create new staff member for a venue
   * @route POST /api/admin/venues/:venueId/staff
   */
  async createStaff(req: Request, res: Response): Promise<void> {
    try {
      const venueId = parseInt(req.params.venueId, 10);

      if (isNaN(venueId) || venueId <= 0) {
        errorResponse(res, "Invalid venue ID", 400);
        return;
      }

      const staffData: CreateStaffInput = {
        ...req.body,
        venueId,
      };

      const newStaff = await staffManagementService.createStaff(staffData);

      successResponse(res, newStaff, "Staff member created successfully", 201);
    } catch (error: any) {
      logger.error("Error creating staff member:", error);
      errorResponse(res, error.message || "Error creating staff member", 400);
    }
  }

  /**
   * Get staff member details
   * @route GET /api/admin/venues/:venueId/staff/:userId
   */
  async getStaffById(req: Request, res: Response): Promise<void> {
    try {
      const venueId = parseInt(req.params.venueId, 10);
      const userId = parseInt(req.params.userId, 10);

      if (isNaN(venueId) || venueId <= 0) {
        errorResponse(res, "Invalid venue ID", 400);
        return;
      }

      if (isNaN(userId) || userId <= 0) {
        errorResponse(res, "Invalid user ID", 400);
        return;
      }

      const staff = await staffManagementService.getStaffById(userId, venueId);

      successResponse(
        res,
        staff,
        "Staff member details retrieved successfully"
      );
    } catch (error: any) {
      logger.error("Error getting staff details:", error);
      errorResponse(
        res,
        error.message || "Error retrieving staff details",
        error.message.includes("not found") ? 404 : 500
      );
    }
  }

  /**
   * Update staff member information
   * @route PUT /api/admin/venues/:venueId/staff/:userId
   */
  async updateStaff(req: Request, res: Response): Promise<void> {
    try {
      const venueId = parseInt(req.params.venueId, 10);
      const userId = parseInt(req.params.userId, 10);

      if (isNaN(venueId) || venueId <= 0) {
        errorResponse(res, "Invalid venue ID", 400);
        return;
      }

      if (isNaN(userId) || userId <= 0) {
        errorResponse(res, "Invalid user ID", 400);
        return;
      }

      const updateData: UpdateStaffInput = req.body;
      const updatedStaff = await staffManagementService.updateStaff(
        userId,
        venueId,
        updateData
      );

      successResponse(res, updatedStaff, "Staff member updated successfully");
    } catch (error: any) {
      logger.error("Error updating staff member:", error);
      errorResponse(
        res,
        error.message || "Error updating staff member",
        error.message.includes("not found") ? 404 : 400
      );
    }
  }

  /**
   * Remove staff member from venue
   * @route DELETE /api/admin/venues/:venueId/staff/:userId
   */
  async removeStaff(req: Request, res: Response): Promise<void> {
    try {
      const venueId = parseInt(req.params.venueId, 10);
      const userId = parseInt(req.params.userId, 10);

      if (isNaN(venueId) || venueId <= 0) {
        errorResponse(res, "Invalid venue ID", 400);
        return;
      }

      if (isNaN(userId) || userId <= 0) {
        errorResponse(res, "Invalid user ID", 400);
        return;
      }

      // Prevent removing yourself
      if (req.user && req.user.userId === userId) {
        errorResponse(res, "You cannot remove yourself from the venue", 403);
        return;
      }

      const result = await staffManagementService.removeStaff(userId, venueId);

      successResponse(res, result, "Staff member removed successfully");
    } catch (error: any) {
      logger.error("Error removing staff member:", error);
      errorResponse(
        res,
        error.message || "Error removing staff member",
        error.message.includes("not found") ? 404 : 400
      );
    }
  }

  /**
   * Update staff permissions
   * @route PATCH /api/admin/venues/:venueId/staff/:userId/permissions
   */
  async updateStaffPermissions(req: Request, res: Response): Promise<void> {
    try {
      const venueId = parseInt(req.params.venueId, 10);
      const userId = parseInt(req.params.userId, 10);

      if (isNaN(venueId) || venueId <= 0) {
        errorResponse(res, "Invalid venue ID", 400);
        return;
      }

      if (isNaN(userId) || userId <= 0) {
        errorResponse(res, "Invalid user ID", 400);
        return;
      }

      const { permissions } = req.body;

      if (!Array.isArray(permissions)) {
        errorResponse(res, "Permissions must be an array", 400);
        return;
      }

      const updatedStaff = await staffManagementService.updateStaffPermissions(
        userId,
        venueId,
        permissions
      );

      successResponse(
        res,
        updatedStaff,
        "Staff permissions updated successfully"
      );
    } catch (error: any) {
      logger.error("Error updating staff permissions:", error);
      errorResponse(
        res,
        error.message || "Error updating staff permissions",
        error.message.includes("not found") ? 404 : 400
      );
    }
  }

  /**
   * Get available permissions
   * @route GET /api/admin/venues/permissions
   */
  async getAvailablePermissions(req: Request, res: Response): Promise<void> {
    try {
      console.log("🔍 Getting available permissions - no venue ID required");
      const permissions =
        await staffManagementService.getAvailablePermissions();

      successResponse(
        res,
        permissions,
        "Available permissions retrieved successfully"
      );
    } catch (error: any) {
      logger.error("Error getting available permissions:", error);
      errorResponse(res, error.message || "Error retrieving permissions", 500);
    }
  }

  /**
   * Check if user has specific permission for venue
   * @route GET /api/admin/venues/:venueId/staff/:userId/permissions/:permission
   */
  async checkPermission(req: Request, res: Response): Promise<void> {
    try {
      const venueId = parseInt(req.params.venueId, 10);
      const userId = parseInt(req.params.userId, 10);
      const permission = req.params.permission;

      if (isNaN(venueId) || venueId <= 0) {
        errorResponse(res, "Invalid venue ID", 400);
        return;
      }

      if (isNaN(userId) || userId <= 0) {
        errorResponse(res, "Invalid user ID", 400);
        return;
      }

      const hasPermission = await staffManagementService.hasPermission(
        userId,
        venueId,
        permission
      );

      successResponse(res, { hasPermission }, "Permission check completed");
    } catch (error: any) {
      logger.error("Error checking permission:", error);
      errorResponse(res, error.message || "Error checking permission", 500);
    }
  }

  /**
   * Get staff statistics for a venue
   * @route GET /api/admin/venues/:venueId/staff/statistics
   */
  async getStaffStatistics(req: Request, res: Response): Promise<void> {
    try {
      const venueId = parseInt(req.params.venueId, 10);

      if (isNaN(venueId) || venueId <= 0) {
        errorResponse(res, "Invalid venue ID", 400);
        return;
      }

      const statistics = await staffManagementService.getStaffStatistics(
        venueId
      );

      successResponse(
        res,
        statistics,
        "Staff statistics retrieved successfully"
      );
    } catch (error: any) {
      logger.error("Error getting staff statistics:", error);
      errorResponse(
        res,
        error.message || "Error retrieving staff statistics",
        500
      );
    }
  }
}

export default new StaffManagementController();
