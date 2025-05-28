import { Request, Response } from 'express';
import holidayService from '../../services/holiday.service';
import { successResponse, errorResponse } from '../../utils/response';
import logger from '../../utils/logger';

export class AdminHolidayController {
  /**
   * Get all holidays
   * @route GET /api/admin/holidays
   */
  async getAllHolidays(req: Request, res: Response): Promise<void> {
    try {
      const venueId = req.query.venueId ? Number(req.query.venueId) : undefined;
      const includeInactive = req.query.includeInactive === 'true';

      const holidays = await holidayService.getAllHolidays(venueId, includeInactive);
      successResponse(res, holidays, 'Holidays retrieved successfully');
    } catch (error: any) {
      logger.error('Error getting holidays:', error);
      errorResponse(res, error.message || 'Error retrieving holidays', 500);
    }
  }

  /**
   * Get holiday by ID
   * @route GET /api/admin/holidays/:id
   */
  async getHolidayById(req: Request, res: Response): Promise<void> {
    try {
      const holidayId = Number(req.params.id);
      
      if (isNaN(holidayId)) {
        errorResponse(res, 'Invalid holiday ID', 400);
        return;
      }

      const holiday = await holidayService.getHolidayById(holidayId);
      successResponse(res, holiday, 'Holiday retrieved successfully');
    } catch (error: any) {
      logger.error('Error getting holiday by ID:', error);
      errorResponse(
        res, 
        error.message || 'Error retrieving holiday', 
        error.message.includes('not found') ? 404 : 500
      );
    }
  }

  /**
   * Create new holiday
   * @route POST /api/admin/holidays
   */
  async createHoliday(req: Request, res: Response): Promise<void> {
    try {
      const { name, date, venueId, multiplier, description } = req.body;

      const holiday = await holidayService.createHoliday({
        name,
        date: new Date(date),
        venueId: venueId ? Number(venueId) : undefined,
        multiplier: multiplier ? Number(multiplier) : undefined,
        description
      });

      successResponse(res, holiday, 'Holiday created successfully', 201);
    } catch (error: any) {
      logger.error('Error creating holiday:', error);
      errorResponse(res, error.message || 'Error creating holiday', 400);
    }
  }

  /**
   * Update holiday
   * @route PUT /api/admin/holidays/:id
   */
  async updateHoliday(req: Request, res: Response): Promise<void> {
    try {
      const holidayId = Number(req.params.id);
      
      if (isNaN(holidayId)) {
        errorResponse(res, 'Invalid holiday ID', 400);
        return;
      }

      const { name, date, multiplier, description, isActive } = req.body;
      
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (date !== undefined) updateData.date = new Date(date);
      if (multiplier !== undefined) updateData.multiplier = Number(multiplier);
      if (description !== undefined) updateData.description = description;
      if (isActive !== undefined) updateData.isActive = isActive;

      const holiday = await holidayService.updateHoliday(holidayId, updateData);
      successResponse(res, holiday, 'Holiday updated successfully');
    } catch (error: any) {
      logger.error('Error updating holiday:', error);
      errorResponse(
        res, 
        error.message || 'Error updating holiday', 
        error.message.includes('not found') ? 404 : 400
      );
    }
  }

  /**
   * Delete holiday
   * @route DELETE /api/admin/holidays/:id
   */
  async deleteHoliday(req: Request, res: Response): Promise<void> {
    try {
      const holidayId = Number(req.params.id);
      
      if (isNaN(holidayId)) {
        errorResponse(res, 'Invalid holiday ID', 400);
        return;
      }

      await holidayService.deleteHoliday(holidayId);
      successResponse(res, null, 'Holiday deleted successfully');
    } catch (error: any) {
      logger.error('Error deleting holiday:', error);
      errorResponse(
        res, 
        error.message || 'Error deleting holiday', 
        error.message.includes('not found') ? 404 : 400
      );
    }
  }

  /**
   * Check if a date is a holiday
   * @route GET /api/admin/holidays/check/:date
   */
  async checkHoliday(req: Request, res: Response): Promise<void> {
    try {
      const date = new Date(req.params.date);
      const venueId = req.query.venueId ? Number(req.query.venueId) : undefined;

      if (isNaN(date.getTime())) {
        errorResponse(res, 'Invalid date format', 400);
        return;
      }

      const result = await holidayService.isHoliday(date, venueId);
      successResponse(res, result, 'Holiday check completed');
    } catch (error: any) {
      logger.error('Error checking holiday:', error);
      errorResponse(res, error.message || 'Error checking holiday', 500);
    }
  }

  /**
   * Get upcoming holidays
   * @route GET /api/admin/holidays/upcoming
   */
  async getUpcomingHolidays(req: Request, res: Response): Promise<void> {
    try {
      const venueId = req.query.venueId ? Number(req.query.venueId) : undefined;
      const days = req.query.days ? Number(req.query.days) : 30;

      const holidays = await holidayService.getUpcomingHolidays(venueId, days);
      successResponse(res, holidays, 'Upcoming holidays retrieved successfully');
    } catch (error: any) {
      logger.error('Error getting upcoming holidays:', error);
      errorResponse(res, error.message || 'Error retrieving upcoming holidays', 500);
    }
  }
}

export default new AdminHolidayController();