import { PrismaClient, MembershipStatus, ApprovalType } from '@prisma/client';
import approvalService from './approval.service';
import logger from '../utils/logger';

const prisma = new PrismaClient();

// Interface for society creation
interface CreateSocietyInput {
  name: string;
  location: string;
  description?: string;
  contactPerson?: string;
  contactPhone?: string;
}

// Interface for society update
interface UpdateSocietyInput {
  name?: string;
  location?: string;
  description?: string;
  contactPerson?: string;
  contactPhone?: string;
  isActive?: boolean;
}

/**
 * Service for society-related operations with approval system
 */
export class SocietyService {
  async getAllSocieties(filters?: { isActive?: boolean; search?: string }) {
    const where: any = {};

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { location: { contains: filters.search, mode: 'insensitive' } },
        { contactPerson: { contains: filters.search, mode: 'insensitive' } }
      ];
    }

    return prisma.society.findMany({
      where,
      include: {
        members: {
          where: { 
            isActive: true,
            status: MembershipStatus.ACTIVE // Only include active approved members
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        },
        venues: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            location: true
          }
        },
        _count: {
          select: {
            members: {
              where: { 
                isActive: true,
                status: MembershipStatus.ACTIVE
              }
            },
            venues: {
              where: { isActive: true }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  async getSocietyById(societyId: number) {
    const society = await prisma.society.findUnique({
      where: { id: societyId },
      include: {
        members: {
          where: { isActive: true },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                createdAt: true
              }
            }
          }
        },
        venues: {
          where: { isActive: true },
          include: {
            courts: {
              where: { isActive: true },
              select: {
                id: true,
                name: true,
                sportType: true,
                pricePerHour: true
              }
            }
          }
        },
        _count: {
          select: {
            members: {
              where: { 
                isActive: true,
                status: MembershipStatus.ACTIVE
              }
            },
            venues: {
              where: { isActive: true }
            }
          }
        }
      }
    });

    if (!society) {
      throw new Error('Society not found');
    }

    const totalCourts = society.venues.reduce((sum, venue) => sum + venue.courts.length, 0);
    
    // Get membership statistics
    const membershipStats = await prisma.societyMember.groupBy({
      by: ['status'],
      where: { societyId },
      _count: true
    });

    const statistics = {
      totalVenues: society._count.venues,
      totalCourts,
      totalBookings: 0, // TODO: Calculate based on bookings table
      activeMembers: society._count.members,
      membershipStats: membershipStats.reduce((acc, stat) => {
        acc[stat.status.toLowerCase()] = stat._count;
        return acc;
      }, {} as Record<string, number>)
    };

    return {
      ...society,
      statistics
    };
  }

  async createSociety(societyData: CreateSocietyInput) {
    const existingSociety = await prisma.society.findFirst({
      where: {
        name: societyData.name,
        location: societyData.location
      }
    });

    if (existingSociety) {
      throw new Error('Society with this name and location already exists');
    }

    return prisma.society.create({
      data: societyData,
      include: {
        _count: {
          select: {
            members: true,
            venues: true
          }
        }
      }
    });
  }

  async updateSociety(societyId: number, updateData: UpdateSocietyInput) {
    const society = await prisma.society.findUnique({
      where: { id: societyId }
    });

    if (!society) {
      throw new Error('Society not found');
    }

    return prisma.society.update({
      where: { id: societyId },
      data: updateData,
      include: {
        _count: {
          select: {
            members: true,
            venues: true
          }
        }
      }
    });
  }

  async deleteSociety(societyId: number) {
    const society = await prisma.society.findUnique({
      where: { id: societyId }
    });

    if (!society) {
      throw new Error('Society not found');
    }

    const activeMembers = await prisma.societyMember.count({
      where: {
        societyId,
        isActive: true,
        status: MembershipStatus.ACTIVE
      }
    });

    if (activeMembers > 0) {
      return prisma.society.update({
        where: { id: societyId },
        data: { isActive: false }
      });
    } else {
      return prisma.society.delete({
        where: { id: societyId }
      });
    }
  }

  async toggleSocietyStatus(societyId: number) {
    const society = await prisma.society.findUnique({
      where: { id: societyId }
    });
    
    if (!society) {
      throw new Error('Society not found');
    }

    return prisma.society.update({
      where: { id: societyId },
      data: { isActive: !society.isActive },
      include: {
        _count: {
          select: {
            members: true,
            venues: true
          }
        }
      }
    });
  }

  async getSocietyStatistics(societyId?: number) {
    if (societyId) {
      const society = await this.getSocietyById(societyId);
      return society.statistics;
    } else {
      const totalSocieties = await prisma.society.count();
      const activeSocieties = await prisma.society.count({ 
        where: { isActive: true } 
      });
      const inactiveSocieties = totalSocieties - activeSocieties;
      const totalVenues = await prisma.venue.count({
        where: { isActive: true }
      });

      return {
        totalSocieties,
        activeSocieties,
        inactiveSocieties,
        totalVenues,
      };
    }
  }

  async getSocietyMembers(societyId: number, includeInactive = false) {
    const society = await prisma.society.findUnique({
      where: { id: societyId }
    });

    if (!society) {
      throw new Error('Society not found');
    }

    const where: any = { societyId };
    if (!includeInactive) {
      where.isActive = true;
      where.status = MembershipStatus.ACTIVE;
    }

    return prisma.societyMember.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            gender: true,
            createdAt: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  /**
   * Apply for society membership (creates approval request)
   */
  async applyForSocietyMembership(societyId: number, userId: number, comments?: string) {
    const society = await prisma.society.findUnique({
      where: { id: societyId }
    });

    if (!society) {
      throw new Error('Society not found');
    }

    if (!society.isActive) {
      throw new Error('Society is not active');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Check if user is already a member or has pending request
    const existingMembership = await prisma.societyMember.findUnique({
      where: {
        userId_societyId: {
          userId,
          societyId
        }
      }
    });

    if (existingMembership) {
      if (existingMembership.status === MembershipStatus.ACTIVE) {
        throw new Error('User is already an active member of this society');
      }
      if (existingMembership.status === MembershipStatus.PENDING) {
        throw new Error('User already has a pending membership request for this society');
      }
    }

    // Create approval request
    const approval = await approvalService.createApprovalRequest({
      type: ApprovalType.SOCIETY_MEMBERSHIP,
      requesterId: userId,
      societyId,
      comments
    });

    // Create or update society member record with PENDING status
    await prisma.societyMember.upsert({
      where: {
        userId_societyId: {
          userId,
          societyId
        }
      },
      update: {
        status: MembershipStatus.PENDING,
        isActive: false
      },
      create: {
        userId,
        societyId,
        status: MembershipStatus.PENDING,
        isActive: false
      }
    });

    return {
      approval,
      message: 'Membership application submitted for approval'
    };
  }

  /**
   * Admin directly adds member (bypasses approval)
   */
  async addMemberToSociety(societyId: number, userId: number) {
    const society = await prisma.society.findUnique({
      where: { id: societyId }
    });

    if (!society) {
      throw new Error('Society not found');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    const existingMembership = await prisma.societyMember.findUnique({
      where: {
        userId_societyId: {
          userId,
          societyId
        }
      }
    });

    if (existingMembership && existingMembership.status === MembershipStatus.ACTIVE) {
      throw new Error('User is already a member of this society');
    }

    return prisma.societyMember.upsert({
      where: {
        userId_societyId: {
          userId,
          societyId
        }
      },
      update: {
        status: MembershipStatus.ACTIVE,
        isActive: true
      },
      create: {
        userId,
        societyId,
        status: MembershipStatus.ACTIVE,
        isActive: true
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
            name: true
          }
        }
      }
    });
  }

  async removeMemberFromSociety(societyId: number, userId: number) {
    const membership = await prisma.societyMember.findUnique({
      where: {
        userId_societyId: {
          userId,
          societyId
        }
      }
    });

    if (!membership) {
      throw new Error('Membership not found');
    }

    return prisma.societyMember.update({
      where: {
        userId_societyId: {
          userId,
          societyId
        }
      },
      data: { 
        isActive: false,
        status: MembershipStatus.INACTIVE
      }
    });
  }

  /**
   * Get pending membership requests for a society
   */
  async getPendingMembershipRequests(societyId: number) {
    return prisma.societyMember.findMany({
      where: {
        societyId,
        status: MembershipStatus.PENDING
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            createdAt: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc'
      }
    });
  }

  /**
   * Get societies available for membership application
   */
  async getAvailableSocieties(userId: number) {
    // Get societies where user is not already a member or has pending request
    const userMemberships = await prisma.societyMember.findMany({
      where: { userId },
      select: { societyId: true }
    });

    const excludedSocietyIds = userMemberships.map(m => m.societyId);

    return prisma.society.findMany({
      where: {
        isActive: true,
        id: {
          notIn: excludedSocietyIds
        }
      },
      select: {
        id: true,
        name: true,
        location: true,
        description: true,
        contactPerson: true,
        contactPhone: true,
        _count: {
          select: {
            members: {
              where: {
                isActive: true,
                status: MembershipStatus.ACTIVE
              }
            }
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });
  }
}

export default new SocietyService();