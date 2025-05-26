import { Request, Response } from "express";
import { PrismaClient, SportType } from "@prisma/client";
import { successResponse, errorResponse } from "../../utils/response";
import logger from "../../utils/logger";

const prisma = new PrismaClient();

/**
 * Controller for venue sports configuration and court management
 */
export class VenueSportsController {
  /**
   * Add sport configuration to venue
   * @route POST /api/admin/venues/:id/sports
   */
  async addSportToVenue(req: Request, res: Response): Promise<void> {
    try {
      const venueId = Number(req.params.id);
      const { sportType, maxCourts } = req.body;

      if (isNaN(venueId)) {
        errorResponse(res, "Invalid venue ID", 400);
        return;
      }

      // Validate sport type
      if (!Object.values(SportType).includes(sportType)) {
        errorResponse(res, "Invalid sport type", 400);
        return;
      }

      // Check if venue exists
      const venue = await prisma.venue.findUnique({
        where: { id: venueId },
      });

      if (!venue) {
        errorResponse(res, "Venue not found", 404);
        return;
      }

      // Check if sport already exists for this venue
      const existingSport = await prisma.venueSportsConfig.findUnique({
        where: {
          venueId_sportType: {
            venueId,
            sportType,
          },
        },
      });

      if (existingSport) {
        errorResponse(res, "Sport already configured for this venue", 400);
        return;
      }

      // Create sports configuration
      const sportsConfig = await prisma.venueSportsConfig.create({
        data: {
          venueId,
          sportType,
          maxCourts: maxCourts || 1,
        },
        include: {
          venue: {
            include: {
              courts: {
                where: {
                  sportType,
                  isActive: true,
                },
              },
            },
          },
        },
      });

      successResponse(res, sportsConfig, "Sport added to venue successfully", 201);
    } catch (error: any) {
      logger.error("Error adding sport to venue:", error);
      errorResponse(res, error.message || "Error adding sport to venue", 400);
    }
  }

  /**
   * Remove sport configuration from venue
   * @route DELETE /api/admin/venues/:id/sports/:sportId
   */
  async removeSportFromVenue(req: Request, res: Response): Promise<void> {
    try {
      const venueId = Number(req.params.id);
      const sportId = Number(req.params.sportId);

      if (isNaN(venueId) || isNaN(sportId)) {
        errorResponse(res, "Invalid venue ID or sport ID", 400);
        return;
      }

      // Check if sport configuration exists
      const sportsConfig = await prisma.venueSportsConfig.findUnique({
        where: { id: sportId },
        include: {
          venue: {
            include: {
              courts: {
                where: {
                  sportType: undefined, // Will be set below
                },
              },
            },
          },
        },
      });

      if (!sportsConfig || sportsConfig.venueId !== venueId) {
        errorResponse(res, "Sport configuration not found", 404);
        return;
      }

      // Check if there are existing courts for this sport
      const existingCourts = await prisma.court.findMany({
        where: {
          venueId,
          sportType: sportsConfig.sportType,
          isActive: true,
        },
        include: {
          bookings: {
            where: {
              status: {
                in: ["PENDING", "CONFIRMED"],
              },
            },
          },
        },
      });

      // Check for active bookings
      const hasActiveBookings = existingCourts.some(
        (court) => court.bookings.length > 0
      );

      if (hasActiveBookings) {
        errorResponse(
          res,
          "Cannot remove sport configuration with active bookings. Please cancel all bookings first.",
          400
        );
        return;
      }

      // If courts exist but no active bookings, deactivate them
      if (existingCourts.length > 0) {
        await prisma.court.updateMany({
          where: {
            venueId,
            sportType: sportsConfig.sportType,
          },
          data: {
            isActive: false,
          },
        });
      }

      // Remove sports configuration
      await prisma.venueSportsConfig.delete({
        where: { id: sportId },
      });

      successResponse(res, null, "Sport configuration removed successfully");
    } catch (error: any) {
      logger.error("Error removing sport from venue:", error);
      errorResponse(res, error.message || "Error removing sport from venue", 400);
    }
  }

  /**
   * Update sport configuration
   * @route PUT /api/admin/venues/:id/sports/:sportId
   */
  async updateSportConfig(req: Request, res: Response): Promise<void> {
    try {
      const venueId = Number(req.params.id);
      const sportId = Number(req.params.sportId);
      const { maxCourts, isActive } = req.body;

      if (isNaN(venueId) || isNaN(sportId)) {
        errorResponse(res, "Invalid venue ID or sport ID", 400);
        return;
      }

      // Check if sport configuration exists
      const existingConfig = await prisma.venueSportsConfig.findUnique({
        where: { id: sportId },
      });

      if (!existingConfig || existingConfig.venueId !== venueId) {
        errorResponse(res, "Sport configuration not found", 404);
        return;
      }

      // If reducing maxCourts, check if current courts exceed new limit
      if (maxCourts && maxCourts < existingConfig.maxCourts) {
        const currentCourts = await prisma.court.count({
          where: {
            venueId,
            sportType: existingConfig.sportType,
            isActive: true,
          },
        });

        if (currentCourts > maxCourts) {
          errorResponse(
            res,
            `Cannot reduce max courts to ${maxCourts}. Currently ${currentCourts} active courts exist.`,
            400
          );
          return;
        }
      }

      // Update sports configuration
      const updatedConfig = await prisma.venueSportsConfig.update({
        where: { id: sportId },
        data: {
          ...(maxCourts && { maxCourts }),
          ...(isActive !== undefined && { isActive }),
        },
      });

      successResponse(res, updatedConfig, "Sport configuration updated successfully");
    } catch (error: any) {
      logger.error("Error updating sport configuration:", error);
      errorResponse(res, error.message || "Error updating sport configuration", 400);
    }
  }

  /**
   * Get sports configuration for venue
   * @route GET /api/admin/venues/:id/sports
   */
  async getVenueSports(req: Request, res: Response): Promise<void> {
    try {
      const venueId = Number(req.params.id);

      if (isNaN(venueId)) {
        errorResponse(res, "Invalid venue ID", 400);
        return;
      }

      const sportsConfigs = await prisma.venueSportsConfig.findMany({
        where: { venueId },
        include: {
          venue: {
            include: {
              courts: {
                where: {
                  isActive: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      successResponse(res, sportsConfigs, "Venue sports retrieved successfully");
    } catch (error: any) {
      logger.error("Error getting venue sports:", error);
      errorResponse(res, error.message || "Error retrieving venue sports", 500);
    }
  }

  /**
   * Add court to venue
   * @route POST /api/admin/venues/:id/courts
   */
  async addCourtToVenue(req: Request, res: Response): Promise<void> {
    try {
      const venueId = Number(req.params.id);
      const { name, sportType, pricePerHour, description, timeSlots } = req.body;

      if (isNaN(venueId)) {
        errorResponse(res, "Invalid venue ID", 400);
        return;
      }

      // Validate sport type
      if (!Object.values(SportType).includes(sportType)) {
        errorResponse(res, "Invalid sport type", 400);
        return;
      }

      // Check if venue exists
      const venue = await prisma.venue.findUnique({
        where: { id: venueId },
      });

      if (!venue) {
        errorResponse(res, "Venue not found", 404);
        return;
      }

      // Check if sport is configured for this venue
      const sportsConfig = await prisma.venueSportsConfig.findUnique({
        where: {
          venueId_sportType: {
            venueId,
            sportType,
          },
        },
      });

      if (!sportsConfig) {
        errorResponse(res, "Sport not configured for this venue", 400);
        return;
      }

      // Check if we can add more courts for this sport
      const currentCourts = await prisma.court.count({
        where: {
          venueId,
          sportType,
          isActive: true,
        },
      });

      if (currentCourts >= sportsConfig.maxCourts) {
        errorResponse(
          res,
          `Maximum courts (${sportsConfig.maxCourts}) reached for ${sportType}`,
          400
        );
        return;
      }

      // Validate time slots
      if (!timeSlots || !Array.isArray(timeSlots) || timeSlots.length === 0) {
        errorResponse(res, "At least one time slot is required", 400);
        return;
      }

      // Validate each time slot
      for (const slot of timeSlots) {
        if (
          typeof slot.dayOfWeek !== "number" ||
          slot.dayOfWeek < 0 ||
          slot.dayOfWeek > 6
        ) {
          errorResponse(res, "Invalid day of week in time slots", 400);
          return;
        }

        if (!slot.startTime || !slot.endTime) {
          errorResponse(res, "Start time and end time are required for all slots", 400);
          return;
        }

        // Validate time format (HH:MM)
        const timeFormat = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeFormat.test(slot.startTime) || !timeFormat.test(slot.endTime)) {
          errorResponse(res, "Invalid time format. Use HH:MM format", 400);
          return;
        }

        // Check if end time is after start time
        if (slot.startTime >= slot.endTime) {
          errorResponse(res, "End time must be after start time", 400);
          return;
        }
      }

      // Create court and time slots in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // Create court
        const court = await tx.court.create({
          data: {
            name,
            sportType,
            description,
            venueId,
            pricePerHour: Number(pricePerHour),
          },
        });

        // Create time slots
        const createdTimeSlots = await Promise.all(
          timeSlots.map((slot: any) =>
            tx.timeSlot.create({
              data: {
                courtId: court.id,
                dayOfWeek: slot.dayOfWeek,
                startTime: slot.startTime,
                endTime: slot.endTime,
              },
            })
          )
        );

        return {
          ...court,
          timeSlots: createdTimeSlots,
        };
      });

      successResponse(res, result, "Court added successfully", 201);
    } catch (error: any) {
      logger.error("Error adding court to venue:", error);
      errorResponse(res, error.message || "Error adding court to venue", 400);
    }
  }

  /**
   * Get courts for a venue and sport
   * @route GET /api/admin/venues/:id/courts
   */
  async getVenueCourts(req: Request, res: Response): Promise<void> {
    try {
      const venueId = Number(req.params.id);
      const { sportType } = req.query;

      if (isNaN(venueId)) {
        errorResponse(res, "Invalid venue ID", 400);
        return;
      }

      const where: any = { venueId };
      
      if (sportType && Object.values(SportType).includes(sportType as SportType)) {
        where.sportType = sportType;
      }

      const courts = await prisma.court.findMany({
        where,
        include: {
          timeSlots: {
            where: { isActive: true },
            orderBy: [
              { dayOfWeek: "asc" },
              { startTime: "asc" },
            ],
          },
          _count: {
            select: {
              bookings: {
                where: {
                  status: {
                    in: ["PENDING", "CONFIRMED"],
                  },
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      successResponse(res, courts, "Courts retrieved successfully");
    } catch (error: any) {
      logger.error("Error getting venue courts:", error);
      errorResponse(res, error.message || "Error retrieving venue courts", 500);
    }
  }

  /**
   * Update court
   * @route PUT /api/admin/venues/:id/courts/:courtId
   */
  async updateCourt(req: Request, res: Response): Promise<void> {
    try {
      const venueId = Number(req.params.id);
      const courtId = Number(req.params.courtId);
      const { name, pricePerHour, description, isActive } = req.body;

      if (isNaN(venueId) || isNaN(courtId)) {
        errorResponse(res, "Invalid venue ID or court ID", 400);
        return;
      }

      // Check if court exists and belongs to venue
      const existingCourt = await prisma.court.findUnique({
        where: { id: courtId },
        include: {
          bookings: {
            where: {
              status: {
                in: ["PENDING", "CONFIRMED"],
              },
            },
          },
        },
      });

      if (!existingCourt || existingCourt.venueId !== venueId) {
        errorResponse(res, "Court not found", 404);
        return;
      }

      // If deactivating court, check for active bookings
      if (isActive === false && existingCourt.bookings.length > 0) {
        errorResponse(
          res,
          "Cannot deactivate court with active bookings",
          400
        );
        return;
      }

      // Update court
      const updatedCourt = await prisma.court.update({
        where: { id: courtId },
        data: {
          ...(name && { name }),
          ...(pricePerHour && { pricePerHour: Number(pricePerHour) }),
          ...(description !== undefined && { description }),
          ...(isActive !== undefined && { isActive }),
        },
        include: {
          timeSlots: {
            where: { isActive: true },
          },
        },
      });

      successResponse(res, updatedCourt, "Court updated successfully");
    } catch (error: any) {
      logger.error("Error updating court:", error);
      errorResponse(res, error.message || "Error updating court", 400);
    }
  }

  /**
   * Delete court
   * @route DELETE /api/admin/venues/:id/courts/:courtId
   */
  async deleteCourt(req: Request, res: Response): Promise<void> {
    try {
      const venueId = Number(req.params.id);
      const courtId = Number(req.params.courtId);

      if (isNaN(venueId) || isNaN(courtId)) {
        errorResponse(res, "Invalid venue ID or court ID", 400);
        return;
      }

      // Check if court exists and belongs to venue
      const court = await prisma.court.findUnique({
        where: { id: courtId },
        include: {
          bookings: {
            where: {
              status: {
                in: ["PENDING", "CONFIRMED"],
              },
            },
          },
        },
      });

      if (!court || court.venueId !== venueId) {
        errorResponse(res, "Court not found", 404);
        return;
      }

      // Check for active bookings
      if (court.bookings.length > 0) {
        // Deactivate instead of delete if there are bookings
        await prisma.court.update({
          where: { id: courtId },
          data: { isActive: false },
        });
        successResponse(res, null, "Court deactivated (has existing bookings)");
      } else {
        // Delete court and associated time slots
        await prisma.$transaction([
          prisma.timeSlot.deleteMany({
            where: { courtId },
          }),
          prisma.court.delete({
            where: { id: courtId },
          }),
        ]);
        successResponse(res, null, "Court deleted successfully");
      }
    } catch (error: any) {
      logger.error("Error deleting court:", error);
      errorResponse(res, error.message || "Error deleting court", 400);
    }
  }

  /**
   * Add time slot to court
   * @route POST /api/admin/venues/:id/courts/:courtId/timeslots
   */
  async addTimeSlotToCourt(req: Request, res: Response): Promise<void> {
    try {
      const venueId = Number(req.params.id);
      const courtId = Number(req.params.courtId);
      const { dayOfWeek, startTime, endTime } = req.body;

      if (isNaN(venueId) || isNaN(courtId)) {
        errorResponse(res, "Invalid venue ID or court ID", 400);
        return;
      }

      // Check if court exists and belongs to venue
      const court = await prisma.court.findUnique({
        where: { id: courtId },
      });

      if (!court || court.venueId !== venueId) {
        errorResponse(res, "Court not found", 404);
        return;
      }

      // Validate input
      if (dayOfWeek < 0 || dayOfWeek > 6) {
        errorResponse(res, "Invalid day of week", 400);
        return;
      }

      const timeFormat = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeFormat.test(startTime) || !timeFormat.test(endTime)) {
        errorResponse(res, "Invalid time format. Use HH:MM format", 400);
        return;
      }

      if (startTime >= endTime) {
        errorResponse(res, "End time must be after start time", 400);
        return;
      }

      // Check for conflicts with existing time slots
      const conflictingSlot = await prisma.timeSlot.findFirst({
        where: {
          courtId,
          dayOfWeek,
          OR: [
            {
              AND: [
                { startTime: { lte: startTime } },
                { endTime: { gt: startTime } },
              ],
            },
            {
              AND: [
                { startTime: { lt: endTime } },
                { endTime: { gte: endTime } },
              ],
            },
            {
              AND: [
                { startTime: { gte: startTime } },
                { endTime: { lte: endTime } },
              ],
            },
          ],
        },
      });

      if (conflictingSlot) {
        errorResponse(res, "Time slot conflicts with existing slot", 400);
        return;
      }

      // Create time slot
      const timeSlot = await prisma.timeSlot.create({
        data: {
          courtId,
          dayOfWeek,
          startTime,
          endTime,
        },
      });

      successResponse(res, timeSlot, "Time slot added successfully", 201);
    } catch (error: any) {
      logger.error("Error adding time slot:", error);
      errorResponse(res, error.message || "Error adding time slot", 400);
    }
  }

  /**
   * Update time slot
   * @route PUT /api/admin/venues/:id/courts/:courtId/timeslots/:slotId
   */
  async updateTimeSlot(req: Request, res: Response): Promise<void> {
    try {
      const venueId = Number(req.params.id);
      const courtId = Number(req.params.courtId);
      const slotId = Number(req.params.slotId);
      const { dayOfWeek, startTime, endTime, isActive } = req.body;

      if (isNaN(venueId) || isNaN(courtId) || isNaN(slotId)) {
        errorResponse(res, "Invalid venue ID, court ID, or slot ID", 400);
        return;
      }

      // Check if time slot exists and belongs to court
      const existingSlot = await prisma.timeSlot.findUnique({
        where: { id: slotId },
        include: {
          court: true,
          bookings: {
            where: {
              status: {
                in: ["PENDING", "CONFIRMED"],
              },
            },
          },
        },
      });

      if (
        !existingSlot ||
        existingSlot.courtId !== courtId ||
        existingSlot.court.venueId !== venueId
      ) {
        errorResponse(res, "Time slot not found", 404);
        return;
      }

      // If deactivating, check for active bookings
      if (isActive === false && existingSlot.bookings.length > 0) {
        errorResponse(
          res,
          "Cannot deactivate time slot with active bookings",
          400
        );
        return;
      }

      // Update time slot
      const updatedSlot = await prisma.timeSlot.update({
        where: { id: slotId },
        data: {
          ...(dayOfWeek !== undefined && { dayOfWeek }),
          ...(startTime && { startTime }),
          ...(endTime && { endTime }),
          ...(isActive !== undefined && { isActive }),
        },
      });

      successResponse(res, updatedSlot, "Time slot updated successfully");
    } catch (error: any) {
      logger.error("Error updating time slot:", error);
      errorResponse(res, error.message || "Error updating time slot", 400);
    }
  }

  /**
   * Delete time slot
   * @route DELETE /api/admin/venues/:id/courts/:courtId/timeslots/:slotId
   */
  async deleteTimeSlot(req: Request, res: Response): Promise<void> {
    try {
      const venueId = Number(req.params.id);
      const courtId = Number(req.params.courtId);
      const slotId = Number(req.params.slotId);

      if (isNaN(venueId) || isNaN(courtId) || isNaN(slotId)) {
        errorResponse(res, "Invalid venue ID, court ID, or slot ID", 400);
        return;
      }

      // Check if time slot exists and belongs to court
      const timeSlot = await prisma.timeSlot.findUnique({
        where: { id: slotId },
        include: {
          court: true,
          bookings: {
            where: {
              status: {
                in: ["PENDING", "CONFIRMED"],
              },
            },
          },
        },
      });

      if (
        !timeSlot ||
        timeSlot.courtId !== courtId ||
        timeSlot.court.venueId !== venueId
      ) {
        errorResponse(res, "Time slot not found", 404);
        return;
      }

      // Check for active bookings
      if (timeSlot.bookings.length > 0) {
        // Deactivate instead of delete if there are bookings
        await prisma.timeSlot.update({
          where: { id: slotId },
          data: { isActive: false },
        });
        successResponse(res, null, "Time slot deactivated (has existing bookings)");
      } else {
        // Delete time slot
        await prisma.timeSlot.delete({
          where: { id: slotId },
        });
        successResponse(res, null, "Time slot deleted successfully");
      }
    } catch (error: any) {
      logger.error("Error deleting time slot:", error);
      errorResponse(res, error.message || "Error deleting time slot", 400);
    }
  }
}

export default new VenueSportsController();