// controllers/approval.controller.ts
import { Request, Response } from 'express';
import { ApprovalStatus } from '@prisma/client';
import approvalService from '../services/approval.service';
import { successResponse, errorResponse } from '../utils/response';
import logger from '../utils/logger';

export class UserApprovalController {
  /**
   * Request society membership
   * @route POST /api/users/approvals/society-membership
   */
  async requestSocietyMembership(req: Request, res: Response): Promise<void> {
    try {
      const { societyId, comments } = req.body;
      const requesterId = req.user?.userId;

      if (!requesterId) {
        errorResponse(res, 'User not authenticated', 401);
        return;
      }

      if (!societyId || isNaN(Number(societyId))) {
        errorResponse(res, 'Valid society ID is required', 400);
        return;
      }

      const approval = await approvalService.createSocietyMembershipRequest({
        requesterId,
        societyId: Number(societyId),
        comments
      });

      successResponse(res, approval, 'Society membership request submitted successfully', 201);
    } catch (error: any) {
      logger.error('Error creating society membership request:', error);
      errorResponse(res, error.message || 'Error submitting membership request', 400);
    }
  }

  /**
   * Get user's approval requests
   * @route GET /api/users/approvals
   */
  async getUserApprovals(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      const status = req.query.status as ApprovalStatus | undefined;

      if (!userId) {
        errorResponse(res, 'User not authenticated', 401);
        return;
      }

      if (status && !Object.values(ApprovalStatus).includes(status)) {
        errorResponse(res, 'Invalid approval status', 400);
        return;
      }

      const approvals = await approvalService.getUserApprovalRequests(userId, { status });
      successResponse(res, approvals, 'User approval requests retrieved successfully');
    } catch (error: any) {
      logger.error('Error getting user approvals:', error);
      errorResponse(res, error.message || 'Error retrieving approval requests', 500);
    }
  }

  /**
   * Get approval by ID
   * @route GET /api/users/approvals/:id
   */
  async getUserApprovalById(req: Request, res: Response): Promise<void> {
    try {
      const approvalId = Number(req.params.id);
      const userId = req.user?.userId;

      if (!userId) {
        errorResponse(res, 'User not authenticated', 401);
        return;
      }

      if (isNaN(approvalId)) {
        errorResponse(res, 'Invalid approval ID', 400);
        return;
      }

      const approval = await approvalService.getApprovalById(approvalId);

      if (approval.requesterId !== userId) {
        errorResponse(res, 'Access denied', 403);
        return;
      }

      successResponse(res, approval, 'Approval details retrieved successfully');
    } catch (error: any) {
      logger.error('Error getting user approval by ID:', error);
      errorResponse(
        res,
        error.message || 'Error retrieving approval details',
        error.message.includes('not found') ? 404 : 500
      );
    }
  }

  /**
   * Cancel approval request
   * @route DELETE /api/users/approvals/:id
   */
  async cancelUserApproval(req: Request, res: Response): Promise<void> {
    try {
      const approvalId = Number(req.params.id);
      const userId = req.user?.userId;

      if (!userId) {
        errorResponse(res, 'User not authenticated', 401);
        return;
      }

      if (isNaN(approvalId)) {
        errorResponse(res, 'Invalid approval ID', 400);
        return;
      }

      const result = await approvalService.cancelApprovalRequest(approvalId, userId);
      successResponse(res, result, 'Approval request cancelled successfully');
    } catch (error: any) {
      logger.error('Error cancelling user approval:', error);
      errorResponse(
        res,
        error.message || 'Error cancelling approval request',
        error.message.includes('not found') ? 404 : 400
      );
    }
  }

  /**
   * Get user's approval summary
   * @route GET /api/users/approvals/summary
   */
  async getUserApprovalSummary(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        errorResponse(res, 'User not authenticated', 401);
        return;
      }

      const [allApprovals, pendingApprovals, approvedApprovals, rejectedApprovals] = await Promise.all([
        approvalService.getUserApprovalRequests(userId),
        approvalService.getUserApprovalRequests(userId, { status: ApprovalStatus.PENDING }),
        approvalService.getUserApprovalRequests(userId, { status: ApprovalStatus.APPROVED }),
        approvalService.getUserApprovalRequests(userId, { status: ApprovalStatus.REJECTED })
      ]);

      const summary = {
        total: allApprovals.length,
        pending: pendingApprovals.length,
        approved: approvedApprovals.length,
        rejected: rejectedApprovals.length,
        cancelled: allApprovals.filter(a => a.status === ApprovalStatus.CANCELLED).length,
        byType: {
          societyMembership: allApprovals.length
        },
        recentApprovals: allApprovals.slice(0, 5)
      };

      successResponse(res, summary, 'User approval summary retrieved successfully');
    } catch (error: any) {
      logger.error('Error getting user approval summary:', error);
      errorResponse(res, error.message || 'Error retrieving approval summary', 500);
    }
  }

  /**
   * Check eligibility for society membership
   * @route GET /api/users/approvals/check-eligibility?societyId=123
   */
  async checkApprovalEligibility(req: Request, res: Response): Promise<void> {
    try {
      const { societyId } = req.query;
      const userId = req.user?.userId;

      if (!userId) {
        errorResponse(res, 'User not authenticated', 401);
        return;
      }

      if (!societyId) {
        errorResponse(res, 'Society ID is required', 400);
        return;
      }

      const existingRequests = await approvalService.getUserApprovalRequests(userId, {
        status: ApprovalStatus.PENDING
      });

      const hasExistingRequest = existingRequests.some(approval => 
        approval.societyId === Number(societyId)
      );

      const eligibility = {
        canRequest: !hasExistingRequest,
        reason: hasExistingRequest ? 'You already have a pending society membership request' : null,
        existingRequest: hasExistingRequest ? existingRequests.find(a => a.societyId === Number(societyId)) : null
      };

      successResponse(res, eligibility, 'Approval eligibility checked successfully');
    } catch (error: any) {
      logger.error('Error checking approval eligibility:', error);
      errorResponse(res, error.message || 'Error checking approval eligibility', 500);
    }
  }
}

export default new UserApprovalController();