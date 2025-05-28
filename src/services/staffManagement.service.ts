// src/services/staffManagement.service.ts
import { PrismaClient, Role } from "@prisma/client";
import logger from "../utils/logger";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export interface CreateStaffInput {
  venueId: number;
  firstName: string;
  lastName?: string;
  email: string;
  phone?: string;
  username: string;
  password: string;
  confirmPassword: string;
  role: "ADMIN" | "DESK";
  permissions?: string[];
}

export interface UpdateStaffInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  username?: string;
  role?: "ADMIN" | "DESK";
  permissions?: string[];
  isActive?: boolean;
}

export interface StaffPermissions {
  // Booking Management
  booking_view: boolean;
  booking_create: boolean;
  booking_edit: boolean;
  booking_cancel: boolean;
  booking_reschedule: boolean;
  booking_discount: boolean;
  booking_pattern: boolean;

  // Member Management
  member_view: boolean;
  member_create: boolean;
  member_edit: boolean;
  member_delete: boolean;
  member_recharge: boolean;

  // Membership Management
  membership_view: boolean;
  membership_create: boolean;
  membership_edit: boolean;
  membership_delete: boolean;

  // Package Management
  package_view: boolean;
  package_create: boolean;
  package_edit: boolean;
  package_delete: boolean;

  // Reports
  reports_view: boolean;
  reports_download: boolean;

  // Search
  search: boolean;

  // Pricing
  pricing_view: boolean;
  pricing_edit: boolean;

  // Extras
  extras_view: boolean;
  extras_edit: boolean;

  // Staff Management
  staff_management: boolean;
  extras_pricing: boolean;

  // Events
  events_view: boolean;
  events_create: boolean;
  events_edit: boolean;

  // Dashboard
  dashboard_view: boolean;
  multiple_reports: boolean;
  multiple_reports_download: boolean;
  past_booking_modification: boolean;
}

const DEFAULT_ADMIN_PERMISSIONS: Partial<StaffPermissions> = {
  booking_view: true,
  booking_create: true,
  booking_edit: true,
  booking_cancel: true,
  booking_reschedule: true,
  booking_discount: true,
  booking_pattern: true,
  member_view: true,
  member_create: true,
  member_edit: true,
  member_recharge: true,
  membership_view: true,
  package_view: true,
  reports_view: true,
  reports_download: true,
  search: true,
  pricing_view: true,
  pricing_edit: true,
  extras_view: true,
  extras_edit: true,
  staff_management: true,
  extras_pricing: true,
  events_view: true,
  events_create: true,
  events_edit: true,
  dashboard_view: true,
  multiple_reports: true,
  multiple_reports_download: true,
  past_booking_modification: true,
};

const DEFAULT_DESK_PERMISSIONS: Partial<StaffPermissions> = {
  booking_view: true,
  booking_create: true,
  booking_edit: true,
  member_view: true,
  member_create: true,
  search: true,
  dashboard_view: true,
};

export class StaffManagementService {
  /**
   * Get all staff members for a venue
   */

  /**
   * Create new staff member and give them venue access
   */
  async createStaff(staffData: CreateStaffInput) {
    try {
      if (staffData.password !== staffData.confirmPassword) {
        throw new Error("Passwords do not match");
      }

      if (staffData.password.length < 8) {
        throw new Error("Password must be at least 8 characters long");
      }

      const venue = await prisma.venue.findUnique({
        where: { id: staffData.venueId },
      });

      if (!venue) {
        throw new Error("Venue not found");
      }

      const existingUser = await prisma.user.findUnique({
        where: { email: staffData.email },
      });

      if (existingUser) {
        const existingAccess = await prisma.venueUserAccess.findUnique({
          where: {
            venueId_userId: {
              venueId: staffData.venueId,
              userId: existingUser.id,
            },
          },
        });

        if (existingAccess) {
          throw new Error("User already has access to this venue");
        }

        const venueAccess = await prisma.venueUserAccess.create({
          data: {
            venueId: staffData.venueId,
            userId: existingUser.id,
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                role: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
        });

        const [firstName, ...lastNameParts] = existingUser.name.split(" ");
        return {
          id: existingUser.id,
          firstName: firstName || existingUser.name,
          lastName: lastNameParts.join(" ") || null,
          email: existingUser.email,
          phone: existingUser.phone,
          username: existingUser.email,
          role:
            existingUser.role === Role.VENUE_MANAGER ||
            existingUser.role === Role.ADMIN
              ? "ADMIN"
              : "DESK",
          permissions: this.getUserPermissions(existingUser.role),
          isActive: true,
          createdAt: existingUser.createdAt,
          updatedAt: existingUser.updatedAt,
          venueAccessId: venueAccess.id,
        };
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(staffData.password, salt);

      const userRole =
        staffData.role === "ADMIN" ? Role.VENUE_MANAGER : Role.USER;
      const fullName = `${staffData.firstName}${
        staffData.lastName ? " " + staffData.lastName : ""
      }`;

      const result = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            email: staffData.email,
            password: hashedPassword,
            name: fullName,
            phone: staffData.phone,
            role: userRole,
          },
        });

        const venueAccess = await tx.venueUserAccess.create({
          data: {
            venueId: staffData.venueId,
            userId: newUser.id,
          },
        });

        return {
          user: newUser,
          venueAccess,
        };
      });

      return {
        id: result.user.id,
        firstName: staffData.firstName,
        lastName: staffData.lastName,
        email: result.user.email,
        phone: result.user.phone,
        username: staffData.username,
        role: staffData.role,
        permissions: this.getUserPermissions(result.user.role),
        isActive: true,
        createdAt: result.user.createdAt,
        updatedAt: result.user.updatedAt,
        venueAccessId: result.venueAccess.id,
      };
    } catch (error) {
      logger.error("Error in createStaff:", error);
      throw error;
    }
  }

  /**
   * Update staff member information
   */
  async updateStaff(
    userId: number,
    venueId: number,
    updateData: UpdateStaffInput
  ) {
    try {
      const venueAccess = await prisma.venueUserAccess.findUnique({
        where: {
          venueId_userId: {
            venueId,
            userId,
          },
        },
        include: {
          user: true,
        },
      });

      if (!venueAccess) {
        throw new Error("Staff member not found in this venue");
      }

      const userUpdateData: any = {};

      if (updateData.firstName || updateData.lastName) {
        const firstName =
          updateData.firstName || venueAccess.user.name.split(" ")[0];
        const lastName = updateData.lastName || "";
        userUpdateData.name = `${firstName}${lastName ? " " + lastName : ""}`;
      }

      if (updateData.email) {
        const existingUser = await prisma.user.findFirst({
          where: {
            email: updateData.email,
            id: { not: userId },
          },
        });

        if (existingUser) {
          throw new Error("Email is already taken by another user");
        }
        userUpdateData.email = updateData.email;
      }

      if (updateData.phone !== undefined) {
        userUpdateData.phone = updateData.phone;
      }

      if (updateData.role) {
        userUpdateData.role =
          updateData.role === "ADMIN" ? Role.VENUE_MANAGER : Role.USER;
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: userUpdateData,
      });

      const [firstName, ...lastNameParts] = updatedUser.name.split(" ");
      return {
        id: updatedUser.id,
        firstName: firstName || updatedUser.name,
        lastName: lastNameParts.join(" ") || null,
        email: updatedUser.email,
        phone: updatedUser.phone,
        username: updatedUser.email,
        role:
          updatedUser.role === Role.VENUE_MANAGER ||
          updatedUser.role === Role.ADMIN
            ? "ADMIN"
            : "DESK",
        permissions: this.getUserPermissions(updatedUser.role),
        isActive: true,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt,
        venueAccessId: venueAccess.id,
      };
    } catch (error) {
      logger.error("Error in updateStaff:", error);
      throw error;
    }
  }

  /**
   * Remove staff member from venue (revoke access)
   */
  async removeStaff(userId: number, venueId: number) {
    try {
      const venueAccess = await prisma.venueUserAccess.findUnique({
        where: {
          venueId_userId: {
            venueId,
            userId,
          },
        },
      });

      if (!venueAccess) {
        throw new Error("Staff member not found in this venue");
      }

      await prisma.venueUserAccess.delete({
        where: {
          venueId_userId: {
            venueId,
            userId,
          },
        },
      });

      return { message: "Staff member removed from venue successfully" };
    } catch (error) {
      logger.error("Error in removeStaff:", error);
      throw error;
    }
  }

  /**
   * Get staff member details by ID
   */
  async getStaffById(userId: number, venueId: number) {
    try {
      const venueAccess = await prisma.venueUserAccess.findUnique({
        where: {
          venueId_userId: {
            venueId,
            userId,
          },
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              role: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      });

      if (!venueAccess) {
        throw new Error("Staff member not found in this venue");
      }

      const [firstName, ...lastNameParts] = venueAccess.user.name.split(" ");
      return {
        id: venueAccess.user.id,
        firstName: firstName || venueAccess.user.name,
        lastName: lastNameParts.join(" ") || null,
        email: venueAccess.user.email,
        phone: venueAccess.user.phone,
        username: venueAccess.user.email,
        role:
          venueAccess.user.role === Role.VENUE_MANAGER ||
          venueAccess.user.role === Role.ADMIN
            ? "ADMIN"
            : "DESK",
        permissions: this.getUserPermissions(venueAccess.user.role),
        isActive: true,
        createdAt: venueAccess.user.createdAt,
        updatedAt: venueAccess.user.updatedAt,
        venueAccessId: venueAccess.id,
      };
    } catch (error) {
      logger.error("Error in getStaffById:", error);
      throw error;
    }
  }

  /**
   * Update staff permissions
   */
  /**
   * Update staff permissions
   */
  async updateStaffPermissions(
    userId: number,
    venueId: number,
    permissions: string[]
  ) {
    try {
      const venueAccess = await prisma.venueUserAccess.findUnique({
        where: {
          venueId_userId: {
            venueId,
            userId,
          },
        },
        include: {
          user: true,
        },
      });

      if (!venueAccess) {
        throw new Error("Staff member not found in this venue");
      }

      const updatedAccess = await prisma.venueUserAccess.update({
        where: {
          venueId_userId: {
            venueId,
            userId,
          },
        },
        data: {
          permissions: permissions,
        },
        include: {
          user: true,
        },
      });

      const [firstName, ...lastNameParts] = updatedAccess.user.name.split(" ");
      return {
        id: updatedAccess.user.id,
        firstName: firstName || updatedAccess.user.name,
        lastName: lastNameParts.join(" ") || null,
        email: updatedAccess.user.email,
        phone: updatedAccess.user.phone,
        username: updatedAccess.user.email,
        role:
          updatedAccess.user.role === Role.VENUE_MANAGER ||
          updatedAccess.user.role === Role.ADMIN
            ? "ADMIN"
            : "DESK",
        permissions: permissions,
        isActive: true,
        createdAt: updatedAccess.user.createdAt,
        updatedAt: updatedAccess.user.updatedAt,
        venueAccessId: updatedAccess.id,
      };
    } catch (error) {
      logger.error("Error in updateStaffPermissions:", error);
      throw error;
    }
  }

  /**
   * Get all staff members for a venue - Updated to load permissions
   */
  async getVenueStaff(venueId: number, includeInactive = false) {
    try {
      const venue = await prisma.venue.findUnique({
        where: { id: venueId },
      });

      if (!venue) {
        throw new Error("Venue not found");
      }

      const staffAccess = await prisma.venueUserAccess.findMany({
        where: {
          venueId,
          ...(includeInactive
            ? {}
            : {
                user: {
                  role: {
                    in: [Role.ADMIN, Role.VENUE_MANAGER, Role.USER],
                  },
                },
              }),
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              role: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
        orderBy: {
          user: {
            createdAt: "desc",
          },
        },
      });

      const formattedStaff = staffAccess.map((access) => {
        const [firstName, ...lastNameParts] = access.user.name.split(" ");
        const lastName = lastNameParts.join(" ");

        const permissions =
          access.permissions && access.permissions.length > 0
            ? access.permissions
            : this.getUserPermissions(access.user.role);

        return {
          id: access.user.id,
          firstName: firstName || access.user.name,
          lastName: lastName || null,
          email: access.user.email,
          phone: access.user.phone,
          username: access.user.email,
          role:
            access.user.role === Role.VENUE_MANAGER ||
            access.user.role === Role.ADMIN
              ? "ADMIN"
              : "DESK",
          permissions: permissions, // Load from database
          isActive: true,
          createdAt: access.user.createdAt,
          updatedAt: access.user.updatedAt,
          venueAccessId: access.id,
        };
      });

      return formattedStaff;
    } catch (error) {
      logger.error("Error in getVenueStaff:", error);
      throw error;
    }
  }
  /**
   * Get default permissions for a user role
   */
  private getUserPermissions(role: Role): string[] {
    if (
      role === Role.ADMIN ||
      role === Role.SUPERADMIN ||
      role === Role.VENUE_MANAGER
    ) {
      return Object.keys(DEFAULT_ADMIN_PERMISSIONS).filter(
        (key) => DEFAULT_ADMIN_PERMISSIONS[key as keyof StaffPermissions]
      );
    } else {
      return Object.keys(DEFAULT_DESK_PERMISSIONS).filter(
        (key) => DEFAULT_DESK_PERMISSIONS[key as keyof StaffPermissions]
      );
    }
  }

  /**
   * Get all available permissions
   */
  async getAvailablePermissions(): Promise<{ [key: string]: string }> {
    return {
      booking_view: "View Bookings",
      booking_create: "Create Bookings",
      booking_edit: "Edit Bookings",
      booking_cancel: "Cancel Bookings",
      booking_reschedule: "Reschedule Bookings",
      booking_discount: "Apply Booking Discounts",
      booking_pattern: "Booking Pattern",

      member_view: "View Members",
      member_create: "Create Members",
      member_edit: "Edit Members",
      member_delete: "Delete Members",
      member_recharge: "Member Recharge",

      membership_view: "View Memberships",
      membership_create: "Create Memberships",
      membership_edit: "Edit Memberships",
      membership_delete: "Delete Memberships",

      package_view: "View Packages",
      package_create: "Create Packages",
      package_edit: "Edit Packages",
      package_delete: "Delete Packages",

      reports_view: "View Reports",
      reports_download: "Download Reports",

      search: "Search",

      pricing_view: "View Pricing",
      pricing_edit: "Edit Pricing",

      extras_view: "View Extras",
      extras_edit: "Edit Extras",
      extras_pricing: "Extras Pricing",

      staff_management: "Staff Management",

      events_view: "View Events",
      events_create: "Create Events",
      events_edit: "Edit Events",

      dashboard_view: "View Dashboard",
      multiple_reports: "Multiple Reports",
      multiple_reports_download: "Download Multiple Reports",
      past_booking_modification: "Past Booking Modification",
    };
  }

  /**
   * Check if user has specific permission for venue
   */
  async hasPermission(
    userId: number,
    venueId: number,
    permission: string
  ): Promise<boolean> {
    try {
      const venueAccess = await prisma.venueUserAccess.findUnique({
        where: {
          venueId_userId: {
            venueId,
            userId,
          },
        },
        include: {
          user: true,
        },
      });

      if (!venueAccess) {
        return false;
      }

      const userPermissions = this.getUserPermissions(venueAccess.user.role);
      return userPermissions.includes(permission);
    } catch (error) {
      logger.error("Error in hasPermission:", error);
      return false;
    }
  }

  /**
   * Get staff statistics for a venue
   */
  async getStaffStatistics(venueId: number) {
    try {
      const venue = await prisma.venue.findUnique({
        where: { id: venueId },
      });

      if (!venue) {
        throw new Error("Venue not found");
      }

      const allStaff = await this.getVenueStaff(venueId, true);

      const statistics = {
        totalStaff: allStaff.length,
        adminStaff: allStaff.filter((staff) => staff.role === "ADMIN").length,
        deskStaff: allStaff.filter((staff) => staff.role === "DESK").length,
        activeStaff: allStaff.filter((staff) => staff.isActive).length,
        inactiveStaff: allStaff.filter((staff) => !staff.isActive).length,
      };

      return statistics;
    } catch (error) {
      logger.error("Error in getStaffStatistics:", error);
      throw error;
    }
  }
}

export default new StaffManagementService();
