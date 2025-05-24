import { Request, Response } from "express";
import courtService from "../../services/court.service";
import { successResponse, errorResponse } from "../../utils/response";
import logger from "../../utils/logger";
import { SportType } from "@prisma/client";

/**
 * Admin controller for court management
 */
export class AdminCourtController {
  /**
   * Get all courts (admin view with pagination)
   * @route GET /api/admin/courts
   */
  async getAllCourts(req: Request, res: Response): Promise<void> {
    try {
      const venueId = req.query.venueId ? Number(req.query.venueId) : undefined;
      const sportType = req.query.sportType as SportType | undefined;
      const isActive =
        req.query.isActive !== undefined
          ? req.query.isActive === "true"
          : undefined;
      const search = req.query.search as string | undefined;

      const courts = await courtService.getAllCourts({
        venueId,
        sportType,
        isActive,
        search,
      });

      successResponse(res, courts, "Courts retrieved successfully");
    } catch (error: any) {
      logger.error("Error getting courts (admin):", error);
      errorResponse(res, error.message || "Error retrieving courts", 500);
    }
  }

  /**
   * Create new court
   * @route POST /api/admin/courts
   */
  async createCourt(req: Request, res: Response): Promise<void> {
    try {
      const { name, sportType, description, venueId, pricePerHour } = req.body;

      const court = await courtService.createCourt({
        name,
        sportType,
        description,
        venueId: Number(venueId),
        pricePerHour: Number(pricePerHour),
      });

      successResponse(res, court, "Court created successfully", 201);
    } catch (error: any) {
      logger.error("Error creating court:", error);
      errorResponse(res, error.message || "Error creating court", 400);
    }
  }

  async getCourtById(req: Request, res: Response): Promise<void> {
    try {
      const courtId = Number(req.params.id);

      if (isNaN(courtId)) {
        errorResponse(res, "Invalid court ID", 400);
        return;
      }

      const court = await courtService.getCourtById(courtId);
      successResponse(res, court, "Court retrieved successfully");
    } catch (error: any) {
      logger.error("Error getting court by ID (admin):", error);
      errorResponse(
        res,
        error.message || "Error retrieving court",
        error.message.includes("not found") ? 404 : 500
      );
    }
  }

  /**
   * Update court
   * @route PUT /api/admin/courts/:id
   */
  async updateCourt(req: Request, res: Response): Promise<void> {
    try {
      const courtId = Number(req.params.id);

      if (isNaN(courtId)) {
        errorResponse(res, "Invalid court ID", 400);
        return;
      }

      const { name, sportType, description, pricePerHour, isActive } = req.body;

      const court = await courtService.updateCourt(courtId, {
        name,
        sportType,
        description,
        pricePerHour: pricePerHour ? Number(pricePerHour) : undefined,
        isActive,
      });

      successResponse(res, court, "Court updated successfully");
    } catch (error: any) {
      logger.error("Error updating court:", error);
      errorResponse(
        res,
        error.message || "Error updating court",
        error.message.includes("not found") ? 404 : 400
      );
    }
  }

  /**
   * Delete court
   * @route DELETE /api/admin/courts/:id
   */
  async deleteCourt(req: Request, res: Response): Promise<void> {
    try {
      const courtId = Number(req.params.id);

      if (isNaN(courtId)) {
        errorResponse(res, "Invalid court ID", 400);
        return;
      }

      await courtService.deleteCourt(courtId);
      successResponse(res, null, "Court deleted successfully");
    } catch (error: any) {
      logger.error("Error deleting court:", error);
      errorResponse(
        res,
        error.message || "Error deleting court",
        error.message.includes("not found") ? 404 : 400
      );
    }
  }

  /**
   * Create time slot for court
   * @route POST /api/admin/courts/:id/timeslots
   */
  async createTimeSlot(req: Request, res: Response): Promise<void> {
    try {
      const courtId = Number(req.params.id);

      if (isNaN(courtId)) {
        errorResponse(res, "Invalid court ID", 400);
        return;
      }

      const { dayOfWeek, startTime, endTime } = req.body;

      const timeSlot = await courtService.createTimeSlot({
        courtId,
        dayOfWeek: Number(dayOfWeek),
        startTime,
        endTime,
      });

      successResponse(res, timeSlot, "Time slot created successfully", 201);
    } catch (error: any) {
      logger.error("Error creating time slot:", error);
      errorResponse(res, error.message || "Error creating time slot", 400);
    }
  }

  /**
   * Bulk create time slots for court
   * @route POST /api/admin/courts/:id/timeslots/bulk
   */
  async bulkCreateTimeSlots(req: Request, res: Response): Promise<void> {
    try {
      const courtId = Number(req.params.id);

      if (isNaN(courtId)) {
        errorResponse(res, "Invalid court ID", 400);
        return;
      }

      const { timeSlots } = req.body;

      if (!Array.isArray(timeSlots) || timeSlots.length === 0) {
        errorResponse(res, "Time slots array is required", 400);
        return;
      }

      const createdSlots = await courtService.bulkCreateTimeSlots(
        courtId,
        timeSlots
      );
      successResponse(
        res,
        createdSlots,
        "Time slots created successfully",
        201
      );
    } catch (error: any) {
      logger.error("Error bulk creating time slots:", error);
      errorResponse(res, error.message || "Error creating time slots", 400);
    }
  }

  /**
   * Update time slot status
   * @route PATCH /api/admin/courts/timeslots/:id
   */
  async updateTimeSlot(req: Request, res: Response): Promise<void> {
    try {
      const timeSlotId = Number(req.params.id);

      if (isNaN(timeSlotId)) {
        errorResponse(res, "Invalid time slot ID", 400);
        return;
      }

      const { isActive } = req.body;

      if (typeof isActive !== "boolean") {
        errorResponse(res, "isActive must be a boolean", 400);
        return;
      }

      const timeSlot = await courtService.updateTimeSlot(timeSlotId, isActive);
      successResponse(res, timeSlot, "Time slot updated successfully");
    } catch (error: any) {
      logger.error("Error updating time slot:", error);
      errorResponse(
        res,
        error.message || "Error updating time slot",
        error.message.includes("not found") ? 404 : 400
      );
    }
  }

  /**
   * Delete time slot
   * @route DELETE /api/admin/courts/timeslots/:id
   */
  async deleteTimeSlot(req: Request, res: Response): Promise<void> {
    try {
      const timeSlotId = Number(req.params.id);

      if (isNaN(timeSlotId)) {
        errorResponse(res, "Invalid time slot ID", 400);
        return;
      }

      await courtService.deleteTimeSlot(timeSlotId);
      successResponse(res, null, "Time slot deleted successfully");
    } catch (error: any) {
      logger.error("Error deleting time slot:", error);
      errorResponse(
        res,
        error.message || "Error deleting time slot",
        error.message.includes("not found") ? 404 : 400
      );
    }
  }
}

export default new AdminCourtController();
