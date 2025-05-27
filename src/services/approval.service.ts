// services/approval.service.ts
import { PrismaClient, ApprovalStatus, MembershipStatus } from '@prisma/client';
import logger from '../utils/logger';

const prisma = new PrismaClient();

interface CreateSocietyMembershipRequest {
  requesterId: number;
  societyId: number;
  comments?: string;
}

interface ProcessApprovalRequest {
  approvalId: number;
  processedById: number;
  status: ApprovalStatus;
  processorComments?: string;
}

interface ApprovalFilters {
  status?: ApprovalStatus;
  requesterId?: number;
  societyId?: number;
  search?: string;
  page?: number;
  limit?: number;
}

export class ApprovalService {
  /**
   * Create society membership request
   */
  async createSocietyMembershipRequest(data: CreateSocietyMembershipRequest) {
    try {
      // Check for existing pending request
      const existingApproval = await prisma.approval.findFirst({
        where: {
          requesterId: data.requesterId,
          societyId: data.societyId,
          status: ApprovalStatus.PENDING
        }
      });

      if (existingApproval) {
        throw new Error('You already have a pending society membership request');
      }

      // Create approval request
      const approval = await prisma.approval.create({
        data: {
          requesterId: data.requesterId,
          societyId: data.societyId,
          comments: data.comments
        },
        include: {
          requester: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true
            }
          },
          society: {
            select: {
              id: true,
              name: true,
              location: true
            }
          }
        }
      });

      logger.info(`Society membership request created: ${approval.id}`);
      return approval;
    } catch (error: any) {
      logger.error('Error creating society membership request:', error);
      throw error;
    }
  }

  /**
   * Get all approval requests with filters
   */
  async getApprovalRequests(filters?: ApprovalFilters) {
    try {
      const where: any = {};

      if (filters?.status) where.status = filters.status;
      if (filters?.requesterId) where.requesterId = filters.requesterId;
      if (filters?.societyId) where.societyId = filters.societyId;

      if (filters?.search) {
        where.OR = [
          {
            requester: {
              name: { contains: filters.search, mode: 'insensitive' }
            }
          },
          {
            requester: {
              email: { contains: filters.search, mode: 'insensitive' }
            }
          },
          {
            society: {
              name: { contains: filters.search, mode: 'insensitive' }
            }
          }
        ];
      }

      const page = filters?.page || 1;
      const limit = filters?.limit || 10;
      const skip = (page - 1) * limit;

      const [approvals, totalCount] = await Promise.all([
        prisma.approval.findMany({
          where,
          include: {
            requester: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true
              }
            },
            processor: {
              select: {
                id: true,
                name: true,
                email: true
              }
            },
            society: {
              select: {
                id: true,
                name: true,
                location: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit
        }),
        prisma.approval.count({ where })
      ]);

      const totalPages = Math.ceil(totalCount / limit);

      return {
        approvals,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages,
          hasNext: page < totalPages,
          hasPrevious: page > 1
        }
      };
    } catch (error: any) {
      logger.error('Error getting approval requests:', error);
      throw error;
    }
  }

  /**
   * Get approval by ID
   */
  async getApprovalById(approvalId: number) {
    try {
      const approval = await prisma.approval.findUnique({
        where: { id: approvalId },
        include: {
          requester: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              role: true
            }
          },
          processor: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          society: {
            select: {
              id: true,
              name: true,
              location: true,
              description: true
            }
          }
        }
      });

      if (!approval) {
        throw new Error('Approval request not found');
      }

      return approval;
    } catch (error: any) {
      logger.error('Error getting approval by ID:', error);
      throw error;
    }
  }

  /**
   * Process approval (approve/reject)
   */
  async processApproval(data: ProcessApprovalRequest) {
    try {
      const approval = await prisma.approval.findUnique({
        where: { id: data.approvalId }
      });

      if (!approval) {
        throw new Error('Approval request not found');
      }

      if (approval.status !== ApprovalStatus.PENDING) {
        throw new Error('This approval request has already been processed');
      }

      // Process in transaction
      const result = await prisma.$transaction(async (tx) => {
        // Update approval
        const updatedApproval = await tx.approval.update({
          where: { id: data.approvalId },
          data: {
            status: data.status,
            processedById: data.processedById,
            processedAt: new Date(),
            processorComments: data.processorComments
          },
          include: {
            requester: {
              select: {
                id: true,
                name: true,
                email: true
              }
            },
            processor: {
              select: {
                id: true,
                name: true,
                email: true
              }
            },
            society: {
              select: {
                id: true,
                name: true,
                location: true
              }
            }
          }
        });

        // Update society membership
        if (data.status === ApprovalStatus.APPROVED) {
          await tx.societyMember.upsert({
            where: {
              userId_societyId: {
                userId: approval.requesterId,
                societyId: approval.societyId
              }
            },
            update: {
              status: MembershipStatus.ACTIVE,
              isActive: true
            },
            create: {
              userId: approval.requesterId,
              societyId: approval.societyId,
              status: MembershipStatus.ACTIVE,
              isActive: true
            }
          });
        } else if (data.status === ApprovalStatus.REJECTED) {
          await tx.societyMember.updateMany({
            where: {
              userId: approval.requesterId,
              societyId: approval.societyId
            },
            data: {
              status: MembershipStatus.REJECTED,
              isActive: false
            }
          });
        }

        return updatedApproval;
      });

      logger.info(`Approval ${data.approvalId} ${data.status.toLowerCase()}`);
      return result;
    } catch (error: any) {
      logger.error('Error processing approval:', error);
      throw error;
    }
  }

  /**
   * Get approval statistics
   */
  async getApprovalStatistics() {
    try {
      const [total, pending, approved, rejected, cancelled] = await Promise.all([
        prisma.approval.count(),
        prisma.approval.count({ where: { status: ApprovalStatus.PENDING } }),
        prisma.approval.count({ where: { status: ApprovalStatus.APPROVED } }),
        prisma.approval.count({ where: { status: ApprovalStatus.REJECTED } }),
        prisma.approval.count({ where: { status: ApprovalStatus.CANCELLED } })
      ]);

      return {
        totalApprovals: total,
        pendingApprovals: pending,
        approvedApprovals: approved,
        rejectedApprovals: rejected,
        cancelledApprovals: cancelled,
        byType: {
          societyMembership: total,
          venueAccess: 0
        }
      };
    } catch (error: any) {
      logger.error('Error getting approval statistics:', error);
      throw error;
    }
  }

  /**
   * Get user's approval requests
   */
  async getUserApprovalRequests(userId: number, filters?: { status?: ApprovalStatus }) {
    try {
      const where: any = { requesterId: userId };
      if (filters?.status) where.status = filters.status;

      return prisma.approval.findMany({
        where,
        include: {
          society: {
            select: {
              id: true,
              name: true,
              location: true
            }
          },
          processor: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
    } catch (error: any) {
      logger.error('Error getting user approval requests:', error);
      throw error;
    }
  }

  /**
   * Cancel approval request
   */
  async cancelApprovalRequest(approvalId: number, userId: number) {
    try {
      const approval = await prisma.approval.findUnique({
        where: { id: approvalId }
      });

      if (!approval) {
        throw new Error('Approval request not found');
      }

      if (approval.requesterId !== userId) {
        throw new Error('You can only cancel your own requests');
      }

      if (approval.status !== ApprovalStatus.PENDING) {
        throw new Error('Only pending requests can be cancelled');
      }

      const updatedApproval = await prisma.approval.update({
        where: { id: approvalId },
        data: { status: ApprovalStatus.CANCELLED }
      });

      logger.info(`Approval request ${approvalId} cancelled`);
      return updatedApproval;
    } catch (error: any) {
      logger.error('Error cancelling approval request:', error);
      throw error;
    }
  }
}

export default new ApprovalService();