import { Request, Response } from 'express';
import courseService from '../services/course.service';
import { successResponse, errorResponse } from '../utils/response';
import logger from '../utils/logger';
import {  PaymentStatus } from '@prisma/client';

/**
 * Controller for course-related endpoints
 */
export class CourseController {
  /**
   * Get all courses with filters
   * @route GET /api/courses
   */
  async getCourses(req: Request, res: Response): Promise<void> {
    try {
      const sportType = req.query.sportType as any | undefined;
      const venueId = req.query.venueId ? Number(req.query.venueId) : undefined;
      const isActive = req.query.isActive !== undefined 
        ? req.query.isActive === 'true' 
        : true;
      const search = req.query.search as string | undefined;

      const courses = await courseService.getAllCourses({
        sportType,
        venueId,
        isActive,
        search
      });

      successResponse(res, courses, 'Courses retrieved successfully');
    } catch (error: any) {
      logger.error('Error getting courses:', error);
      errorResponse(res, error.message || 'Error retrieving courses', 500);
    }
  }

  /**
   * Get course by ID
   * @route GET /api/courses/:id
   */
  async getCourseById(req: Request, res: Response): Promise<void> {
    try {
      const courseId = Number(req.params.id);
      
      if (isNaN(courseId)) {
        errorResponse(res, 'Invalid course ID', 400);
        return;
      }

      const course = await courseService.getCourseById(courseId);
      successResponse(res, course, 'Course retrieved successfully');
    } catch (error: any) {
      logger.error('Error getting course by ID:', error);
      errorResponse(
        res, 
        error.message || 'Error retrieving course', 
        error.message.includes('not found') ? 404 : 500
      );
    }
  }

  /**
   * Get upcoming courses
   * @route GET /api/courses/upcoming
   */
  async getUpcomingCourses(req: Request, res: Response): Promise<void> {
    try {
      const courses = await courseService.getUpcomingCourses();
      successResponse(res, courses, 'Upcoming courses retrieved successfully');
    } catch (error: any) {
      logger.error('Error getting upcoming courses:', error);
      errorResponse(res, error.message || 'Error retrieving upcoming courses', 500);
    }
  }

  /**
   * Get courses by venue
   * @route GET /api/courses/venue/:venueId
   */
  async getCoursesByVenue(req: Request, res: Response): Promise<void> {
    try {
      const venueId = Number(req.params.venueId);
      
      if (isNaN(venueId)) {
        errorResponse(res, 'Invalid venue ID', 400);
        return;
      }

      const includeInactive = req.query.includeInactive === 'true';
      const courses = await courseService.getCoursesByVenue(venueId, includeInactive);
      
      successResponse(res, courses, 'Courses by venue retrieved successfully');
    } catch (error: any) {
      logger.error('Error getting courses by venue:', error);
      errorResponse(res, error.message || 'Error retrieving courses by venue', 500);
    }
  }

  /**
   * Enroll in course
   * @route POST /api/courses/:id/enroll
   */
  async enrollInCourse(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        errorResponse(res, 'Unauthorized', 401);
        return;
      }

      const courseId = Number(req.params.id);
      
      if (isNaN(courseId)) {
        errorResponse(res, 'Invalid course ID', 400);
        return;
      }

      const { startDate, endDate } = req.body;

      if (!startDate || !endDate) {
        errorResponse(res, 'Start date and end date are required', 400);
        return;
      }

      const enrollment = await courseService.enrollInCourse({
        userId: req.user.userId,
        courseId,
        startDate: new Date(startDate),
        endDate: new Date(endDate)
      });

      successResponse(res, enrollment, 'Successfully enrolled in course', 201);
    } catch (error: any) {
      logger.error('Error enrolling in course:', error);
      errorResponse(res, error.message || 'Error enrolling in course', 400);
    }
  }
}

export default new CourseController();