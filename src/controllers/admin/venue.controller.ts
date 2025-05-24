import { Request, Response } from "express";
import { PrismaClient, VenueType } from "@prisma/client";
import { successResponse, errorResponse } from "../../utils/response";
import logger from "../../utils/logger";

const prisma = new PrismaClient();

/**
 * Admin controller for venue management
 */
export class AdminVenueController {
  /**
   * Get all venues (admin view)
   * @route GET /api/admin/venues
   */
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
   * Create new venue
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
      } = req.body;

      if (!Object.values(VenueType).includes(venueType)) {
        errorResponse(res, "Invalid venue type", 400);
        return;
      }

      if (venueType === VenueType.PRIVATE && societyId) {
        const society = await prisma.society.findUnique({
          where: { id: Number(societyId) },
        });

        if (!society) {
          errorResponse(res, "Society not found", 404);
          return;
        }
      }

      const venue = await prisma.venue.create({
        data: {
          name,
          description,
          location,
          latitude: latitude ? Number(latitude) : null,
          longitude: longitude ? Number(longitude) : null,
          contactPhone,
          contactEmail,
          venueType,
          societyId: societyId ? Number(societyId) : null,
        },
        include: {
          society: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      successResponse(res, venue, "Venue created successfully", 201);
    } catch (error: any) {
      logger.error("Error creating venue:", error);
      errorResponse(res, error.message || "Error creating venue", 400);
    }
  }

  /**
   * Update venue
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

      if (venueType && !Object.values(VenueType).includes(venueType)) {
        errorResponse(res, "Invalid venue type", 400);
        return;
      }

      // Fixed validation logic for society
      if (societyId !== undefined && societyId !== null) {
        const society = await prisma.society.findUnique({
          where: { id: Number(societyId) },
        });

        if (!society) {
          errorResponse(res, "Society not found", 404);
          return;
        }
      }

      const venue = await prisma.venue.update({
        where: { id: venueId },
        data: {
          name,
          description,
          location,
          latitude: latitude ? Number(latitude) : undefined,
          longitude: longitude ? Number(longitude) : undefined,
          contactPhone,
          contactEmail,
          venueType,
          societyId: societyId ? Number(societyId) : null,
          isActive,
        },
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
        },
      });

      successResponse(res, venue, "Venue updated successfully");
    } catch (error: any) {
      logger.error("Error updating venue:", error);
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
              },
              _count: {
                select: {
                  bookings: true,
                },
              },
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

      successResponse(res, venue, "Venue details retrieved successfully");
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