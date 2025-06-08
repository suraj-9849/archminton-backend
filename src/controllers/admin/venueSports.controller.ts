import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
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

      // For custom sports, we don't validate against the enum
      // Just ensure it's a non-empty string
      if (typeof sportType !== 'string' || sportType.trim() === '') {
        errorResponse(res, "Sport type must be a valid string", 400);
        return;
      }

      const normalizedSportType = sportType.trim().toUpperCase();

      logger.info("Adding sport to venue:", { venueId, sportType: normalizedSportType, maxCourts });

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

      // Check if sport already exists for this venue (case-insensitive)
      const existingSport = await prisma.venueSportsConfig.findFirst({
        where: {
          venueId,
          sportType: {
            equals: normalizedSportType,
            mode: 'insensitive'
          }
        },
      });

      if (existingSport) {
        errorResponse(res, "Sport already configured for this venue", 400);
        return;
      }

      // Create sports configuration with proper data
      const sportsConfigData = {
        venueId: venueId,
        sportType: normalizedSportType,
        maxCourts: Number(maxCourts),
        isActive: true,
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
          sportType: normalizedSportType,
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

      // For custom sports, we accept any string - no enum validation
      if (typeof sportType !== 'string' || sportType.trim() === '') {
        errorResponse(res, "Sport type must be a valid string", 400);
        return;
      }

      const normalizedSportType = sportType.trim().toUpperCase();

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

      // Check if sport is configured for this venue (case-insensitive)
      const sportsConfig = await prisma.venueSportsConfig.findFirst({
        where: {
          venueId,
          sportType: {
            equals: normalizedSportType,
            mode: 'insensitive'
          }
        },
      });

      if (!sportsConfig) {
        errorResponse(
          res,
          `Sport ${normalizedSportType} is not configured for this venue. Please add the sport configuration first.`,
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
          sportType: normalizedSportType,
          isActive: true,
        },
      });

      if (currentCourts >= sportsConfig.maxCourts) {
        errorResponse(
          res,
          `Maximum courts (${sportsConfig.maxCourts}) reached for ${normalizedSportType}. Current active courts: ${currentCourts}`,
          400
        );
        return;
      }

      // Validate time slots for duplicates and overlaps
      const timeSlotMap = new Map();
      for (const slot of timeSlots) {
        const key = `${slot.dayOfWeek}-${slot.startTime}-${slot.endTime}`;
        if (timeSlotMap.has(key)) {
          errorResponse(
            res,
            `Duplicate time slot found: Day ${slot.dayOfWeek}, ${slot.startTime}-${slot.endTime}`,
            400
          );
          return;
        }
        timeSlotMap.set(key, true);

        // Validate time format
        const startTime = new Date(`2000-01-01T${slot.startTime}`);
        const endTime = new Date(`2000-01-01T${slot.endTime}`);

        if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
          errorResponse(
            res,
            `Invalid time format in time slot: ${slot.startTime}-${slot.endTime}`,
            400
          );
          return;
        }

        if (startTime >= endTime) {
          errorResponse(
            res,
            `End time must be after start time in time slot: ${slot.startTime}-${slot.endTime}`,
            400
          );
          return;
        }
      }

      // Create court and time slots in a transaction
      const result = await prisma.$transaction(async (tx) => {
        try {
          logger.info("Starting court creation:", {
            venueId,
            name,
            sportType: normalizedSportType,
            timeSlotsCount: timeSlots.length
          });

          // Create court
          const court = await tx.court.create({
            data: {
              name: name.trim(),
              sportType: normalizedSportType,
              description: description ? description.trim() : null,
              venueId,
              pricePerHour: price,
              isActive: true,
            }
          });

          logger.info("Court created successfully:", {
            courtId: court.id,
            name: court.name
          });

          // Create time slots in smaller batches of 10
          const BATCH_SIZE = 10;
          const createdTimeSlots = [];

          // Process time slots in smaller chunks
          for (let i = 0; i < timeSlots.length; i += BATCH_SIZE) {
            const batch = timeSlots.slice(i, i + BATCH_SIZE);
            logger.info(`Processing time slot batch ${i / BATCH_SIZE + 1}:`, {
              batchSize: batch.length,
              startIndex: i
            });

            // Create time slots for this batch
            const batchData = batch.map((slot: { dayOfWeek: number; startTime: string; endTime: string }) => ({
              courtId: court.id,
              dayOfWeek: slot.dayOfWeek,
              startTime: slot.startTime,
              endTime: slot.endTime,
              isActive: true,
            }));

            const batchResults = await tx.timeSlot.createMany({
              data: batchData,
              skipDuplicates: true
            });

            logger.info(`Batch ${i / BATCH_SIZE + 1} completed:`, {
              createdSlots: batch.length
            });
          }

          logger.info("All time slots created, fetching final court data");

          // Fetch the complete court with all time slots
          const updatedCourt = await tx.court.findUnique({
            where: { id: court.id },
            include: {
              timeSlots: {
                where: { isActive: true },
                orderBy: [
                  { dayOfWeek: 'asc' },
                  { startTime: 'asc' }
                ]
              }
            }
          });

          if (!updatedCourt) {
            logger.error("Failed to fetch created court:", {
              courtId: court.id
            });
            throw new Error('Failed to create court - Court not found after creation');
          }

          logger.info("Court creation completed successfully:", {
            courtId: updatedCourt.id,
            timeSlotsCount: updatedCourt.timeSlots.length
          });

          return updatedCourt;
        } catch (error: any) {
          // Log the error for debugging
          logger.error("Transaction error:", {
            error: error.message,
            stack: error.stack,
            code: error.code,
            venueId,
            courtName: name,
            timeSlotsCount: timeSlots.length
          });

          // Handle specific Prisma errors
          if (error.code === 'P2002') {
            throw new Error(`A court with name "${name}" already exists in this venue`);
          }
          if (error.code === 'P2003') {
            throw new Error(`Invalid venue reference: ${venueId}`);
          }

          throw error; // Re-throw to trigger transaction rollback
        }
      }, {
        timeout: 30000 // Increase timeout to 30 seconds
      });

      logger.info("Court added successfully:", {
        courtId: result.id,
        venueId,
        sportType: normalizedSportType,
        timeSlotsCount: result.timeSlots.length
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
        include: {
          sportsConfig: true
        }
      });

      if (!venue) {
        errorResponse(res, "Venue not found", 404);
        return;
      }

      const where: any = {
        venueId,
        isActive: true
      };

      if (sportType && typeof sportType === 'string') {
        where.sportType = {
          equals: sportType.toString().toUpperCase(),
          mode: 'insensitive'
        };
      }

      const courts = await prisma.court.findMany({
        where,
        include: {
          timeSlots: {
            where: { isActive: true },
            orderBy: [
              { dayOfWeek: 'asc' },
              { startTime: 'asc' }
            ]
          },
          _count: {
            select: {
              bookings: {
                where: {
                  status: {
                    in: ["PENDING", "CONFIRMED"]
                  }
                }
              }
            }
          }
        },
        orderBy: [
          { createdAt: 'asc' }
        ]
      });

      // Transform the response to include active bookings count
      const transformedCourts = courts.map(court => ({
        ...court,
        activeBookings: court._count.bookings
      }));

      successResponse(res, transformedCourts, "Courts retrieved successfully");
    } catch (error: any) {
      logger.error("Error getting venue courts:", error);
      errorResponse(res, error.message || "Error retrieving venue courts", 500);
    }
  }
/**
 * Update court - FIXED TIME SLOT HANDLING WITH PROPER DELETION
 * @route PUT /api/admin/venues/:id/courts/:courtId
 */
async updateCourt(req: Request, res: Response): Promise<void> {
  try {
    const venueId = Number(req.params.id);
    const courtId = Number(req.params.courtId);
    const { name, pricePerHour, description, isActive, timeSlots } = req.body;

    console.log('=== COURT UPDATE START ===');
    console.log('Venue ID:', venueId);
    console.log('Court ID:', courtId);
    console.log('Time slots received:', timeSlots ? timeSlots.length : 'none');
    console.log('Request body keys:', Object.keys(req.body));

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
        timeSlots: {
          where: { isActive: true }
        },
      },
    });

    if (!existingCourt || existingCourt.venueId !== venueId) {
      errorResponse(res, "Court not found", 404);
      return;
    }

    console.log('Existing court found with', existingCourt.timeSlots.length, 'active time slots');

    // If deactivating court, check for active bookings
    if (isActive === false && existingCourt.bookings.length > 0) {
      errorResponse(res, "Cannot deactivate court with active bookings", 400);
      return;
    }

    // Prepare update data for court basic info
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

    console.log('Update data prepared:', Object.keys(updateData));

    const result = await prisma.$transaction(async (tx) => {
      console.log('=== TRANSACTION START ===');
      
      // Update court basic info
      const updatedCourt = await tx.court.update({
        where: { id: courtId },
        data: updateData,
      });

      console.log('Court basic info updated successfully');

      let finalTimeSlots = [];

      // Handle time slots ONLY if they are explicitly provided and is an array
      if (timeSlots && Array.isArray(timeSlots)) {
        console.log('Processing', timeSlots.length, 'time slots');
        
        // Validate time slots format first
        const invalidSlots = timeSlots.filter((slot: any) => 
          typeof slot.dayOfWeek !== 'number' || 
          !slot.startTime || 
          !slot.endTime ||
          slot.dayOfWeek < 0 || 
          slot.dayOfWeek > 6
        );

        if (invalidSlots.length > 0) {
          console.error('Invalid time slots found:', invalidSlots.slice(0, 3));
          throw new Error(`Invalid time slot format. Found ${invalidSlots.length} invalid slots.`);
        }

        // Validate that start time is before end time
        for (const slot of timeSlots) {
          const startTime = new Date(`2000-01-01T${slot.startTime}`);
          const endTime = new Date(`2000-01-01T${slot.endTime}`);
          
          if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
            throw new Error(`Invalid time format in slot: ${slot.startTime}-${slot.endTime}`);
          }
          
          if (startTime >= endTime) {
            throw new Error(`End time must be after start time: ${slot.startTime}-${slot.endTime}`);
          }
        }

        console.log('Time slots validation passed');

        // Check for existing bookings in time slots we're about to delete
        const existingBookings = await tx.booking.findMany({
          where: {
            timeSlot: {
              courtId: courtId,
              isActive: true
            },
            status: {
              in: ["PENDING", "CONFIRMED"]
            }
          },
          include: {
            timeSlot: true
          }
        });

        if (existingBookings.length > 0) {
          throw new Error(`Cannot update time slots. There are ${existingBookings.length} active bookings for this court.`);
        }

        // Step 1: COMPLETELY DELETE existing time slots for this court
        const deleteResult = await tx.timeSlot.deleteMany({
          where: { 
            courtId: courtId
          },
        });

        console.log('Deleted', deleteResult.count, 'existing time slots');

        // Step 2: Prepare new time slots data with deduplication
        const timeSlotsData = timeSlots.map((slot: any) => ({
          courtId: courtId,
          dayOfWeek: Number(slot.dayOfWeek),
          startTime: slot.startTime.toString(),
          endTime: slot.endTime.toString(),
          isActive: true,
        }));

        // Remove duplicates based on the unique constraint fields
        const uniqueTimeSlots = timeSlotsData.filter((slot, index, self) => {
          return index === self.findIndex(s => 
            s.courtId === slot.courtId &&
            s.dayOfWeek === slot.dayOfWeek &&
            s.startTime === slot.startTime &&
            s.endTime === slot.endTime
          );
        });

        console.log('Prepared', uniqueTimeSlots.length, 'unique time slots for creation');
        console.log('Removed', timeSlotsData.length - uniqueTimeSlots.length, 'duplicate time slots');

        // Step 3: Create new time slots in batches
        const BATCH_SIZE = 20;
        let totalCreated = 0;

        for (let i = 0; i < uniqueTimeSlots.length; i += BATCH_SIZE) {
          const batch = uniqueTimeSlots.slice(i, i + BATCH_SIZE);
          console.log(`Creating batch ${Math.floor(i/BATCH_SIZE) + 1}:`, batch.length, 'slots');
          
          try {
            const createResult = await tx.timeSlot.createMany({
              data: batch,
              skipDuplicates: true, // Additional safety against duplicates
            });
            
            totalCreated += createResult.count;
            console.log('Batch created successfully, count:', createResult.count);
          } catch (batchError: any) {
            console.error('Batch creation error:', batchError);
            console.error('Problematic batch:', batch);
            throw new Error(`Failed to create time slots batch: ${batchError.message}`);
          }
        }

        console.log('Total time slots created:', totalCreated);

        // Step 4: Fetch the newly created time slots
        finalTimeSlots = await tx.timeSlot.findMany({
          where: { 
            courtId: courtId, 
            isActive: true 
          },
          orderBy: [
            { dayOfWeek: 'asc' },
            { startTime: 'asc' }
          ]
        });

        console.log('Final active time slots count:', finalTimeSlots.length);

        // Validation: Ensure we have the expected number of time slots
        if (finalTimeSlots.length !== uniqueTimeSlots.length) {
          console.warn(`Warning: Expected ${uniqueTimeSlots.length} time slots but found ${finalTimeSlots.length}`);
          
          // Log the difference for debugging
          const expectedKeys = uniqueTimeSlots.map(s => `${s.dayOfWeek}-${s.startTime}-${s.endTime}`);
          const actualKeys = finalTimeSlots.map(s => `${s.dayOfWeek}-${s.startTime}-${s.endTime}`);
          
          console.log('Expected time slots:', expectedKeys);
          console.log('Actual time slots:', actualKeys);
          
          const missing = expectedKeys.filter(key => !actualKeys.includes(key));
          const extra = actualKeys.filter(key => !expectedKeys.includes(key));
          
          if (missing.length > 0) console.log('Missing time slots:', missing);
          if (extra.length > 0) console.log('Extra time slots:', extra);
        }

      } else {
        console.log('No time slots provided or not an array, keeping existing ones');
        
        // Keep existing time slots if none provided
        finalTimeSlots = await tx.timeSlot.findMany({
          where: { 
            courtId: courtId, 
            isActive: true 
          },
          orderBy: [
            { dayOfWeek: 'asc' },
            { startTime: 'asc' }
          ]
        });

        console.log('Kept existing time slots count:', finalTimeSlots.length);
      }

      console.log('=== TRANSACTION END ===');

      return {
        ...updatedCourt,
        timeSlots: finalTimeSlots,
      };
    }, {
      timeout: 60000, // 60 seconds timeout
      maxWait: 10000,
    });

    console.log('=== COURT UPDATE SUCCESS ===');
    console.log('Response time slots count:', result.timeSlots.length);
    
    successResponse(res, result, "Court updated successfully");
  } catch (error: any) {
    console.error('=== COURT UPDATE ERROR ===');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    logger.error("Error updating court:", {
      error: error.message,
      stack: error.stack,
      venueId: req.params.id,
      courtId: req.params.courtId,
      timeSlotsCount: req.body.timeSlots ? req.body.timeSlots.length : 0
    });
    
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