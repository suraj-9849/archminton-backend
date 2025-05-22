import { Request, Response } from 'express';
import authService from '../services/auth.service';
import { successResponse, errorResponse } from '../utils/response';
import logger from '../utils/logger';

/**
 * Controller for handling authentication routes
 */
export class AuthController {
  /**
   * Register a new user
   */
  async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, name, phone, gender } = req.body;
      
      const result = await authService.register({
        email,
        password,
        name,
        phone,
        gender
      });
      
      successResponse(res, result, 'User registered successfully', 201);
    } catch (error: any) {
      logger.error('Registration error:', error);
      errorResponse(res, error.message, 400);
    }
  }

  /**
   * Login a user
   */
  async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;
      
      const result = await authService.login({ email, password });
      
      successResponse(res, result, 'Login successful');
    } catch (error: any) {
      logger.error('Login error:', error);
      errorResponse(res, error.message, 401);
    }
  }

  /**
   * Refresh access token using a refresh token
   */
  async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        errorResponse(res, 'Refresh token is required', 400);
        return;
      }
      
      const result = await authService.refreshToken(refreshToken);
      
      successResponse(res, result, 'Token refreshed successfully');
    } catch (error: any) {
      logger.error('Token refresh error:', error);
      errorResponse(res, error.message, 401);
    }
  }

  /**
   * Change user password
   */
  async changePassword(req: Request, res: Response): Promise<void> {
    try {
      // Check if user exists in request
      const user = req.user;
      if (!user) {
        errorResponse(res, 'User not authenticated', 401);
        return;
      }
      
      const { currentPassword, newPassword } = req.body;
      
      const result = await authService.changePassword(
        user.userId,
        currentPassword,
        newPassword
      );
      
      successResponse(res, null, result);
    } catch (error: any) {
      logger.error('Password change error:', error);
      errorResponse(res, error.message, 400);
    }
  }
}

export default new AuthController();