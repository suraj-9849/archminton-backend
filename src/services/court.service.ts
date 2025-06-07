import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';

const prisma = new PrismaClient();

// Interface for court creation
interface CreateCourtInput {
  name: string;
  sportType: any;
  description?: string;
  venueId: number;
  pricePerHour: number;
}

// Interface for court update
interface UpdateCourtInput {
  name?: string;
  sportType?: any;
  description?: string;
  pricePerHour?: number;
  isActive?: boolean;
}

// Interface for time slot creation
interface CreateTimeSlotInput {
  courtId: number;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
  startTime: string; // Format: "HH:MM"
  endTime: string;   // Format: "HH:MM"
}

/**
 * Service for court-related operations
 */
export class CourtService {
  /**
   * Get all courts with optional filters
   */
  async getAllCourts(filters?: {
    venueId?: number;
    sportType?: any;
    isActive?: boolean;
    search?: string;
  }) {
    const where: any = {};

    if (filters?.venueId) {
      where.venueId = filters.venueId;
    }

    if (filters?.sportType) {
      where.sportType = filters.sportType;
    }

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } }
      ];
    }

    return prisma.court.findMany({
      where,
      include: {
        venue: {
          select: {
            id: true,
            name: true,
            location: true,
            venueType: true
          }
        },
        timeSlots: {
          where: { isActive: true },
          orderBy: [
            { dayOfWeek: 'asc' },
            { startTime: 'asc' }
          ]
        },
        _count: {
          select: {
            bookings: true,
            timeSlots: true
          }
        }
      },
      orderBy: [
        { venue: { name: 'asc' } },
        { name: 'asc' }
      ]
    });
  }

  /**
   * Get court by ID with detailed information
   */
  async getCourtById(courtId: number) {
    const court = await prisma.court.findUnique({
      where: { id: courtId },
      include: {
        venue: {
          include: {
            society: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        timeSlots: {
          where: { isActive: true },
          orderBy: [
            { dayOfWeek: 'asc' },
            { startTime: 'asc' }
          ]
        },
        bookings: {
          where: {
            bookingDate: {
              gte: new Date()
            },
            status: {
              in: ['PENDING', 'CONFIRMED']
            }
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            },
            timeSlot: true
          },
          orderBy: {
            bookingDate: 'asc'
          }
        }
      }
    });

    if (!court) {
      throw new Error('Court not found');
    }

    return court;
  }

  /**
   * Create a new court
   */
  async createCourt(courtData: CreateCourtInput) {
    // Check if venue exists
    const venue = await prisma.venue.findUnique({
      where: { id: courtData.venueId }
    });

    if (!venue) {
      throw new Error('Venue not found');
    }

    // Check for duplicate court name within the same venue
    const existingCourt = await prisma.court.findFirst({
      where: {
        name: courtData.name,
        venueId: courtData.venueId
      }
    });

    if (existingCourt) {
      throw new Error('Court with this name already exists in this venue');
    }

    return prisma.court.create({
      data: {
        name: courtData.name,
        sportType: courtData.sportType,
        description: courtData.description,
        venueId: courtData.venueId,
        pricePerHour: courtData.pricePerHour
      },
      include: {
        venue: {
          select: {
            id: true,
            name: true,
            location: true
          }
        }
      }
    });
  }

  /**
   * Update court
   */
  async updateCourt(courtId: number, updateData: UpdateCourtInput) {
    // Check if court exists
    const court = await prisma.court.findUnique({
      where: { id: courtId }
    });

    if (!court) {
      throw new Error('Court not found');
    }

    // If updating name, check for duplicates within the same venue
    if (updateData.name) {
      const existingCourt = await prisma.court.findFirst({
        where: {
          name: updateData.name,
          venueId: court.venueId,
          id: { not: courtId }
        }
      });

      if (existingCourt) {
        throw new Error('Court with this name already exists in this venue');
      }
    }

    return prisma.court.update({
      where: { id: courtId },
      data: updateData,
      include: {
        venue: {
          select: {
            id: true,
            name: true,
            location: true
          }
        },
        timeSlots: {
          where: { isActive: true }
        }
      }
    });
  }

  /**
   * Delete court
   */
  async deleteCourt(courtId: number) {
    // Check if court exists
    const court = await prisma.court.findUnique({
      where: { id: courtId },
      include: {
        bookings: {
          where: {
            status: {
              in: ['PENDING', 'CONFIRMED']
            }
          }
        }
      }
    });

    if (!court) {
      throw new Error('Court not found');
    }

    // Check if court has active bookings
    if (court.bookings.length > 0) {
      // Soft delete - deactivate court
      return prisma.court.update({
        where: { id: courtId },
        data: { isActive: false }
      });
    } else {
      // Hard delete court and associated time slots
      return prisma.court.delete({
        where: { id: courtId }
      });
    }
  }

  /**
   * Create time slot for court
   */
  async createTimeSlot(timeSlotData: CreateTimeSlotInput) {
    // Check if court exists
    const court = await prisma.court.findUnique({
      where: { id: timeSlotData.courtId }
    });

    if (!court) {
      throw new Error('Court not found');
    }

    // Validate day of week (0-6)
    if (timeSlotData.dayOfWeek < 0 || timeSlotData.dayOfWeek > 6) {
      throw new Error('Day of week must be between 0 (Sunday) and 6 (Saturday)');
    }

    // Validate time format (basic validation)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(timeSlotData.startTime) || !timeRegex.test(timeSlotData.endTime)) {
      throw new Error('Time must be in HH:MM format');
    }

    // Check if time slot already exists
    const existingSlot = await prisma.timeSlot.findUnique({
      where: {
        courtId_dayOfWeek_startTime_endTime: {
          courtId: timeSlotData.courtId,
          dayOfWeek: timeSlotData.dayOfWeek,
          startTime: timeSlotData.startTime,
          endTime: timeSlotData.endTime
        }
      }
    });

    if (existingSlot) {
      throw new Error('Time slot already exists for this court');
    }

    return prisma.timeSlot.create({
      data: timeSlotData,
      include: {
        court: {
          select: {
            id: true,
            name: true,
            sportType: true
          }
        }
      }
    });
  }

  /**
   * Update time slot
   */
  async updateTimeSlot(timeSlotId: number, isActive: boolean) {
    // Check if time slot exists
    const timeSlot = await prisma.timeSlot.findUnique({
      where: { id: timeSlotId }
    });

    if (!timeSlot) {
      throw new Error('Time slot not found');
    }

    return prisma.timeSlot.update({
      where: { id: timeSlotId },
      data: { isActive },
      include: {
        court: {
          select: {
            id: true,
            name: true,
            sportType: true
          }
        }
      }
    });
  }

  /**
   * Delete time slot
   */
  async deleteTimeSlot(timeSlotId: number) {
    // Check if time slot exists
    const timeSlot = await prisma.timeSlot.findUnique({
      where: { id: timeSlotId },
      include: {
        bookings: {
          where: {
            status: {
              in: ['PENDING', 'CONFIRMED']
            }
          }
        }
      }
    });

    if (!timeSlot) {
      throw new Error('Time slot not found');
    }

    // Check if time slot has active bookings
    if (timeSlot.bookings.length > 0) {
      // Soft delete - deactivate time slot
      return prisma.timeSlot.update({
        where: { id: timeSlotId },
        data: { isActive: false }
      });
    } else {
      // Hard delete time slot
      return prisma.timeSlot.delete({
        where: { id: timeSlotId }
      });
    }
  }

  /**
   * Get time slots for a court
   */
  async getCourtTimeSlots(courtId: number, includeInactive = false) {
    // Check if court exists
    const court = await prisma.court.findUnique({
      where: { id: courtId }
    });

    if (!court) {
      throw new Error('Court not found');
    }

    const where: any = { courtId };
    if (!includeInactive) {
      where.isActive = true;
    }

    return prisma.timeSlot.findMany({
      where,
      orderBy: [
        { dayOfWeek: 'asc' },
        { startTime: 'asc' }
      ]
    });
  }

  /**
   * Bulk create time slots for a court
   */
  async bulkCreateTimeSlots(courtId: number, timeSlots: Omit<CreateTimeSlotInput, 'courtId'>[]) {
    // Check if court exists
    const court = await prisma.court.findUnique({
      where: { id: courtId }
    });

    if (!court) {
      throw new Error('Court not found');
    }

    // Validate all time slots
    for (const slot of timeSlots) {
      if (slot.dayOfWeek < 0 || slot.dayOfWeek > 6) {
        throw new Error('Day of week must be between 0 (Sunday) and 6 (Saturday)');
      }

      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(slot.startTime) || !timeRegex.test(slot.endTime)) {
        throw new Error('Time must be in HH:MM format');
      }
    }

    // Create all time slots
    const createPromises = timeSlots.map(slot => 
      prisma.timeSlot.create({
        data: {
          courtId,
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime
        }
      })
    );

    return Promise.all(createPromises);
  }
}

export default new CourtService();