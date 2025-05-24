import { Request, Response } from 'express';
import societyService from '../../services/society.service';
import { successResponse, errorResponse } from '../../utils/response';
import logger from '../../utils/logger';

/**
 * Admin controller for society management
 */
export class AdminSocietyController {
  /**
   * Get all societies (admin view)
   * @route GET /api/admin/societies
   */
  async getAllSocieties(req: Request, res: Response): Promise<void> {
    try {
      const isActive = req.query.isActive !== undefined 
        ? req.query.isActive === 'true' 
        : undefined; // Show all by default for admin
      const search = req.query.search as string | undefined;

      const societies = await societyService.getAllSocieties({
        isActive,
        search
      });

      successResponse(res, societies, 'Societies retrieved successfully');
    } catch (error: any) {
      logger.error('Error getting societies (admin):', error);
      errorResponse(res, error.message || 'Error retrieving societies', 500);
    }
  }

  /**
   * Create new society
   * @route POST /api/admin/societies
   */
  async createSociety(req: Request, res: Response): Promise<void> {
    try {
      const { name, location, description, contactPerson, contactPhone } = req.body;

      const society = await societyService.createSociety({
        name,
        location,
        description,
        contactPerson,
        contactPhone
      });

      successResponse(res, society, 'Society created successfully', 201);
    } catch (error: any) {
      logger.error('Error creating society:', error);
      errorResponse(res, error.message || 'Error creating society', 400);
    }
  }

  /**
   * Update society
   * @route PUT /api/admin/societies/:id
   */
  async updateSociety(req: Request, res: Response): Promise<void> {
    try {
      const societyId = Number(req.params.id);
      
      if (isNaN(societyId)) {
        errorResponse(res, 'Invalid society ID', 400);
        return;
      }

      const { name, location, description, contactPerson, contactPhone, isActive } = req.body;

      const society = await societyService.updateSociety(societyId, {
        name,
        location,
        description,
        contactPerson,
        contactPhone,
        isActive
      });

      successResponse(res, society, 'Society updated successfully');
    } catch (error: any) {
      logger.error('Error updating society:', error);
      errorResponse(
        res, 
        error.message || 'Error updating society', 
        error.message.includes('not found') ? 404 : 400
      );
    }
  }

  /**
   * Delete society
   * @route DELETE /api/admin/societies/:id
   */
  async deleteSociety(req: Request, res: Response): Promise<void> {
    try {
      const societyId = Number(req.params.id);
      
      if (isNaN(societyId)) {
        errorResponse(res, 'Invalid society ID', 400);
        return;
      }

      await societyService.deleteSociety(societyId);
      successResponse(res, null, 'Society deleted successfully');
    } catch (error: any) {
      logger.error('Error deleting society:', error);
      errorResponse(
        res, 
        error.message || 'Error deleting society', 
        error.message.includes('not found') ? 404 : 400
      );
    }
  }

  /**
   * Add member to society
   * @route POST /api/admin/societies/:id/members
   */
  async addMember(req: Request, res: Response): Promise<void> {
    try {
      const societyId = Number(req.params.id);
      const { userId } = req.body;
      
      if (isNaN(societyId)) {
        errorResponse(res, 'Invalid society ID', 400);
        return;
      }

      if (!userId || isNaN(Number(userId))) {
        errorResponse(res, 'Valid user ID is required', 400);
        return;
      }

      const membership = await societyService.addMemberToSociety(societyId, Number(userId));
      successResponse(res, membership, 'Member added successfully');
    } catch (error: any) {
      logger.error('Error adding member to society:', error);
      errorResponse(res, error.message || 'Error adding member', 400);
    }
  }

  /**
   * Remove member from society
   * @route DELETE /api/admin/societies/:id/members/:userId
   */
  async removeMember(req: Request, res: Response): Promise<void> {
    try {
      const societyId = Number(req.params.id);
      const userId = Number(req.params.userId);
      
      if (isNaN(societyId) || isNaN(userId)) {
        errorResponse(res, 'Invalid society ID or user ID', 400);
        return;
      }

      await societyService.removeMemberFromSociety(societyId, userId);
      successResponse(res, null, 'Member removed successfully');
    } catch (error: any) {
      logger.error('Error removing member from society:', error);
      errorResponse(
        res, 
        error.message || 'Error removing member', 
        error.message.includes('not found') ? 404 : 400
      );
    }
  }


  /**
 * Get society by ID (admin view)
 * @route GET /api/admin/societies/:id
 */
async getSocietyById(req: Request, res: Response): Promise<void> {
  try {
    const societyId = Number(req.params.id);
    
    if (isNaN(societyId)) {
      errorResponse(res, 'Invalid society ID', 400);
      return;
    }

    const society = await societyService.getSocietyById(societyId);
    
    if (!society) {
      errorResponse(res, 'Society not found', 404);
      return;
    }

    successResponse(res, society, 'Society retrieved successfully');
  } catch (error: any) {
    logger.error('Error getting society by ID:', error);
    errorResponse(res, error.message || 'Error retrieving society', 500);
  }
}

/**
 * Get society statistics
 * @route GET /api/admin/societies/:id/statistics
 */
async getSocietyStatistics(req: Request, res: Response): Promise<void> {
  try {
    const societyId = req.params.id ? Number(req.params.id) : undefined;
    
    if (societyId && isNaN(societyId)) {
      errorResponse(res, 'Invalid society ID', 400);
      return;
    }

    const statistics = await societyService.getSocietyStatistics(societyId);
    successResponse(res, statistics, 'Statistics retrieved successfully');
  } catch (error: any) {
    logger.error('Error getting society statistics:', error);
    errorResponse(res, error.message || 'Error retrieving statistics', 500);
  }
}

/**
 * Toggle society status
 * @route PATCH /api/admin/societies/:id/toggle-status
 */
async toggleSocietyStatus(req: Request, res: Response): Promise<void> {
  try {
    const societyId = Number(req.params.id);
    
    if (isNaN(societyId)) {
      errorResponse(res, 'Invalid society ID', 400);
      return;
    }

    const society = await societyService.toggleSocietyStatus(societyId);
    successResponse(res, society, 'Society status updated successfully');
  } catch (error: any) {
    logger.error('Error toggling society status:', error);
    errorResponse(
      res, 
      error.message || 'Error updating society status', 
      error.message.includes('not found') ? 404 : 400
    );
  }
}
}

export default new AdminSocietyController();