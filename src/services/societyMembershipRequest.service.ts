
import { PrismaClient, MembershipRequestStatus } from '@prisma/client';
import logger from '../utils/logger';

const prisma = new PrismaClient();

interface CreateMembershipRequestInput {
  userId: number;
  societyIds: number[]; // Multiple society selections
}

interface ReviewMembershipRequestInput {
  requestId: number;
  status: MembershipRequestStatus;
  reviewedBy: number;
  reviewNote?: string;
}

export class SocietyMembershipRequestService {
  /**
   * Create membership requests for multiple societies
   */
  async createMembershipRequests(requestData: CreateMembershipRequestInput) {
    const { userId, societyIds } = requestData;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Validate all societies exist and are active
    const societies = await prisma.society.findMany({
      where: {
        id: { in: societyIds },
        isActive: true
      }
    });

    if (societies.length !== societyIds.length) {
      throw new Error('One or more societies not found or inactive');
    }

    // Check for existing requests or memberships
    const existingRequests = await prisma.societyMembershipRequest.findMany({
      where: {
        userId,
        societyId: { in: societyIds }
      }
    });

    const existingMemberships = await prisma.societyMember.findMany({
      where: {
        userId,
        societyId: { in: societyIds },
        isActive: true
      }
    });

    const existingRequestSocietyIds = existingRequests.map(req => req.societyId);
    const existingMembershipSocietyIds = existingMemberships.map(mem => mem.societyId);
    const alreadyExists = [...existingRequestSocietyIds, ...existingMembershipSocietyIds];

    // Filter out societies that already have requests or memberships
    const newSocietyIds = societyIds.filter(id => !alreadyExists.includes(id));

    if (newSocietyIds.length === 0) {
      throw new Error('Membership requests already exist for all selected societies');
    }

    // Create new membership requests
    const newRequests = await Promise.all(
      newSocietyIds.map(societyId =>
        prisma.societyMembershipRequest.create({
          data: {
            userId,
            societyId,
            status: MembershipRequestStatus.PENDING
          },
          include: {
            society: {
              select: {
                id: true,
                name: true,
                location: true
              }
            },
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        })
      )
    );

    return {
      created: newRequests,
      skipped: alreadyExists.length,
      message: `Created ${newRequests.length} membership requests. ${alreadyExists.length} were skipped (already exist).`
    };
  }

  /**
   * Get all pending membership requests (for admin)
   */
  async getPendingMembershipRequests(filters?: {
    societyId?: number;
    userId?: number;
  }) {
    const where: any = {
      status: MembershipRequestStatus.PENDING
    };

    if (filters?.societyId) {
      where.societyId = filters.societyId;
    }

    if (filters?.userId) {
      where.userId = filters.userId;
    }

    return prisma.societyMembershipRequest.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            createdAt: true
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
      },
      orderBy: {
        requestedAt: 'desc'
      }
    });
  }

  /**
   * Get membership requests by user
   */
  async getUserMembershipRequests(userId: number) {
    return prisma.societyMembershipRequest.findMany({
      where: { userId },
      include: {
        society: {
          select: {
            id: true,
            name: true,
            location: true,
            description: true
          }
        },
        reviewer: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        requestedAt: 'desc'
      }
    });
  }

  /**
   * Review membership request (approve/reject)
   */
  async reviewMembershipRequest(reviewData: ReviewMembershipRequestInput) {
    const { requestId, status, reviewedBy, reviewNote } = reviewData;

    // Check if request exists and is pending
    const request = await prisma.societyMembershipRequest.findUnique({
      where: { id: requestId },
      include: {
        user: true,
        society: true
      }
    });

    if (!request) {
      throw new Error('Membership request not found');
    }

    if (request.status !== MembershipRequestStatus.PENDING) {
      throw new Error('Membership request has already been reviewed');
    }

    // Check if reviewer exists and has appropriate permissions
    const reviewer = await prisma.user.findUnique({
      where: { id: reviewedBy }
    });

    if (!reviewer || (reviewer.role !== 'ADMIN' && reviewer.role !== 'SUPERADMIN')) {
      throw new Error('Unauthorized to review membership requests');
    }

    return prisma.$transaction(async (tx) => {
      // Update the membership request
      const updatedRequest = await tx.societyMembershipRequest.update({
        where: { id: requestId },
        data: {
          status,
          reviewedAt: new Date(),
          reviewedBy,
          reviewNote
        },
        include: {
          user: {
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
          },
          reviewer: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      // If approved, create the society membership
      if (status === MembershipRequestStatus.APPROVED) {
        // Check if membership doesn't already exist
        const existingMembership = await tx.societyMember.findUnique({
          where: {
            userId_societyId: {
              userId: request.userId,
              societyId: request.societyId
            }
          }
        });

        if (!existingMembership) {
          await tx.societyMember.create({
            data: {
              userId: request.userId,
              societyId: request.societyId,
              isActive: true,
              joinedAt: new Date()
            }
          });
        } else if (!existingMembership.isActive) {
          // Reactivate existing membership
          await tx.societyMember.update({
            where: {
              userId_societyId: {
                userId: request.userId,
                societyId: request.societyId
              }
            },
            data: {
              isActive: true,
              joinedAt: new Date()
            }
          });
        }
      }

      return updatedRequest;
    });
  }

  /**
   * Get all membership requests (for admin with filters)
   */
  async getAllMembershipRequests(filters?: {
    status?: MembershipRequestStatus;
    societyId?: number;
    page?: number;
    limit?: number;
  }) {
    const where: any = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.societyId) {
      where.societyId = filters.societyId;
    }

    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;

    const [requests, totalCount] = await Promise.all([
      prisma.societyMembershipRequest.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              createdAt: true
            }
          },
          society: {
            select: {
              id: true,
              name: true,
              location: true,
              description: true
            }
          },
          reviewer: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: {
          requestedAt: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.societyMembershipRequest.count({ where })
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return {
      requests,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1
      }
    };
  }

  /**
   * Bulk review membership requests
   */
  async bulkReviewRequests(requestIds: number[], status: MembershipRequestStatus, reviewedBy: number, reviewNote?: string) {
    // Validate reviewer
    const reviewer = await prisma.user.findUnique({
      where: { id: reviewedBy }
    });

    if (!reviewer || (reviewer.role !== 'ADMIN' && reviewer.role !== 'SUPERADMIN')) {
      throw new Error('Unauthorized to review membership requests');
    }

    // Get all pending requests
    const requests = await prisma.societyMembershipRequest.findMany({
      where: {
        id: { in: requestIds },
        status: MembershipRequestStatus.PENDING
      }
    });

    if (requests.length === 0) {
      throw new Error('No pending requests found with the provided IDs');
    }

    return prisma.$transaction(async (tx) => {
      const results = [];

      for (const request of requests) {
        // Update request
        const updatedRequest = await tx.societyMembershipRequest.update({
          where: { id: request.id },
          data: {
            status,
            reviewedAt: new Date(),
            reviewedBy,
            reviewNote
          }
        });

        results.push(updatedRequest);

        // If approved, create membership
        if (status === MembershipRequestStatus.APPROVED) {
          const existingMembership = await tx.societyMember.findUnique({
            where: {
              userId_societyId: {
                userId: request.userId,
                societyId: request.societyId
              }
            }
          });

          if (!existingMembership) {
            await tx.societyMember.create({
              data: {
                userId: request.userId,
                societyId: request.societyId,
                isActive: true,
                joinedAt: new Date()
              }
            });
          } else if (!existingMembership.isActive) {
            await tx.societyMember.update({
              where: {
                userId_societyId: {
                  userId: request.userId,
                  societyId: request.societyId
                }
              },
              data: {
                isActive: true,
                joinedAt: new Date()
              }
            });
          }
        }
      }

      return {
        processed: results.length,
        skipped: requestIds.length - results.length,
        results
      };
    });
  }

  /**
   * Cancel pending membership request
   */
  async cancelMembershipRequest(requestId: number, userId: number) {
    const request = await prisma.societyMembershipRequest.findUnique({
      where: { id: requestId }
    });

    if (!request) {
      throw new Error('Membership request not found');
    }

    if (request.userId !== userId) {
      throw new Error('Unauthorized to cancel this request');
    }

    if (request.status !== MembershipRequestStatus.PENDING) {
      throw new Error('Only pending requests can be cancelled');
    }

    return prisma.societyMembershipRequest.delete({
      where: { id: requestId }
    });
  }

  /**
   * Get membership request statistics
   */
  async getMembershipRequestStatistics(societyId?: number) {
    const baseWhere = societyId ? { societyId } : {};

    const [
      totalRequests,
      pendingRequests,
      approvedRequests,
      rejectedRequests
    ] = await Promise.all([
      prisma.societyMembershipRequest.count({ where: baseWhere }),
      prisma.societyMembershipRequest.count({ 
        where: { ...baseWhere, status: MembershipRequestStatus.PENDING }
      }),
      prisma.societyMembershipRequest.count({ 
        where: { ...baseWhere, status: MembershipRequestStatus.APPROVED }
      }),
      prisma.societyMembershipRequest.count({ 
        where: { ...baseWhere, status: MembershipRequestStatus.REJECTED }
      })
    ]);

    return {
      total: totalRequests,
      pending: pendingRequests,
      approved: approvedRequests,
      rejected: rejectedRequests
    };
  }
}

export default new SocietyMembershipRequestService();