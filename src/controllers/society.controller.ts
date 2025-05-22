import { Request, Response } from 'express';
import societyService from '../services/society.service';
import { successResponse, errorResponse } from '../utils/response';
import logger from '../utils/logger';

/**
 * Controller for society-related endpoints
 */
export class SocietyController {
  /**
   * Get all societies
   * @route GET /api/societies
   */
  async getSocieties(req: Request, res: Response): Promise<void> {
    try {
      const isActive = req.query.isActive !== undefined 
        ? req.query.isActive === 'true' 
        : true;
      const search = req.query.search as string | undefined;

      const societies = await societyService.getAllSocieties({
        isActive,
        search
      });

      successResponse(res, societies, 'Societies retrieved successfully');
    } catch (error: any) {
      logger.error('Error getting societies:', error);
      errorResponse(res, error.message || 'Error retrieving societies', 500);
    }
  }

  /**
   * Get society by ID
   * @route GET /api/societies/:id
   */
  async getSocietyById(req: Request, res: Response): Promise<void> {
    try {
      const societyId = Number(req.params.id);
      
      if (isNaN(societyId)) {
        errorResponse(res, 'Invalid society ID', 400);
        return;
      }

      const society = await societyService.getSocietyById(societyId);
      successResponse(res, society, 'Society retrieved successfully');
    } catch (error: any) {
      logger.error('Error getting society by ID:', error);
      errorResponse(
        res, 
        error.message || 'Error retrieving society', 
        error.message.includes('not found') ? 404 : 500
      );
    }
  }

  /**
   * Get society members
   * @route GET /api/societies/:id/members
   */
  async getSocietyMembers(req: Request, res: Response): Promise<void> {
    try {
      const societyId = Number(req.params.id);
      
      if (isNaN(societyId)) {
        errorResponse(res, 'Invalid society ID', 400);
        return;
      }

      const includeInactive = req.query.includeInactive === 'true';
      const members = await societyService.getSocietyMembers(societyId, includeInactive);
      
      successResponse(res, members, 'Society members retrieved successfully');
    } catch (error: any) {
      logger.error('Error getting society members:', error);
      errorResponse(
        res, 
        error.message || 'Error retrieving society members', 
        error.message.includes('not found') ? 404 : 500
      );
    }
  }
}

export default new SocietyController();