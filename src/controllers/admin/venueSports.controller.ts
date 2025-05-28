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

      // Enhanced validation
      if (isNaN(venueId) || venueId <= 0) {
        errorResponse(res, "Invalid venue ID", 400);
        return;
      }

      // Validate required fields
      if (!sportType) {
        errorResponse(res, "Sport type is required", 400);
        return;
      }

      if (!maxCourts || isNaN(Number(maxCourts)) || Number(maxCourts) <= 0) {
        errorResponse(res, "Max courts must be a positive number", 400);
        return;
      }

      // Validate sport type enum
      if (!Object.values(SportType).includes(sportType as SportType)) {
        errorResponse(
          res,
          `Invalid sport type. Must be one of: ${Object.values(SportType).join(
            ", "
          )}`,
          400
        );
        return;
      }

      logger.info("Adding sport to venue:", { venueId, sportType, maxCourts });

      // Check if venue exists
      const venue = await prisma.venue.findUnique({
        where: { id: venueId },
      });

      if (!venue) {
        errorResponse(res, "Venue not found", 404);
        return;
      }

      if (!venue.isActive) {
        errorResponse(res, "Cannot add sports to inactive venue", 400);
        return;
      }

      // Check if sport already exists for this venue
      const existingSport = await prisma.venueSportsConfig.findUnique({
        where: {
          venueId_sportType: {
            venueId,
            sportType: sportType as SportType,
          },
        },
      });

      if (existingSport) {
        errorResponse(res, "Sport already configured for this venue", 400);
        return;
      }

      // Create sports configuration with proper data
      const sportsConfigData = {
        venueId: venueId,
        sportType: sportType as SportType,
        maxCourts: Number(maxCourts),
        isActive: true, // Explicitly set to true
      };

      logger.info("Creating sports config with data:", sportsConfigData);

      const sportsConfig = await prisma.venueSportsConfig.create({
        data: sportsConfigData,
        include: {
          venue: {
            select: {
              id: true,
              name: true,
              location: true,
            },
          },
        },
      });

      // Get existing courts count for this sport
      const existingCourtsCount = await prisma.court.count({
        where: {
          venueId,
          sportType: sportType as SportType,
          isActive: true,
        },
      });

      const responseData = {
        ...sportsConfig,
        existingCourtsCount,
        remainingCourts: sportsConfig.maxCourts - existingCourtsCount,
      };

      logger.info("Sport added successfully:", { id: sportsConfig.id });
      successResponse(
        res,
        responseData,
        "Sport added to venue successfully",
        201
      );
    } catch (error: any) {
      logger.error("Error adding sport to venue:", {
        message: error.message,
        stack: error.stack,
        code: error.code,
        meta: error.meta,
        venueId: req.params.id,
        body: req.body,
      });

      // Handle specific Prisma errors
      if (error.code === "P2002") {
        errorResponse(
          res,
          "Sport configuration already exists for this venue",
          409
        );
        return;
      }

      if (error.code === "P2003") {
        errorResponse(res, "Invalid venue reference", 400);
        return;
      }

      if (error.message?.includes("kind")) {
        errorResponse(
          res,
          "Invalid data type provided. Please check your input values.",
          400
        );
        return;
      }

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

      if (isNaN(venueId) || isNaN(sportId) || venueId <= 0 || sportId <= 0) {
        errorResponse(res, "Invalid venue ID or sport ID", 400);
        return;
      }

      // Check if sport configuration exists
      const sportsConfig = await prisma.venueSportsConfig.findUnique({
        where: { id: sportId },
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

      // If courts exist but no active bookings, deactivate them first
      if (existingCourts.length > 0) {
        await prisma.$transaction([
          // Deactivate all time slots for courts of this sport
          prisma.timeSlot.updateMany({
            where: {
              court: {
                venueId,
                sportType: sportsConfig.sportType,
              },
            },
            data: {
              isActive: false,
            },
          }),
          // Deactivate all courts of this sport
          prisma.court.updateMany({
            where: {
              venueId,
              sportType: sportsConfig.sportType,
            },
            data: {
              isActive: false,
            },
          }),
        ]);
      }

      // Remove sports configuration
      await prisma.venueSportsConfig.delete({
        where: { id: sportId },
      });

      successResponse(res, null, "Sport configuration removed successfully");
    } catch (error: any) {
      logger.error("Error removing sport from venue:", error);
      errorResponse(
        res,
        error.message || "Error removing sport from venue",
        400
      );
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

      if (isNaN(venueId) || isNaN(sportId) || venueId <= 0 || sportId <= 0) {
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

      // Prepare update data
      const updateData: any = {};

      // If reducing maxCourts, check if current courts exceed new limit
      if (maxCourts !== undefined) {
        const maxCourtsNum = Number(maxCourts);
        if (isNaN(maxCourtsNum) || maxCourtsNum <= 0) {
          errorResponse(res, "Max courts must be a positive number", 400);
          return;
        }

        if (maxCourtsNum < existingConfig.maxCourts) {
          const currentCourts = await prisma.court.count({
            where: {
              venueId,
              sportType: existingConfig.sportType,
              isActive: true,
            },
          });

          if (currentCourts > maxCourtsNum) {
            errorResponse(
              res,
              `Cannot reduce max courts to ${maxCourtsNum}. Currently ${currentCourts} active courts exist.`,
              400
            );
            return;
          }
        }

        updateData.maxCourts = maxCourtsNum;
      }

      if (isActive !== undefined) {
        updateData.isActive = Boolean(isActive);
      }

      // Only update if there's data to update
      if (Object.keys(updateData).length === 0) {
        errorResponse(res, "No valid fields to update", 400);
        return;
      }

      // Update sports configuration
      const updatedConfig = await prisma.venueSportsConfig.update({
        where: { id: sportId },
        data: updateData,
        include: {
          venue: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      successResponse(
        res,
        updatedConfig,
        "Sport configuration updated successfully"
      );
    } catch (error: any) {
      logger.error("Error updating sport configuration:", error);
      errorResponse(
        res,
        error.message || "Error updating sport configuration",
        400
      );
    }
  }

  /**
   * Get sports configuration for venue
   * @route GET /api/admin/venues/:id/sports
   */
  async getVenueSports(req: Request, res: Response): Promise<void> {
    try {
      const venueId = Number(req.params.id);

      if (isNaN(venueId) || venueId <= 0) {
        errorResponse(res, "Invalid venue ID", 400);
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
      const sportsConfigs = await prisma.venueSportsConfig.findMany({
        where: { venueId },
        include: {
          venue: {
            select: {
              id: true,
              name: true,
              location: true,
            },
          },
          _count: {
            select: {
              courts: true, 
            },
          },
        },
        orderBy: {
          createdAt: "asc",
        },
      });

      // Add computed fields with active court counts
      const enrichedConfigs = await Promise.all(
        sportsConfigs.map(async (config) => {
          const activeCourts = await prisma.court.count({
            where: {
              venueId,
              sportType: config.sportType,
              isActive: true,
            },
          });

          return {
            ...config,
            activeCourtsCount: activeCourts,
            remainingCourts: config.maxCourts - activeCourts,
            canAddMoreCourts: activeCourts < config.maxCourts,
          };
        })
      );

      successResponse(
        res,
        enrichedConfigs,
        "Venue sports retrieved successfully"
      );
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
      const { name, sportType, pricePerHour, description, timeSlots } =
        req.body;

      if (isNaN(venueId) || venueId <= 0) {
        errorResponse(res, "Invalid venue ID", 400);
        return;
      }

      // Validate required fields
      if (!name || !sportType || pricePerHour === undefined) {
        errorResponse(
          res,
          "Name, sport type, and price per hour are required",
          400
        );
        return;
      }

      // Validate sport type
      if (!Object.values(SportType).includes(sportType as SportType)) {
        errorResponse(
          res,
          `Invalid sport type. Must be one of: ${Object.values(SportType).join(
            ", "
          )}`,
          400
        );
        return;
      }

      // Validate price
      const price = Number(pricePerHour);
      if (isNaN(price) || price < 0) {
        errorResponse(res, "Price per hour must be a non-negative number", 400);
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

      if (!venue.isActive) {
        errorResponse(res, "Cannot add courts to inactive venue", 400);
        return;
      }

      // Check if sport is configured for this venue
      const sportsConfig = await prisma.venueSportsConfig.findUnique({
        where: {
          venueId_sportType: {
            venueId,
            sportType: sportType as SportType,
          },
        },
      });

      if (!sportsConfig) {
        errorResponse(
          res,
          `Sport ${sportType} is not configured for this venue. Please add the sport configuration first.`,
          400
        );
        return;
      }

      if (!sportsConfig.isActive) {
        errorResponse(res, "Sport configuration is inactive", 400);
        return;
      }

      // Check if we can add more courts for this sport
      const currentCourts = await prisma.court.count({
        where: {
          venueId,
          sportType: sportType as SportType,
          isActive: true,
        },
      });

      if (currentCourts >= sportsConfig.maxCourts) {
        errorResponse(
          res,
          `Maximum courts (${sportsConfig.maxCourts}) reached for ${sportType}. Current active courts: ${currentCourts}`,
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
      for (const [index, slot] of timeSlots.entries()) {
        if (
          typeof slot.dayOfWeek !== "number" ||
          slot.dayOfWeek < 0 ||
          slot.dayOfWeek > 6
        ) {
          errorResponse(
            res,
            `Invalid day of week in time slot ${index + 1}`,
            400
          );
          return;
        }

        if (!slot.startTime || !slot.endTime) {
          errorResponse(
            res,
            `Start time and end time are required for time slot ${index + 1}`,
            400
          );
          return;
        }

        // Validate time format (HH:MM)
        const timeFormat = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (
          !timeFormat.test(slot.startTime) ||
          !timeFormat.test(slot.endTime)
        ) {
          errorResponse(
            res,
            `Invalid time format in time slot ${index + 1}. Use HH:MM format`,
            400
          );
          return;
        }

        // Check if end time is after start time
        if (slot.startTime >= slot.endTime) {
          errorResponse(
            res,
            `End time must be after start time in time slot ${index + 1}`,
            400
          );
          return;
        }
      }

      // Create court and time slots in a transaction
      const result = await prisma.$transaction(async (tx) => {
        // Create court
        const court = await tx.court.create({
          data: {
            name: name.trim(),
            sportType: sportType as SportType,
            description: description ? description.trim() : null,
            venueId,
            pricePerHour: price,
            isActive: true,
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
                isActive: true,
              },
            })
          )
        );

        return {
          ...court,
          timeSlots: createdTimeSlots,
        };
      });

      logger.info("Court added successfully:", {
        courtId: result.id,
        venueId,
        sportType,
      });
      successResponse(res, result, "Court added successfully", 201);
    } catch (error: any) {
      logger.error("Error adding court to venue:", {
        message: error.message,
        stack: error.stack,
        code: error.code,
        venueId: req.params.id,
        body: req.body,
      });

      // Handle specific errors
      if (error.code === "P2002") {
        errorResponse(
          res,
          "A court with this name already exists in this venue",
          409
        );
        return;
      }

      if (error.code === "P2003") {
        errorResponse(res, "Invalid venue reference", 400);
        return;
      }

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

      if (isNaN(venueId) || venueId <= 0) {
        errorResponse(res, "Invalid venue ID", 400);
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

      const where: any = { venueId };

      if (
        sportType &&
        Object.values(SportType).includes(sportType as SportType)
      ) {
        where.sportType = sportType as SportType;
      }

      const courts = await prisma.court.findMany({
        where,
        include: {
          timeSlots: {
            where: { isActive: true },
            orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
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

      if (isNaN(venueId) || isNaN(courtId) || venueId <= 0 || courtId <= 0) {
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
        errorResponse(res, "Cannot deactivate court with active bookings", 400);
        return;
      }

      // Prepare update data
      const updateData: any = {};

      if (name !== undefined) {
        updateData.name = name.trim();
      }

      if (pricePerHour !== undefined) {
        const price = Number(pricePerHour);
        if (isNaN(price) || price < 0) {
          errorResponse(
            res,
            "Price per hour must be a non-negative number",
            400
          );
          return;
        }
        updateData.pricePerHour = price;
      }

      if (description !== undefined) {
        updateData.description = description ? description.trim() : null;
      }

      if (isActive !== undefined) {
        updateData.isActive = Boolean(isActive);
      }

      // Only update if there's data to update
      if (Object.keys(updateData).length === 0) {
        errorResponse(res, "No valid fields to update", 400);
        return;
      }

      // Update court
      const updatedCourt = await prisma.court.update({
        where: { id: courtId },
        data: updateData,
        include: {
          timeSlots: {
            where: { isActive: true },
            orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
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

      if (isNaN(venueId) || isNaN(courtId) || venueId <= 0 || courtId <= 0) {
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
        // Delete court and associated time slots in transaction
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

      if (isNaN(venueId) || isNaN(courtId) || venueId <= 0 || courtId <= 0) {
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

      if (!court.isActive) {
        errorResponse(res, "Cannot add time slots to inactive court", 400);
        return;
      }

      // Validate input
      if (typeof dayOfWeek !== "number" || dayOfWeek < 0 || dayOfWeek > 6) {
        errorResponse(res, "Invalid day of week (must be 0-6)", 400);
        return;
      }

      if (!startTime || !endTime) {
        errorResponse(res, "Start time and end time are required", 400);
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
          isActive: true,
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
        errorResponse(
          res,
          `Time slot conflicts with existing slot: ${conflictingSlot.startTime}-${conflictingSlot.endTime}`,
          400
        );
        return;
      }

      // Create time slot
      const timeSlot = await prisma.timeSlot.create({
        data: {
          courtId,
          dayOfWeek,
          startTime,
          endTime,
          isActive: true,
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

      if (
        isNaN(venueId) ||
        isNaN(courtId) ||
        isNaN(slotId) ||
        venueId <= 0 ||
        courtId <= 0 ||
        slotId <= 0
      ) {
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

      // Prepare update data
      const updateData: any = {};

      if (dayOfWeek !== undefined) {
        if (typeof dayOfWeek !== "number" || dayOfWeek < 0 || dayOfWeek > 6) {
          errorResponse(res, "Invalid day of week (must be 0-6)", 400);
          return;
        }
        updateData.dayOfWeek = dayOfWeek;
      }

      if (startTime !== undefined) {
        const timeFormat = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeFormat.test(startTime)) {
          errorResponse(
            res,
            "Invalid start time format. Use HH:MM format",
            400
          );
          return;
        }
        updateData.startTime = startTime;
      }

      if (endTime !== undefined) {
        const timeFormat = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeFormat.test(endTime)) {
          errorResponse(res, "Invalid end time format. Use HH:MM format", 400);
          return;
        }
        updateData.endTime = endTime;
      }

      // Validate that end time is after start time
      const finalStartTime = updateData.startTime || existingSlot.startTime;
      const finalEndTime = updateData.endTime || existingSlot.endTime;

      if (finalStartTime >= finalEndTime) {
        errorResponse(res, "End time must be after start time", 400);
        return;
      }

      if (isActive !== undefined) {
        updateData.isActive = Boolean(isActive);
      }

      // Only update if there's data to update
      if (Object.keys(updateData).length === 0) {
        errorResponse(res, "No valid fields to update", 400);
        return;
      }

      // Check for conflicts if time or day is being changed
      if (
        updateData.dayOfWeek !== undefined ||
        updateData.startTime !== undefined ||
        updateData.endTime !== undefined
      ) {
        const checkDayOfWeek =
          updateData.dayOfWeek !== undefined
            ? updateData.dayOfWeek
            : existingSlot.dayOfWeek;

        const conflictingSlot = await prisma.timeSlot.findFirst({
          where: {
            courtId,
            dayOfWeek: checkDayOfWeek,
            isActive: true,
            id: { not: slotId }, // Exclude current slot
            OR: [
              {
                AND: [
                  { startTime: { lte: finalStartTime } },
                  { endTime: { gt: finalStartTime } },
                ],
              },
              {
                AND: [
                  { startTime: { lt: finalEndTime } },
                  { endTime: { gte: finalEndTime } },
                ],
              },
              {
                AND: [
                  { startTime: { gte: finalStartTime } },
                  { endTime: { lte: finalEndTime } },
                ],
              },
            ],
          },
        });

        if (conflictingSlot) {
          errorResponse(
            res,
            `Time slot conflicts with existing slot: ${conflictingSlot.startTime}-${conflictingSlot.endTime}`,
            400
          );
          return;
        }
      }

      // Update time slot
      const updatedSlot = await prisma.timeSlot.update({
        where: { id: slotId },
        data: updateData,
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

      if (
        isNaN(venueId) ||
        isNaN(courtId) ||
        isNaN(slotId) ||
        venueId <= 0 ||
        courtId <= 0 ||
        slotId <= 0
      ) {
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
        successResponse(
          res,
          null,
          "Time slot deactivated (has existing bookings)"
        );
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
