import { Request, Response } from 'express';
import membershipService from '../../services/membership.service';
import { successResponse, errorResponse } from '../../utils/response';
import logger from '../../utils/logger';
import { MembershipType, MembershipStatus } from '@prisma/client';

export class AdminMembershipController {
  // Membership Package Management
  async getAllPackages(req: Request, res: Response): Promise<void> {
    try {
      const type = req.query.type as MembershipType | undefined;
      const isActive = req.query.isActive !== undefined 
        ? req.query.isActive === 'true' 
        : undefined;
      const venueId = req.query.venueId ? Number(req.query.venueId) : undefined;

      const packages = await membershipService.getAllPackages({
        type,
        isActive,
        venueId
      });

      successResponse(res, packages, 'Membership packages retrieved successfully');
    } catch (error: any) {
      logger.error('Error getting membership packages:', error);
      errorResponse(res, error.message || 'Error retrieving membership packages', 500);
    }
  }

  async getPackageById(req: Request, res: Response): Promise<void> {
    try {
      const packageId = Number(req.params.id);
      
      if (isNaN(packageId)) {
        errorResponse(res, 'Invalid package ID', 400);
        return;
      }

      const package_ = await membershipService.getPackageById(packageId);
      successResponse(res, package_, 'Membership package retrieved successfully');
    } catch (error: any) {
      logger.error('Error getting membership package:', error);
      errorResponse(
        res, 
        error.message || 'Error retrieving membership package', 
        error.message.includes('not found') ? 404 : 500
      );
    }
  }

  async createPackage(req: Request, res: Response): Promise<void> {
    try {
      const {
        name,
        description,
        type,
        price,
        durationMonths,
        credits,
        features,
        maxBookingsPerMonth,
        allowedSports,
        venueAccess
      } = req.body;

      const package_ = await membershipService.createPackage({
        name,
        description,
        type,
        price: Number(price),
        durationMonths: Number(durationMonths),
        credits: credits ? Number(credits) : undefined,
        features,
        maxBookingsPerMonth: maxBookingsPerMonth ? Number(maxBookingsPerMonth) : undefined,
        allowedSports,
        venueAccess
      });

      successResponse(res, package_, 'Membership package created successfully', 201);
    } catch (error: any) {
      logger.error('Error creating membership package:', error);
      errorResponse(res, error.message || 'Error creating membership package', 400);
    }
  }

  async updatePackage(req: Request, res: Response): Promise<void> {
    try {
      const packageId = Number(req.params.id);
      
      if (isNaN(packageId)) {
        errorResponse(res, 'Invalid package ID', 400);
        return;
      }

      const {
        name,
        description,
        type,
        price,
        durationMonths,
        credits,
        features,
        maxBookingsPerMonth,
        allowedSports,
        venueAccess,
        isActive
      } = req.body;

      const updateData: any = {};
      
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (type !== undefined) updateData.type = type;
      if (price !== undefined) updateData.price = Number(price);
      if (durationMonths !== undefined) updateData.durationMonths = Number(durationMonths);
      if (credits !== undefined) updateData.credits = Number(credits);
      if (features !== undefined) updateData.features = features;
      if (maxBookingsPerMonth !== undefined) updateData.maxBookingsPerMonth = Number(maxBookingsPerMonth);
      if (allowedSports !== undefined) updateData.allowedSports = allowedSports;
      if (venueAccess !== undefined) updateData.venueAccess = venueAccess;
      if (isActive !== undefined) updateData.isActive = isActive;

      const package_ = await membershipService.updatePackage(packageId, updateData);
      successResponse(res, package_, 'Membership package updated successfully');
    } catch (error: any) {
      logger.error('Error updating membership package:', error);
      errorResponse(
        res, 
        error.message || 'Error updating membership package', 
        error.message.includes('not found') ? 404 : 400
      );
    }
  }

  async deletePackage(req: Request, res: Response): Promise<void> {
    try {
      const packageId = Number(req.params.id);
      
      if (isNaN(packageId)) {
        errorResponse(res, 'Invalid package ID', 400);
        return;
      }

      await membershipService.deletePackage(packageId);
      successResponse(res, null, 'Membership package deleted successfully');
    } catch (error: any) {
      logger.error('Error deleting membership package:', error);
      errorResponse(
        res, 
        error.message || 'Error deleting membership package', 
        error.message.includes('not found') ? 404 : 400
      );
    }
  }

  // User Membership Management
  async getAllMemberships(req: Request, res: Response): Promise<void> {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;
      const status = req.query.status as MembershipStatus | undefined;
      const packageId = req.query.packageId ? Number(req.query.packageId) : undefined;
      const userId = req.query.userId ? Number(req.query.userId) : undefined;
      const venueId = req.query.venueId ? Number(req.query.venueId) : undefined;

      // This would need to be implemented in the service
      // For now, returning a placeholder response
      successResponse(res, { memberships: [], pagination: {} }, 'Memberships retrieved successfully');
    } catch (error: any) {
      logger.error('Error getting memberships:', error);
      errorResponse(res, error.message || 'Error retrieving memberships', 500);
    }
  }

  async getMembershipById(req: Request, res: Response): Promise<void> {
    try {
      const membershipId = Number(req.params.id);
      
      if (isNaN(membershipId)) {
        errorResponse(res, 'Invalid membership ID', 400);
        return;
      }

      const membership = await membershipService.getMembershipById(membershipId);
      successResponse(res, membership, 'Membership retrieved successfully');
    } catch (error: any) {
      logger.error('Error getting membership:', error);
      errorResponse(
        res, 
        error.message || 'Error retrieving membership', 
        error.message.includes('not found') ? 404 : 500
      );
    }
  }

  async createMembership(req: Request, res: Response): Promise<void> {
    try {
      const {
        userId,
        packageId,
        startDate,
        autoRenew,
        paymentMethod,
        paymentReference
      } = req.body;

      const membership = await membershipService.createUserMembership({
        userId: Number(userId),
        packageId: Number(packageId),
        startDate: startDate ? new Date(startDate) : undefined,
        autoRenew,
        paymentMethod,
        paymentReference
      });

      successResponse(res, membership, 'Membership created successfully', 201);
    } catch (error: any) {
      logger.error('Error creating membership:', error);
      errorResponse(res, error.message || 'Error creating membership', 400);
    }
  }

  async renewMembership(req: Request, res: Response): Promise<void> {
    try {
      const membershipId = Number(req.params.id);
      
      if (isNaN(membershipId)) {
        errorResponse(res, 'Invalid membership ID', 400);
        return;
      }

      const { paymentReference } = req.body;

      const membership = await membershipService.renewMembership(membershipId, paymentReference);
      successResponse(res, membership, 'Membership renewed successfully');
    } catch (error: any) {
      logger.error('Error renewing membership:', error);
      errorResponse(res, error.message || 'Error renewing membership', 400);
    }
  }

  async cancelMembership(req: Request, res: Response): Promise<void> {
    try {
      const membershipId = Number(req.params.id);
      
      if (isNaN(membershipId)) {
        errorResponse(res, 'Invalid membership ID', 400);
        return;
      }

      const { reason } = req.body;

      const membership = await membershipService.cancelMembership(membershipId, reason);
      successResponse(res, membership, 'Membership cancelled successfully');
    } catch (error: any) {
      logger.error('Error cancelling membership:', error);
      errorResponse(res, error.message || 'Error cancelling membership', 400);
    }
  }

  async updateMembershipStatus(req: Request, res: Response): Promise<void> {
    try {
      const membershipId = Number(req.params.id);
      
      if (isNaN(membershipId)) {
        errorResponse(res, 'Invalid membership ID', 400);
        return;
      }

      const { status } = req.body;

      const membership = await membershipService.updateMembershipStatus(membershipId, status);
      successResponse(res, membership, 'Membership status updated successfully');
    } catch (error: any) {
      logger.error('Error updating membership status:', error);
      errorResponse(res, error.message || 'Error updating membership status', 400);
    }
  }

  // Statistics and Reports
  async getMembershipStatistics(req: Request, res: Response): Promise<void> {
    try {
      const venueId = req.query.venueId ? Number(req.query.venueId) : undefined;

      const statistics = await membershipService.getMembershipStatistics(venueId);
      successResponse(res, statistics, 'Membership statistics retrieved successfully');
    } catch (error: any) {
      logger.error('Error getting membership statistics:', error);
      errorResponse(res, error.message || 'Error retrieving membership statistics', 500);
    }
  }

  async getExpiringMemberships(req: Request, res: Response): Promise<void> {
    try {
      const days = req.query.days ? Number(req.query.days) : 30;
      const venueId = req.query.venueId ? Number(req.query.venueId) : undefined;

      const memberships = await membershipService.getExpiringMemberships(days, venueId);
      successResponse(res, memberships, 'Expiring memberships retrieved successfully');
    } catch (error: any) {
      logger.error('Error getting expiring memberships:', error);
      errorResponse(res, error.message || 'Error retrieving expiring memberships', 500);
    }
  }
}

// src/controllers/membership.controller.ts (for regular users)
export class MembershipController {
  async getAvailablePackages(req: Request, res: Response): Promise<void> {
    try {
      const venueId = req.query.venueId ? Number(req.query.venueId) : undefined;

      const packages = await membershipService.getAllPackages({
        isActive: true,
        venueId
      });

      successResponse(res, packages, 'Available membership packages retrieved successfully');
    } catch (error: any) {
      logger.error('Error getting available packages:', error);
      errorResponse(res, error.message || 'Error retrieving available packages', 500);
    }
  }

  async getMyMemberships(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        errorResponse(res, 'Unauthorized', 401);
        return;
      }

      const includeExpired = req.query.includeExpired === 'true';

      const memberships = await membershipService.getUserMemberships(req.user.userId, {
        includeExpired
      });

      successResponse(res, memberships, 'User memberships retrieved successfully');
    } catch (error: any) {
      logger.error('Error getting user memberships:', error);
      errorResponse(res, error.message || 'Error retrieving user memberships', 500);
    }
  }

  async purchaseMembership(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        errorResponse(res, 'Unauthorized', 401);
        return;
      }

      const {
        packageId,
        autoRenew,
        paymentMethod,
        paymentReference
      } = req.body;

      const membership = await membershipService.createUserMembership({
        userId: req.user.userId,
        packageId: Number(packageId),
        autoRenew,
        paymentMethod,
        paymentReference
      });

      successResponse(res, membership, 'Membership purchased successfully', 201);
    } catch (error: any) {
      logger.error('Error purchasing membership:', error);
      errorResponse(res, error.message || 'Error purchasing membership', 400);
    }
  }

  async cancelMyMembership(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        errorResponse(res, 'Unauthorized', 401);
        return;
      }

      const membershipId = Number(req.params.id);
      
      if (isNaN(membershipId)) {
        errorResponse(res, 'Invalid membership ID', 400);
        return;
      }

      // Verify ownership
      const membership = await membershipService.getMembershipById(membershipId);
      if (membership.userId !== req.user.userId) {
        errorResponse(res, 'You can only cancel your own memberships', 403);
        return;
      }

      const { reason } = req.body;

      const cancelledMembership = await membershipService.cancelMembership(membershipId, reason);
      successResponse(res, cancelledMembership, 'Membership cancelled successfully');
    } catch (error: any) {
      logger.error('Error cancelling membership:', error);
      errorResponse(res, error.message || 'Error cancelling membership', 400);
    }
  }
}

export const adminMembershipController = new AdminMembershipController();
export const membershipController = new MembershipController();