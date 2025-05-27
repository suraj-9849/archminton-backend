// controllers/admin/approval.controller.ts
import { Request, Response } from 'express';
import { ApprovalStatus } from '@prisma/client';
import approvalService from '../../services/approval.service';
import { successResponse, errorResponse } from '../../utils/response';
import logger from '../../utils/logger';

export class AdminApprovalController {
  /**
   * Get all approval requests
   * @route GET /api/admin/approvals
   */
  async getApprovalRequests(req: Request, res: Response): Promise<void> {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 10;
      const search = req.query.search as string | undefined;
      const status = req.query.status as ApprovalStatus | undefined;

      const result = await approvalService.getApprovalRequests({
        page,
        limit,
        search,
        status
      });

      successResponse(res, result, 'Approval requests retrieved successfully');
    } catch (error: any) {
      logger.error('Error getting approval requests:', error);
      errorResponse(res, error.message || 'Error retrieving approval requests', 500);
    }
  }

  /**
   * Get approval statistics
   * @route GET /api/admin/approvals/statistics
   */
  async getApprovalStatistics(req: Request, res: Response): Promise<void> {
    try {
      const statistics = await approvalService.getApprovalStatistics();
      successResponse(res, statistics, 'Approval statistics retrieved successfully');
    } catch (error: any) {
      logger.error('Error getting approval statistics:', error);
      errorResponse(res, error.message || 'Error retrieving approval statistics', 500);
    }
  }

  /**
   * Get approval dashboard data
   * @route GET /api/admin/approvals/dashboard
   */
  async getApprovalDashboard(req: Request, res: Response): Promise<void> {
    try {
      const [statistics, recentApprovals] = await Promise.all([
        approvalService.getApprovalStatistics(),
        approvalService.getApprovalRequests({
          status: ApprovalStatus.PENDING,
          limit: 10
        })
      ]);

      const dashboardData = {
        statistics,
        recentPendingApprovals: recentApprovals.approvals,
        urgentApprovals: recentApprovals.approvals.filter(approval => {
          const daysSinceCreated = Math.floor(
            (Date.now() - new Date(approval.createdAt).getTime()) / (1000 * 60 * 60 * 24)
          );
          return daysSinceCreated >= 7;
        })
      };

      successResponse(res, dashboardData, 'Dashboard data retrieved successfully');
    } catch (error: any) {
      logger.error('Error getting approval dashboard:', error);
      errorResponse(res, error.message || 'Error retrieving dashboard data', 500);
    }
  }

  /**
   * Get approval by ID
   * @route GET /api/admin/approvals/:id
   */
  async getApprovalById(req: Request, res: Response): Promise<void> {
    try {
      const approvalId = Number(req.params.id);

      if (isNaN(approvalId)) {
        errorResponse(res, 'Invalid approval ID', 400);
        return;
      }

      const approval = await approvalService.getApprovalById(approvalId);
      successResponse(res, approval, 'Approval details retrieved successfully');
    } catch (error: any) {
      logger.error('Error getting approval by ID:', error);
      errorResponse(
        res,
        error.message || 'Error retrieving approval details',
        error.message.includes('not found') ? 404 : 500
      );
    }
  }

  /**
   * Process approval (approve/reject)
   * @route POST /api/admin/approvals/:id/process
   */
  async processApproval(req: Request, res: Response): Promise<void> {
    try {
      const approvalId = Number(req.params.id);
      const { status, processorComments } = req.body;
      const processedById = req.user?.userId;

      if (isNaN(approvalId)) {
        errorResponse(res, 'Invalid approval ID', 400);
        return;
      }

      if (!processedById) {
        errorResponse(res, 'User not authenticated', 401);
        return;
      }

      if (!status || ![ApprovalStatus.APPROVED, ApprovalStatus.REJECTED].includes(status)) {
        errorResponse(res, 'Status must be either APPROVED or REJECTED', 400);
        return;
      }

      const result = await approvalService.processApproval({
        approvalId,
        processedById,
        status,
        processorComments
      });

      const message = status === ApprovalStatus.APPROVED 
        ? 'Society membership request approved successfully' 
        : 'Society membership request rejected successfully';

      successResponse(res, result, message);
    } catch (error: any) {
      logger.error('Error processing approval:', error);
      errorResponse(
        res,
        error.message || 'Error processing approval request',
        error.message.includes('not found') ? 404 : 400
      );
    }
  }

  /**
   * Bulk process approvals
   * @route POST /api/admin/approvals/bulk-process
   */
  async bulkProcessApprovals(req: Request, res: Response): Promise<void> {
    try {
      const { approvalIds, status, processorComments } = req.body;
      const processedById = req.user?.userId;

      if (!processedById) {
        errorResponse(res, 'User not authenticated', 401);
        return;
      }

      if (!Array.isArray(approvalIds) || approvalIds.length === 0) {
        errorResponse(res, 'Approval IDs array is required', 400);
        return;
      }

      if (![ApprovalStatus.APPROVED, ApprovalStatus.REJECTED].includes(status)) {
        errorResponse(res, 'Status must be either APPROVED or REJECTED', 400);
        return;
      }

      const results = await Promise.allSettled(
        approvalIds.map(approvalId =>
          approvalService.processApproval({
            approvalId: Number(approvalId),
            processedById,
            status,
            processorComments
          })
        )
      );

      const successful = results.filter(result => result.status === 'fulfilled').length;
      const failed = results.filter(result => result.status === 'rejected').length;

      successResponse(
        res,
        {
          successful,
          failed,
          total: approvalIds.length,
          results: results.map((result, index) => ({
            approvalId: approvalIds[index],
            status: result.status,
            error: result.status === 'rejected' ? result.reason.message : null
          }))
        },
        `Bulk processing completed: ${successful} successful, ${failed} failed`
      );
    } catch (error: any) {
      logger.error('Error bulk processing approvals:', error);
      errorResponse(res, error.message || 'Error bulk processing approvals', 500);
    }
  }
}

export default new AdminApprovalController();