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
              where: { isActive: true }
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
    
    const statistics = {
      totalVenues: society._count.venues,
      totalCourts,
      totalBookings: 0, // TODO: Calculate based on bookings table
      activeMembers: society._count.members,
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
        isActive: true
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

    if (existingMembership) {
      if (existingMembership.isActive) {
        throw new Error('User is already a member of this society');
      } else {
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
      data: { isActive: false }
    });
  }

  async getPendingMembershipRequests(societyId: number) {
    return [];
  }
}

export default new SocietyService();