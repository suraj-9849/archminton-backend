import { Request, Response } from 'express';
import courtService from '../services/court.service';
import { successResponse, errorResponse } from '../utils/response';
import logger from '../utils/logger';

/**
 * Controller for court-related endpoints
 */
export class CourtController {
  /**
   * Get all courts with filters
   * @route GET /api/courts
   */
  async getCourts(req: Request, res: Response): Promise<void> {
    try {
      const venueId = req.query.venueId ? Number(req.query.venueId) : undefined;
      const sportType = req.query.sportType as any | undefined;
      const isActive = req.query.isActive !== undefined 
        ? req.query.isActive === 'true' 
        : true;
      const search = req.query.search as string | undefined;

      const courts = await courtService.getAllCourts({
        venueId,
        sportType,
        isActive,
        search
      });

      successResponse(res, courts, 'Courts retrieved successfully');
    } catch (error: any) {
      logger.error('Error getting courts:', error);
      errorResponse(res, error.message || 'Error retrieving courts', 500);
    }
  }

  /**
   * Get court by ID
   * @route GET /api/courts/:id
   */
  async getCourtById(req: Request, res: Response): Promise<void> {
    try {
      const courtId = Number(req.params.id);
      
      if (isNaN(courtId)) {
        errorResponse(res, 'Invalid court ID', 400);
        return;
      }

      const court = await courtService.getCourtById(courtId);
      successResponse(res, court, 'Court retrieved successfully');
    } catch (error: any) {
      logger.error('Error getting court by ID:', error);
      errorResponse(
        res, 
        error.message || 'Error retrieving court', 
        error.message.includes('not found') ? 404 : 500
      );
    }
  }

  /**
   * Get court time slots
   * @route GET /api/courts/:id/timeslots
   */
  async getCourtTimeSlots(req: Request, res: Response): Promise<void> {
    try {
      const courtId = Number(req.params.id);
      
      if (isNaN(courtId)) {
        errorResponse(res, 'Invalid court ID', 400);
        return;
      }

      const includeInactive = req.query.includeInactive === 'true';
      const timeSlots = await courtService.getCourtTimeSlots(courtId, includeInactive);
      
      successResponse(res, timeSlots, 'Court time slots retrieved successfully');
    } catch (error: any) {
      logger.error('Error getting court time slots:', error);
      errorResponse(
        res, 
        error.message || 'Error retrieving time slots', 
        error.message.includes('not found') ? 404 : 500
      );
    }
  }
}

export default new CourtController();