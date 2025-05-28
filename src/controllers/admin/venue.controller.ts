import { Request, Response } from "express";
import { PrismaClient, VenueType } from "@prisma/client";
import { successResponse, errorResponse } from "../../utils/response";
import logger from "../../utils/logger";

const prisma = new PrismaClient();

/**
 * Admin controller for venue management
 */
export class AdminVenueController {
  async getAllVenues(req: Request, res: Response): Promise<void> {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;
      const search = req.query.search as string | undefined;
      const venueType = req.query.venueType as VenueType | undefined;
      const isActive =
        req.query.isActive !== undefined
          ? req.query.isActive === "true"
          : undefined;

      const where: any = {};

      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { location: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ];
      }

      if (venueType && Object.values(VenueType).includes(venueType)) {
        where.venueType = venueType;
      }

      if (isActive !== undefined) {
        where.isActive = isActive;
      }

      const skip = (page - 1) * limit;

      const [venues, totalVenues] = await Promise.all([
        prisma.venue.findMany({
          where,
          include: {
            society: {
              select: {
                id: true,
                name: true,
              },
            },
            courts: {
              select: {
                id: true,
                name: true,
                sportType: true,
                isActive: true,
              },
            },
            sportsConfig: {
              select: {
                id: true,
                sportType: true,
                maxCourts: true,
                isActive: true,
              },
            },
            images: {
              where: { isDefault: true },
              take: 1,
            },
            _count: {
              select: {
                courts: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          skip,
          take: limit,
        }),
        prisma.venue.count({ where }),
      ]);

      const totalPages = Math.ceil(totalVenues / limit);

      successResponse(
        res,
        {
          venues,
          pagination: {
            page,
            limit,
            totalVenues,
            totalPages,
            hasNext: page < totalPages,
            hasPrevious: page > 1,
          },
        },
        "Venues retrieved successfully"
      );
    } catch (error: any) {
      logger.error("Error getting venues (admin):", error);
      errorResponse(res, error.message || "Error retrieving venues", 500);
    }
  }

  /**
   * Create new venue - FIXED to handle optional fields properly
   * @route POST /api/admin/venues
   */
  async createVenue(req: Request, res: Response): Promise<void> {
    try {
      const {
        name,
        description,
        location,
        latitude,
        longitude,
        contactPhone,
        contactEmail,
        venueType,
        societyId,
        services,
        amenities,
        images,
      } = req.body;

      // Log the incoming request data for debugging
      logger.info("Creating venue with data:", {
        name,
        description,
        location,
        latitude,
        longitude,
        contactPhone,
        contactEmail,
        venueType,
        societyId,
        services,
        amenities,
        images,
      });

      // Validate required fields
      if (!name || !location || !venueType) {
        errorResponse(res, "Name, location, and venue type are required", 400);
        return;
      }

      // Validate venue type
      if (!Object.values(VenueType).includes(venueType as VenueType)) {
        errorResponse(res, `Invalid venue type. Must be one of: ${Object.values(VenueType).join(', ')}`, 400);
        return;
      }

      // Validate society if provided
      if (societyId !== null && societyId !== undefined && societyId !== '') {
        const societyIdNum = parseInt(societyId);
        if (isNaN(societyIdNum) || societyIdNum <= 0) {
          errorResponse(res, "Society ID must be a positive integer", 400);
          return;
        }

        const society = await prisma.society.findUnique({
          where: { id: societyIdNum },
        });

        if (!society) {
          errorResponse(res, "Society not found", 404);
          return;
        }
      }

      // Validate images if provided
      if (images && Array.isArray(images) && images.length > 0) {
        const invalidImage = images.find(
          (img: { imageUrl: string; isDefault: any }) =>
            !img.imageUrl ||
            typeof img.imageUrl !== "string" ||
            img.imageUrl.trim() === "" ||
            typeof img.isDefault !== "boolean"
        );

        if (invalidImage) {
          errorResponse(
            res,
            "Each image must have a valid 'imageUrl' string and 'isDefault' boolean",
            400
          );
          return;
        }
      }

      // Prepare data for Prisma create
      const venueData: any = {
        name: name.trim(),
        location: location.trim(),
        venueType: venueType as VenueType,
      };

      // Add optional fields only if they have values
      if (description && description.trim()) {
        venueData.description = description.trim();
      }

      if (latitude !== null && latitude !== undefined && latitude !== '') {
        const lat = parseFloat(latitude);
        if (!isNaN(lat)) {
          venueData.latitude = lat;
        }
      }

      if (longitude !== null && longitude !== undefined && longitude !== '') {
        const lng = parseFloat(longitude);
        if (!isNaN(lng)) {
          venueData.longitude = lng;
        }
      }

      if (contactPhone && contactPhone.trim()) {
        venueData.contactPhone = contactPhone.trim();
      }

      if (contactEmail && contactEmail.trim()) {
        venueData.contactEmail = contactEmail.trim();
      }

      if (societyId !== null && societyId !== undefined && societyId !== '') {
        const societyIdNum = parseInt(societyId);
        if (!isNaN(societyIdNum) && societyIdNum > 0) {
          venueData.societyId = societyIdNum;
        }
      }

      // Handle array fields safely
      if (services && Array.isArray(services) && services.length > 0) {
        venueData.services = { set: services.filter(s => s && s.trim()) };
      }

      if (amenities && Array.isArray(amenities) && amenities.length > 0) {
        venueData.amenities = { set: amenities.filter(a => a && a.trim()) };
      }

      // Handle images
      if (images && Array.isArray(images) && images.length > 0) {
        venueData.images = { 
          create: images.map(img => ({
            imageUrl: img.imageUrl.trim(),
            isDefault: Boolean(img.isDefault)
          }))
        };
      }

      logger.info("Final venue data for Prisma:", venueData);

      const venue = await prisma.venue.create({
        data: venueData,
        include: {
          society: {
            select: { id: true, name: true },
          },
          sportsConfig: true,
          images: true,
          courts: {
            select: {
              sportType: true,
            },
          },
        },
      });

      const formattedVenue = {
        ...venue,
        images: venue.images?.map((img) => img.imageUrl) || [],
        services: venue.services?.map((s) => formatEnum(s)) || [],
        amenities: venue.amenities?.map((a) => formatEnum(a)) || [],
        availableSports: [
          ...new Set(venue.courts?.map((c) => formatEnum(c.sportType)) || []),
        ],
      };

      logger.info("Venue created successfully:", { id: venue.id, name: venue.name });
      successResponse(res, formattedVenue, "Venue created successfully", 201);
    } catch (error: any) {
      logger.error("Error creating venue:", {
        message: error.message,
        stack: error.stack,
        code: error.code,
        meta: error.meta,
      });

      // Handle specific Prisma errors
      if (error.code === 'P2002') {
        errorResponse(res, "A venue with this name already exists at this location", 409);
        return;
      }

      if (error.code === 'P2003') {
        errorResponse(res, "Invalid reference to society or other related entity", 400);
        return;
      }

      if (error.message?.includes('kind')) {
        errorResponse(res, "Invalid data type provided. Please check your input values.", 400);
        return;
      }

      errorResponse(res, error.message || "Error creating venue", 400);
    }
  }

  /**
   * Update venue - FIXED to handle optional fields properly
   * @route PUT /api/admin/venues/:id
   */
  async updateVenue(req: Request, res: Response): Promise<void> {
    try {
      const venueId = Number(req.params.id);

      if (isNaN(venueId)) {
        errorResponse(res, "Invalid venue ID", 400);
        return;
      }

      const {
        name,
        description,
        location,
        latitude,
        longitude,
        contactPhone,
        contactEmail,
        venueType,
        societyId,
        isActive,
      } = req.body;

      const existingVenue = await prisma.venue.findUnique({
        where: { id: venueId },
      });

      if (!existingVenue) {
        errorResponse(res, "Venue not found", 404);
        return;
      }

      // Validate venue type if provided
      if (venueType && !Object.values(VenueType).includes(venueType)) {
        errorResponse(res, `Invalid venue type. Must be one of: ${Object.values(VenueType).join(', ')}`, 400);
        return;
      }

      // Validate society if provided
      if (societyId !== undefined && societyId !== null && societyId !== '') {
        const societyIdNum = parseInt(societyId);
        if (isNaN(societyIdNum) || societyIdNum <= 0) {
          errorResponse(res, "Society ID must be a positive integer", 400);
          return;
        }

        const society = await prisma.society.findUnique({
          where: { id: societyIdNum },
        });

        if (!society) {
          errorResponse(res, "Society not found", 404);
          return;
        }
      }

      // Prepare update data - only include fields that are provided
      const updateData: any = {};

      if (name !== undefined) {
        updateData.name = name.trim();
      }

      if (description !== undefined) {
        updateData.description = description ? description.trim() : null;
      }

      if (location !== undefined) {
        updateData.location = location.trim();
      }

      if (latitude !== undefined) {
        if (latitude === null || latitude === '') {
          updateData.latitude = null;
        } else {
          const lat = parseFloat(latitude);
          if (!isNaN(lat)) {
            updateData.latitude = lat;
          }
        }
      }

      if (longitude !== undefined) {
        if (longitude === null || longitude === '') {
          updateData.longitude = null;
        } else {
          const lng = parseFloat(longitude);
          if (!isNaN(lng)) {
            updateData.longitude = lng;
          }
        }
      }

      if (contactPhone !== undefined) {
        updateData.contactPhone = contactPhone ? contactPhone.trim() : null;
      }

      if (contactEmail !== undefined) {
        updateData.contactEmail = contactEmail ? contactEmail.trim() : null;
      }

      if (venueType !== undefined) {
        updateData.venueType = venueType;
      }

      if (societyId !== undefined) {
        if (societyId === null || societyId === '') {
          updateData.societyId = null;
        } else {
          const societyIdNum = parseInt(societyId);
          if (!isNaN(societyIdNum) && societyIdNum > 0) {
            updateData.societyId = societyIdNum;
          }
        }
      }

      if (isActive !== undefined) {
        updateData.isActive = Boolean(isActive);
      }

      logger.info("Updating venue with data:", updateData);

      const venue = await prisma.venue.update({
        where: { id: venueId },
        data: updateData,
        include: {
          society: {
            select: {
              id: true,
              name: true,
            },
          },
          courts: {
            select: {
              id: true,
              name: true,
              sportType: true,
              isActive: true,
            },
          },
          sportsConfig: {
            select: {
              id: true,
              sportType: true,
              maxCourts: true,
              isActive: true,
            },
          },
        },
      });

      successResponse(res, venue, "Venue updated successfully");
    } catch (error: any) {
      logger.error("Error updating venue:", {
        message: error.message,
        stack: error.stack,
        code: error.code,
        meta: error.meta,
      });

      // Handle specific Prisma errors
      if (error.code === 'P2002') {
        errorResponse(res, "A venue with this name already exists at this location", 409);
        return;
      }

      if (error.code === 'P2003') {
        errorResponse(res, "Invalid reference to society or other related entity", 400);
        return;
      }

      if (error.message?.includes('kind')) {
        errorResponse(res, "Invalid data type provided. Please check your input values.", 400);
        return;
      }

      errorResponse(res, error.message || "Error updating venue", 400);
    }
  }

  /**
   * Delete venue
   * @route DELETE /api/admin/venues/:id
   */
  async deleteVenue(req: Request, res: Response): Promise<void> {
    try {
      const venueId = Number(req.params.id);

      if (isNaN(venueId)) {
        errorResponse(res, "Invalid venue ID", 400);
        return;
      }

      const venue = await prisma.venue.findUnique({
        where: { id: venueId },
        include: {
          courts: {
            include: {
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
      });

      if (!venue) {
        errorResponse(res, "Venue not found", 404);
        return;
      }

      const activeBookings = venue.courts.some(
        (court) => court.bookings.length > 0
      );

      if (activeBookings) {
        await prisma.venue.update({
          where: { id: venueId },
          data: { isActive: false },
        });
        successResponse(
          res,
          null,
          "Venue deactivated successfully (has active bookings)"
        );
      } else {
        await prisma.venue.delete({
          where: { id: venueId },
        });
        successResponse(res, null, "Venue deleted successfully");
      }
    } catch (error: any) {
      logger.error("Error deleting venue:", error);
      errorResponse(res, error.message || "Error deleting venue", 400);
    }
  }

  /**
   * Get venue details (admin view)
   * @route GET /api/admin/venues/:id
   */
  async getVenueById(req: Request, res: Response): Promise<void> {
    try {
      const venueId = Number(req.params.id);

      if (isNaN(venueId)) {
        errorResponse(res, "Invalid venue ID", 400);
        return;
      }

      const venue = await prisma.venue.findUnique({
        where: { id: venueId },
        include: {
          society: true,
          courts: {
            include: {
              timeSlots: {
                where: { isActive: true },
                orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
              },
              _count: {
                select: {
                  bookings: true,
                },
              },
            },
          },
          sportsConfig: {
            select: {
              id: true,
              sportType: true,
              maxCourts: true,
              isActive: true,
              createdAt: true,
              updatedAt: true,
            },
            orderBy: {
              createdAt: "asc",
            },
          },
          images: true,
          venueUserAccess: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      if (!venue) {
        errorResponse(res, "Venue not found", 404);
        return;
      }

      const venueWithServices = {
        ...venue,
        services: venue?.services ?? [],
        amenities: venue?.amenities ?? [],
      };

      successResponse(
        res,
        venueWithServices,
        "Venue details retrieved successfully"
      );
    } catch (error: any) {
      logger.error("Error getting venue details (admin):", error);
      errorResponse(
        res,
        error.message || "Error retrieving venue details",
        500
      );
    }
  }

  /**
   * Grant user access to venue
   * @route POST /api/admin/venues/:id/access
   */
  async grantVenueAccess(req: Request, res: Response): Promise<void> {
    try {
      const venueId = Number(req.params.id);
      const { userId } = req.body;

      if (isNaN(venueId)) {
        errorResponse(res, "Invalid venue ID", 400);
        return;
      }

      if (!userId || isNaN(Number(userId))) {
        errorResponse(res, "Valid user ID is required", 400);
        return;
      }

      const venue = await prisma.venue.findUnique({
        where: { id: venueId },
      });

      if (!venue) {
        errorResponse(res, "Venue not found", 404);
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: Number(userId) },
      });

      if (!user) {
        errorResponse(res, "User not found", 404);
        return;
      }

      const existingAccess = await prisma.venueUserAccess.findUnique({
        where: {
          venueId_userId: {
            venueId,
            userId: Number(userId),
          },
        },
      });

      if (existingAccess) {
        errorResponse(res, "User already has access to this venue", 400);
        return;
      }

      const access = await prisma.venueUserAccess.create({
        data: {
          venueId,
          userId: Number(userId),
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          venue: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      successResponse(res, access, "Venue access granted successfully");
    } catch (error: any) {
      logger.error("Error granting venue access:", error);
      errorResponse(res, error.message || "Error granting venue access", 400);
    }
  }

  /**
   * Revoke user access to venue
   * @route DELETE /api/admin/venues/:id/access/:userId
   */
  async revokeVenueAccess(req: Request, res: Response): Promise<void> {
    try {
      const venueId = Number(req.params.id);
      const userId = Number(req.params.userId);

      if (isNaN(venueId) || isNaN(userId)) {
        errorResponse(res, "Invalid venue ID or user ID", 400);
        return;
      }

      const access = await prisma.venueUserAccess.findUnique({
        where: {
          venueId_userId: {
            venueId,
            userId,
          },
        },
      });

      if (!access) {
        errorResponse(res, "Venue access not found", 404);
        return;
      }

      await prisma.venueUserAccess.delete({
        where: {
          venueId_userId: {
            venueId,
            userId,
          },
        },
      });

      successResponse(res, null, "Venue access revoked successfully");
    } catch (error: any) {
      logger.error("Error revoking venue access:", error);
      errorResponse(res, error.message || "Error revoking venue access", 400);
    }
  }
}

export default new AdminVenueController();

// Helper function to format enum values
function formatEnum(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}