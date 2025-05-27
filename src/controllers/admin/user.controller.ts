import { Request, Response } from "express";
import { PrismaClient, Role } from "@prisma/client";
import { successResponse, errorResponse } from "../../utils/response";
import logger from "../../utils/logger";
import * as bcrypt from "bcryptjs";
import approvalService from "../../services/approval.service";

const prisma = new PrismaClient();

/**
 * Controller for admin user management with approval integration
 */
export class AdminUserController {
  /**
   * Get all users with pagination and filters
   * @route GET /api/admin/users
   */
  async getUsers(req: Request, res: Response): Promise<void> {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;
      const search = req.query.search as string | undefined;
      const role = req.query.role as Role | undefined;
      const sortBy = (req.query.sortBy as string) || "createdAt";
      const sortOrder = (req.query.sortOrder as string) || "desc";

      const where: any = {};

      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
        ];
      }

      if (role && Object.values(Role).includes(role as Role)) {
        where.role = role;
      }

      const skip = (page - 1) * limit;

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
            submittedApprovals: {
              select: {
                id: true,
                type: true,
                status: true,
              },
            },
          },
          orderBy: {
            [sortBy]: sortOrder,
          },
          skip,
          take: limit,
        }),

        prisma.user.count({ where }),
      ]);

      const usersWithStats = users.map((user) => ({
        ...user,
        approvalStats: {
          total: user.submittedApprovals.length,
          pending: user.submittedApprovals.filter((a) => a.status === "PENDING")
            .length,
          approved: user.submittedApprovals.filter(
            (a) => a.status === "APPROVED"
          ).length,
          rejected: user.submittedApprovals.filter(
            (a) => a.status === "REJECTED"
          ).length,
        },
        submittedApprovals: undefined, // Remove from response for cleaner output
      }));

      const totalPages = Math.ceil(totalUsers / limit);
      const hasNext = page < totalPages;
      const hasPrevious = page > 1;

      successResponse(
        res,
        {
          users: usersWithStats,
          pagination: {
            page,
            limit,
            totalUsers,
            totalPages,
            hasNext,
            hasPrevious,
          },
        },
        "Users retrieved successfully"
      );
    } catch (error: any) {
      logger.error("Error getting users:", error);
      errorResponse(res, error.message || "Error retrieving users", 500);
    }
  }

  /**
   * Get user details by ID including related data and approval history
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
            take: 10,
            orderBy: {
              createdAt: "desc",
            },
            include: {
              court: {
                include: {
                  venue: true,
                },
              },
              payment: true,
            },
          },
          courseEnrollments: {
            include: {
              course: true,
            },
          },
        },
      });

      if (!user) {
        errorResponse(res, "User not found", 404);
        return;
      }

      const approvalHistory = await approvalService.getUserApprovalRequests(
        userId
      );

      successResponse(
        res,
        {
          ...user,
          approvalHistory,
        },
        "User details retrieved successfully"
      );
    } catch (error: any) {
      logger.error("Error getting user by ID:", error);
      errorResponse(res, error.message || "Error retrieving user details", 500);
    }
  }

  /**
   * Create a new user (admin capability)
   * @route POST /api/admin/users
   */
  async createUser(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, name, phone, gender, role, societyIds } =
        req.body;

      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        errorResponse(res, "User with this email already exists", 400);
        return;
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const newUser = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          phone,
          gender,
          role: role && Object.values(Role).includes(role) ? role : Role.USER,
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

      if (societyIds && Array.isArray(societyIds) && societyIds.length > 0) {
        const approvalPromises = societyIds.map((societyId) =>
          approvalService.createApprovalRequest({
            type: "SOCIETY_MEMBERSHIP",
            requesterId: newUser.id,
            societyId: Number(societyId),
            comments: "Society membership requested during user creation",
          })
        );

        try {
          const approvals = await Promise.all(approvalPromises);

          successResponse(
            res,
            {
              user: newUser,
              pendingApprovals: approvals,
              message:
                "User created successfully. Society membership requests have been submitted for approval.",
            },
            "User created successfully",
            201
          );
        } catch (approvalError: any) {
          logger.error("Error creating approval requests:", approvalError);
          successResponse(
            res,
            {
              user: newUser,
              message:
                "User created successfully, but some society membership requests could not be submitted.",
            },
            "User created with partial approval requests",
            201
          );
        }
      } else {
        successResponse(res, newUser, "User created successfully", 201);
      }
    } catch (error: any) {
      logger.error("Error creating user:", error);
      errorResponse(res, error.message || "Error creating user", 500);
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
        errorResponse(res, "Invalid user ID", 400);
        return;
      }

      const { name, phone, gender, role, requestedSocietyIds } = req.body;

      const existingUser = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!existingUser) {
        errorResponse(res, "User not found", 404);
        return;
      }

      if (
        existingUser.role === Role.SUPERADMIN &&
        role &&
        role !== Role.SUPERADMIN
      ) {
        errorResponse(res, "Cannot change role of super admin", 403);
        return;
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          name,
          phone,
          gender,
          role: role && Object.values(Role).includes(role) ? role : undefined,
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

      let approvalRequests: any = [];
      if (
        requestedSocietyIds &&
        Array.isArray(requestedSocietyIds) &&
        requestedSocietyIds.length > 0
      ) {
        try {
          const approvalPromises = requestedSocietyIds.map((societyId) =>
            approvalService.createApprovalRequest({
              type: "SOCIETY_MEMBERSHIP",
              requesterId: userId,
              societyId: Number(societyId),
              comments: "Society membership requested during user update",
            })
          );

          approvalRequests = await Promise.all(approvalPromises);
        } catch (approvalError: any) {
          logger.error(
            "Error creating approval requests during update:",
            approvalError
          );
        }
      }

      const response = {
        user: updatedUser,
        ...(approvalRequests.length > 0 && {
          newApprovalRequests: approvalRequests,
          message:
            "User updated successfully. New society membership requests have been submitted for approval.",
        }),
      };

      successResponse(res, response, "User updated successfully");
    } catch (error: any) {
      logger.error("Error updating user:", error);
      errorResponse(res, error.message || "Error updating user", 500);
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
        errorResponse(res, "Invalid user ID", 400);
        return;
      }

      const { newPassword } = req.body;

      if (!newPassword || newPassword.length < 8) {
        errorResponse(res, "New password must be at least 8 characters", 400);
        return;
      }

      const existingUser = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!existingUser) {
        errorResponse(res, "User not found", 404);
        return;
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(newPassword, salt);

      await prisma.user.update({
        where: { id: userId },
        data: {
          password: hashedPassword,
        },
      });

      successResponse(res, null, "Password reset successfully");
    } catch (error: any) {
      logger.error("Error resetting password:", error);
      errorResponse(res, error.message || "Error resetting password", 500);
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

      if (user.role === Role.SUPERADMIN) {
        errorResponse(res, "Cannot delete super admin", 403);
        return;
      }

      if (req.user && req.user.userId === userId) {
        errorResponse(res, "Cannot delete your own account", 403);
        return;
      }

      await prisma.approval.updateMany({
        where: {
          requesterId: userId,
          status: "PENDING",
        },
        data: {
          status: "CANCELLED",
        },
      });

      await prisma.user.delete({
        where: { id: userId },
      });

      successResponse(res, null, "User deleted successfully");
    } catch (error: any) {
      logger.error("Error deleting user:", error);
      errorResponse(res, error.message || "Error deleting user", 500);
    }
  }

  /**
   * Get user's approval requests
   * @route GET /api/admin/users/:id/approvals
   */
  async getUserApprovals(req: Request, res: Response): Promise<void> {
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

      const approvals = await approvalService.getUserApprovalRequests(userId);
      successResponse(
        res,
        approvals,
        "User approval requests retrieved successfully"
      );
    } catch (error: any) {
      logger.error("Error getting user approvals:", error);
      errorResponse(
        res,
        error.message || "Error retrieving user approvals",
        500
      );
    }
  }
}

export default new AdminUserController();
