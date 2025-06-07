import { Request, Response } from "express";
import venueService from "../services/venue.service";
import { successResponse, errorResponse } from "../utils/response";
import logger from "../utils/logger";

/**
 * Controller for venue-related endpoints
 */
export class VenueController {
  /**
   * Get all accessible venues for the authenticated user
   * @route GET /api/venues
   */
  async getVenues(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        errorResponse(res, "Unauthorized", 401);
        return;
      }

      // Parse query parameters
      const sportType = req.query.sportType as any | undefined;
      const location = req.query.location as string | undefined;
      const isActive =
        req.query.isActive !== undefined ? req.query.isActive === "true" : true;

      const venues = await venueService.getAccessibleVenues(req.user.userId, {
        sportType,
        location,
        isActive,
      });

      const venuesWithSports = venues.map((venue) => {
        const sports = [
          ...new Set(
            venue.courts?.map((court: { sportType: any }) => court.sportType) ||
              []
          ),
        ];

        return {
          ...venue,
          sports,
        };
      });

      successResponse(res, venuesWithSports, "Venues retrieved successfully");
    } catch (error: any) {
      logger.error("Error getting venues:", error);
      errorResponse(res, error.message, 400);
    }
  }

  /**
   * Get venue details by ID
   * @route GET /api/venues/:id
   */
  async getVenueById(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        errorResponse(res, "Unauthorized", 401);
        return;
      }

      const venueId = Number(req.params.id);

      if (isNaN(venueId)) {
        errorResponse(res, "Invalid venue ID", 400);
        return;
      }

      const venue = await venueService.getVenueById(venueId, req.user.userId);

      const venueWithSports = {
        ...venue,
        sports: [
          ...new Set(venue.courts?.map((court) => court.sportType) || []),
        ],
      };

      successResponse(res, venueWithSports, "Venue retrieved successfully");
    } catch (error: any) {
      logger.error("Error getting venue by ID:", error);
      errorResponse(
        res,
        error.message,
        error.message.includes("not found")
          ? 404
          : error.message.includes("access")
          ? 403
          : 400
      );
    }
  }

  /**
   * Get sports available at a venue
   * @route GET /api/venues/:id/sports
   */
  async getVenueSports(req: Request, res: Response): Promise<void> {
    try {
      const venueId = Number(req.params.id);

      if (isNaN(venueId)) {
        errorResponse(res, "Invalid venue ID", 400);
        return;
      }

      const sports = await venueService.getSportsByVenue(venueId);
      successResponse(res, sports, "Sports retrieved successfully");
    } catch (error: any) {
      logger.error("Error getting venue sports:", error);
      errorResponse(
        res,
        error.message,
        error.message.includes("not found") ? 404 : 400
      );
    }
  }

  /**
   * Get courts by venue and sport type
   * @route GET /api/venues/:id/courts
   */
  async getVenueCourts(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        errorResponse(res, "Unauthorized", 401);
        return;
      }

      const venueId = Number(req.params.id);

      if (isNaN(venueId)) {
        errorResponse(res, "Invalid venue ID", 400);
        return;
      }

      const sportType = req.query.sportType as any;

      if (!sportType) {
        errorResponse(res, "Valid sport type is required", 400);
        return;
      }

      // Parse date parameter if provided
      let date: Date | undefined;
      if (req.query.date) {
        date = new Date(req.query.date as string);
        if (isNaN(date.getTime())) {
          errorResponse(res, "Invalid date format", 400);
          return;
        }
      }

      const courts = await venueService.getCourtsByVenueAndSport(
        venueId,
        sportType,
        date
      );
      successResponse(res, courts, "Courts retrieved successfully");
    } catch (error: any) {
      logger.error("Error getting venue courts:", error);
      errorResponse(
        res,
        error.message,
        error.message.includes("not found") ? 404 : 400
      );
    }
  }

  /**
   * Search venues by name or location
   * @route GET /api/venues/search
   */
  async searchVenues(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        errorResponse(res, "Unauthorized", 401);
        return;
      }

      const query = req.query.q as string;

      if (!query || query.length < 2) {
        errorResponse(res, "Search query must be at least 2 characters", 400);
        return;
      }

      // Use the location parameter of getAccessibleVenues for search
      const venues = await venueService.getAccessibleVenues(req.user.userId, {
        location: query,
      });

      const venuesWithSports = venues.map((venue) => {
        const sports = [
          ...new Set(
            venue.courts?.map((court: { sportType: any }) => court.sportType) ||
              []
          ),
        ];
        return {
          ...venue,
          sports,
        };
      });

      successResponse(
        res,
        venuesWithSports,
        "Search results retrieved successfully"
      );
    } catch (error: any) {
      logger.error("Error searching venues:", error);
      errorResponse(res, error.message, 400);
    }
  }

  /**
   * Get venues by sport type
   * @route GET /api/venues/sport/:sportType
   */
  async getVenuesBySport(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        errorResponse(res, "Unauthorized", 401);
        return;
      }

      const sportType = req.params.sportType as any;

      if (!sportType) {
        errorResponse(res, "Valid sport type is required", 400);
        return;
      }

      const venues = await venueService.getAccessibleVenues(req.user.userId, {
        sportType,
      });

      const venuesWithSports = venues.map((venue) => {
        const sports = [
          ...new Set(
            venue.courts?.map((court: { sportType: any }) => court.sportType) ||
              []
          ),
        ];
        return {
          ...venue,
          sports,
        };
      });

      successResponse(res, venuesWithSports, "Venues retrieved successfully");
    } catch (error: any) {
      logger.error("Error getting venues by sport:", error);
      errorResponse(res, error.message, 400);
    }
  }
}

export default new VenueController();
