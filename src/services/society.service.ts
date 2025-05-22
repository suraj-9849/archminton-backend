import { PrismaClient } from '@prisma/client';
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
 * Service for society-related operations
 */
export class SocietyService {
  /**
   * Get all societies with optional filters
   */
  async getAllSocieties(filters?: { isActive?: boolean; search?: string }) {
    const where: any = {};

    // Add active filter
    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    // Add search filter
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
          where: { isActive: true },
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
              where: { isActive: true }
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

  /**
   * Get society by ID with detailed information
   */
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
        }
      }
    });

    if (!society) {
      throw new Error('Society not found');
    }

    return society;
  }

  /**
   * Create a new society
   */
  async createSociety(societyData: CreateSocietyInput) {
    // Check if society with same name and location exists
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

  /**
   * Update society
   */
  async updateSociety(societyId: number, updateData: UpdateSocietyInput) {
    // Check if society exists
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

  /**
   * Delete society (soft delete by setting isActive to false)
   */
  async deleteSociety(societyId: number) {
    // Check if society exists
    const society = await prisma.society.findUnique({
      where: { id: societyId }
    });

    if (!society) {
      throw new Error('Society not found');
    }

    // Check if society has active members
    const activeMembers = await prisma.societyMember.count({
      where: {
        societyId,
        isActive: true
      }
    });

    if (activeMembers > 0) {
      // Soft delete - deactivate society
      return prisma.society.update({
        where: { id: societyId },
        data: { isActive: false }
      });
    } else {
      // Hard delete if no active members
      return prisma.society.delete({
        where: { id: societyId }
      });
    }
  }

  /**
   * Get society members
   */
  async getSocietyMembers(societyId: number, includeInactive = false) {
    // Check if society exists
    const society = await prisma.society.findUnique({
      where: { id: societyId }
    });

    if (!society) {
      throw new Error('Society not found');
    }

    const where: any = { societyId };
    if (!includeInactive) {
      where.isActive = true;
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
   * Add member to society
   */
  async addMemberToSociety(societyId: number, userId: number) {
    // Check if society exists
    const society = await prisma.society.findUnique({
      where: { id: societyId }
    });

    if (!society) {
      throw new Error('Society not found');
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Check if membership already exists
    const existingMembership = await prisma.societyMember.findUnique({
      where: {
        userId_societyId: {
          userId,
          societyId
        }
      }
    });

    if (existingMembership) {
      if (existingMembership.isActive) {
        throw new Error('User is already a member of this society');
      } else {
        // Reactivate membership
        return prisma.societyMember.update({
          where: {
            userId_societyId: {
              userId,
              societyId
            }
          },
          data: { isActive: true },
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
    }

    // Create new membership
    return prisma.societyMember.create({
      data: {
        userId,
        societyId
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

  /**
   * Remove member from society
   */
  async removeMemberFromSociety(societyId: number, userId: number) {
    // Check if membership exists
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

    // Soft delete - deactivate membership
    return prisma.societyMember.update({
      where: {
        userId_societyId: {
          userId,
          societyId
        }
      },
      data: { isActive: false }
    });
  }

  /**
   * Get pending membership requests (for future implementation)
   */
  async getPendingMembershipRequests(societyId: number) {
    // This would be used if you implement an approval system
    // For now, return empty array as memberships are auto-approved
    return [];
  }
}

export default new SocietyService();