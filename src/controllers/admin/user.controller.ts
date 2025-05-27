import { Request, Response } from 'express';
import { PrismaClient, Role } from '@prisma/client';
import { successResponse, errorResponse } from '../../utils/response';
import logger from '../../utils/logger';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * Controller for admin user management
 */
export class AdminUserController {
  /**
   * Get all users with pagination and filters
   * @route GET /api/admin/users
   */
  async getUsers(req: Request, res: Response): Promise<void> {
    try {
      // Parse query parameters
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;
      const search = req.query.search as string | undefined;
      const role = req.query.role as Role | undefined;
      const sortBy = (req.query.sortBy as string) || 'createdAt';
      const sortOrder = (req.query.sortOrder as string) || 'desc';

      // Build filter conditions
      const where: any = {};

      // Add search filter
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } }
        ];
      }

      // Add role filter
      if (role && Object.values(Role).includes(role as Role)) {
        where.role = role;
      }

      // Calculate pagination values
      const skip = (page - 1) * limit;

      // Fetch users with pagination and filters - UPDATED TO INCLUDE MEMBERSHIPS
      const [users, totalUsers] = await Promise.all([
        // Get users for current page with memberships
        prisma.user.findMany({
          where,
          select: {
            id: true,
            email: true,
            name: true,
            phone: true,
            gender: true,
            role: true,
            createdAt: true,
            updatedAt: true,
            // ADD MEMBERSHIPS WITH PACKAGE DETAILS
            UserMembership: {
              include: {
                package: {
                  select: {
                    id: true,
                    name: true,
                    type: true,
                    price: true,
                    durationMonths: true,
                    credits: true,
                    maxBookingsPerMonth: true,
                    allowedSports: true,
                    isActive: true
                  }
                }
              },
              orderBy: {
                createdAt: 'desc'
              }
            }
          },
          orderBy: {
            [sortBy]: sortOrder
          },
          skip,
          take: limit
        }),
        
        // Get total count for pagination
        prisma.user.count({ where })
      ]);

      // Transform the response to match expected format
      const transformedUsers = users.map(user => ({
        ...user,
        memberships: user.UserMembership || []
      }));

      // Calculate pagination metadata
      const totalPages = Math.ceil(totalUsers / limit);
      const hasNext = page < totalPages;
      const hasPrevious = page > 1;

      successResponse(
        res,
        {
          users: transformedUsers,
          pagination: {
            page,
            limit,
            totalUsers,
            totalPages,
            hasNext,
            hasPrevious
          }
        },
        'Users retrieved successfully'
      );
    } catch (error: any) {
      logger.error('Error getting users:', error);
      errorResponse(res, error.message || 'Error retrieving users', 500);
    }
  }

  /**
   * Get user details by ID including related data
   * @route GET /api/admin/users/:id
   */
  async getUserById(req: Request, res: Response): Promise<void> {
    try {
      const userId = Number(req.params.id);
      
      if (isNaN(userId)) {
        errorResponse(res, 'Invalid user ID', 400);
        return;
      }

      // Get user with related data - UPDATED TO INCLUDE MEMBERSHIPS
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          gender: true,
          role: true,
          createdAt: true,
          updatedAt: true,
          // ADD MEMBERSHIPS
          UserMembership: {
            include: {
              package: {
                select: {
                  id: true,
                  name: true,
                  type: true,
                  price: true,
                  durationMonths: true,
                  credits: true,
                  maxBookingsPerMonth: true,
                  allowedSports: true,
                  isActive: true
                }
              }
            },
            orderBy: {
              createdAt: 'desc'
            }
          },
          societyMemberships: {
            include: {
              society: true
            }
          },
          bookings: {
            take: 10,
            orderBy: {
              createdAt: 'desc'
            },
            include: {
              court: {
                include: {
                  venue: true
                }
              },
              payment: true
            }
          },
          courseEnrollments: {
            include: {
              course: true
            }
          }
        }
      });

      if (!user) {
        errorResponse(res, 'User not found', 404);
        return;
      }

      // Transform the response to match expected format
      const transformedUser = {
        ...user,
        memberships: user.UserMembership || []
      };

      successResponse(res, transformedUser, 'User details retrieved successfully');
    } catch (error: any) {
      logger.error('Error getting user by ID:', error);
      errorResponse(res, error.message || 'Error retrieving user details', 500);
    }
  }

  // ... rest of your methods remain the same (createUser, updateUser, resetPassword, deleteUser)
  
  /**
   * Create a new user (admin capability)
   * @route POST /api/admin/users
   */
  async createUser(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, name, phone, gender, role } = req.body;

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email }
      });

      if (existingUser) {
        errorResponse(res, 'User with this email already exists', 400);
        return;
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Create new user
      const newUser = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          phone,
          gender,
          role: role && Object.values(Role).includes(role) ? role : Role.USER
        },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          gender: true,
          role: true,
          createdAt: true,
          updatedAt: true
        }
      });

      successResponse(res, newUser, 'User created successfully', 201);
    } catch (error: any) {
      logger.error('Error creating user:', error);
      errorResponse(res, error.message || 'Error creating user', 500);
    }
  }

  /**
   * Update a user
   * @route PUT /api/admin/users/:id
   */
  async updateUser(req: Request, res: Response): Promise<void> {
    try {
      const userId = Number(req.params.id);
      
      if (isNaN(userId)) {
        errorResponse(res, 'Invalid user ID', 400);
        return;
      }

      const { name, phone, gender, role } = req.body;

      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!existingUser) {
        errorResponse(res, 'User not found', 404);
        return;
      }

      // Prevent changing role for super admin
      if (existingUser.role === Role.SUPERADMIN && role && role !== Role.SUPERADMIN) {
        errorResponse(res, 'Cannot change role of super admin', 403);
        return;
      }

      // Update user
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          name,
          phone,
          gender,
          role: role && Object.values(Role).includes(role) ? role : undefined
        },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          gender: true,
          role: true,
          createdAt: true,
          updatedAt: true
        }
      });

      successResponse(res, updatedUser, 'User updated successfully');
    } catch (error: any) {
      logger.error('Error updating user:', error);
      errorResponse(res, error.message || 'Error updating user', 500);
    }
  }

  /**
   * Reset user password
   * @route POST /api/admin/users/:id/reset-password
   */
  async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const userId = Number(req.params.id);
      
      if (isNaN(userId)) {
        errorResponse(res, 'Invalid user ID', 400);
        return;
      }

      const { newPassword } = req.body;

      if (!newPassword || newPassword.length < 8) {
        errorResponse(res, 'New password must be at least 8 characters', 400);
        return;
      }

      // Check if user exists
      const existingUser = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!existingUser) {
        errorResponse(res, 'User not found', 404);
        return;
      }

      // Hash new password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      // Update user password
      await prisma.user.update({
        where: { id: userId },
        data: {
          password: hashedPassword
        }
      });

      successResponse(res, null, 'Password reset successfully');
    } catch (error: any) {
      logger.error('Error resetting password:', error);
      errorResponse(res, error.message || 'Error resetting password', 500);
    }
  }

  /**
   * Delete a user (soft delete by deactivating)
   * @route DELETE /api/admin/users/:id
   */
  async deleteUser(req: Request, res: Response): Promise<void> {
    try {
      const userId = Number(req.params.id);
      
      if (isNaN(userId)) {
        errorResponse(res, 'Invalid user ID', 400);
        return;
      }

      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        errorResponse(res, 'User not found', 404);
        return;
      }

      // Prevent deleting super admin
      if (user.role === Role.SUPERADMIN) {
        errorResponse(res, 'Cannot delete super admin', 403);
        return;
      }

      // Check if it's the current user trying to delete themselves
      if (req.user && req.user.userId === userId) {
        errorResponse(res, 'Cannot delete your own account', 403);
        return;
      }

      // Delete user (in a real application, consider soft delete)
      await prisma.user.delete({
        where: { id: userId }
      });

      successResponse(res, null, 'User deleted successfully');
    } catch (error: any) {
      logger.error('Error deleting user:', error);
      errorResponse(res, error.message || 'Error deleting user', 500);
    }
  }
}

export default new AdminUserController();