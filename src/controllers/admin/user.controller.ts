import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { successResponse, errorResponse } from "../../utils/response";
import logger from "../../utils/logger";
import societyMembershipRequestService from "../../services/societyMembershipRequest.service";

const prisma = new PrismaClient();

export class AdminUserController {
  /**
   * Get all users with pagination and filters
   * @route GET /api/admin/users
   */
  async getUsers(req: Request, res: Response): Promise<void> {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;
      const search = req.query.search as string;
      const role = req.query.role as string;
      const sortBy = (req.query.sortBy as string) || "createdAt";
      const sortOrder = (req.query.sortOrder as "asc" | "desc") || "desc";

      const skip = (page - 1) * limit;
      const where: any = {};

      // Apply search filter
      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ];
      }

      // Apply role filter
      if (role) {
        where.role = role;
      }

      const [users, totalUsers] = await Promise.all([
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
            societyMemberships: {
              where: { isActive: true },
              include: {
                society: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
            _count: {
              select: {
                bookings: true,
                courseEnrollments: true,
              },
            },
          },
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
        }),
        prisma.user.count({ where }),
      ]);

      const totalPages = Math.ceil(totalUsers / limit);

      const response = {
        users,
        pagination: {
          page,
          limit,
          totalUsers,
          totalPages,
          hasNext: page < totalPages,
          hasPrevious: page > 1,
        },
      };

      successResponse(res, response, "Users retrieved successfully");
    } catch (error: any) {
      logger.error("Error getting users:", error);
      errorResponse(res, error.message || "Error retrieving users", 500);
    }
  }

  /**
   * Get user by ID
   * @route GET /api/admin/users/:id
   */
  async getUserById(req: Request, res: Response): Promise<void> {
    try {
      const userId = Number(req.params.id);

      if (isNaN(userId)) {
        errorResponse(res, "Invalid user ID", 400);
        return;
      }

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
          societyMemberships: {
            include: {
              society: {
                select: {
                  id: true,
                  name: true,
                  location: true,
                },
              },
            },
          },
          bookings: {
            take: 5,
            orderBy: { createdAt: "desc" },
            include: {
              court: {
                include: {
                  venue: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
          courseEnrollments: {
            take: 5,
            orderBy: { createdAt: "desc" },
            include: {
              course: {
                select: {
                  id: true,
                  name: true,
                  sportType: true,
                },
              },
            },
          },
        },
      });

      if (!user) {
        errorResponse(res, "User not found", 404);
        return;
      }

      successResponse(res, user, "User retrieved successfully");
    } catch (error: any) {
      logger.error("Error getting user by ID:", error);
      errorResponse(res, error.message || "Error retrieving user", 500);
    }
  }

  /**
   * Create a new user
   * @route POST /api/admin/users
   */
  async createUser(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, name, phone, gender, role, selectedSocieties } =
        req.body;

      console.log("Creating user with data:", {
        email,
        name,
        phone,
        gender,
        role,
        selectedSocieties: selectedSocieties || "none",
      });

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        errorResponse(res, "User with this email already exists", 400);
        return;
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const newUser = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          phone,
          gender,
          role: role || "USER",
        },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          gender: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      console.log("User created successfully:", newUser);

      // Create membership requests if societies are selected
      let membershipRequestsResult = null;
      if (
        selectedSocieties &&
        Array.isArray(selectedSocieties) &&
        selectedSocieties.length > 0
      ) {
        try {
          console.log(
            "Creating membership requests for societies:",
            selectedSocieties
          );

          membershipRequestsResult =
            await societyMembershipRequestService.createMembershipRequests({
              userId: newUser.id,
              societyIds: selectedSocieties,
            });

          console.log("Membership requests created:", membershipRequestsResult);
        } catch (membershipError: any) {
          console.error("Error creating membership requests:", membershipError);

          // Log the error but don't fail user creation
          logger.warn("Error creating membership requests:", membershipError);

          // You might want to return this error info to the frontend
          membershipRequestsResult = {
            error: membershipError.message,
            created: [],
            skipped: 0,
          };
        }
      } else {
        console.log("No societies selected for membership requests");
      }

      // Return response with user data and membership request info
      const responseData = {
        user: newUser,
        membershipRequests: membershipRequestsResult,
      };

      successResponse(res, responseData, "User created successfully", 201);
    } catch (error: any) {
      console.error("Error creating user:", error);
      logger.error("Error creating user:", error);
      errorResponse(res, error.message || "Error creating user", 400);
    }
  }

  /**
   * Update a user
   * @route PUT /api/admin/users/:id
   */
  async updateUser(req: Request, res: Response): Promise<void> {
    try {
      const userId = Number(req.params.id);
      const { name, phone, gender, role } = req.body;

      if (isNaN(userId)) {
        errorResponse(res, "Invalid user ID", 400);
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        errorResponse(res, "User not found", 404);
        return;
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          name,
          phone,
          gender,
          role,
        },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          gender: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      successResponse(res, updatedUser, "User updated successfully");
    } catch (error: any) {
      logger.error("Error updating user:", error);
      errorResponse(res, error.message || "Error updating user", 400);
    }
  }

  /**
   * Reset user password
   * @route POST /api/admin/users/:id/reset-password
   */
  async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const userId = Number(req.params.id);
      const { newPassword } = req.body;

      if (isNaN(userId)) {
        errorResponse(res, "Invalid user ID", 400);
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        errorResponse(res, "User not found", 404);
        return;
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      });

      successResponse(res, null, "Password reset successfully");
    } catch (error: any) {
      logger.error("Error resetting password:", error);
      errorResponse(res, error.message || "Error resetting password", 400);
    }
  }

  /**
   * Delete a user
   * @route DELETE /api/admin/users/:id
   */
  async deleteUser(req: Request, res: Response): Promise<void> {
    try {
      const userId = Number(req.params.id);

      if (isNaN(userId)) {
        errorResponse(res, "Invalid user ID", 400);
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        errorResponse(res, "User not found", 404);
        return;
      }

      // Check if user has active bookings
      const activeBookings = await prisma.booking.count({
        where: {
          userId,
          status: { in: ["PENDING", "CONFIRMED"] },
        },
      });

      if (activeBookings > 0) {
        errorResponse(res, "Cannot delete user with active bookings", 400);
        return;
      }

      await prisma.user.delete({
        where: { id: userId },
      });

      successResponse(res, null, "User deleted successfully");
    } catch (error: any) {
      logger.error("Error deleting user:", error);
      errorResponse(res, error.message || "Error deleting user", 400);
    }
  }

  /**
   * Get user's membership requests
   * @route GET /api/admin/users/:userId/membership-requests
   */
  async getUserMembershipRequests(req: Request, res: Response): Promise<void> {
    try {
      const userId = Number(req.params.userId);

      if (isNaN(userId)) {
        errorResponse(res, "Invalid user ID", 400);
        return;
      }

      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true },
      });

      if (!user) {
        errorResponse(res, "User not found", 404);
        return;
      }

      const requests =
        await societyMembershipRequestService.getUserMembershipRequests(userId);

      successResponse(
        res,
        {
          user,
          requests,
        },
        "User membership requests retrieved successfully"
      );
    } catch (error: any) {
      logger.error("Error getting user membership requests:", error);
      errorResponse(
        res,
        error.message || "Error retrieving user requests",
        500
      );
    }
  }
}

export default new AdminUserController();
