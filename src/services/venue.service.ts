import { PrismaClient, SportType, VenueType } from '@prisma/client';
import logger from '../utils/logger';

const prisma = new PrismaClient();

// Interface for venue query filters
interface VenueFilterOptions {
  sportType?: SportType;
  location?: string;
  isActive?: boolean;
}

/**
 * Service for venue-related operations
 * All venues are now accessible to all users, with society-based private venues
 */
export class VenueService {
  /**
   * Get all accessible venues for a user
   */
  async getAccessibleVenues(userId: number, filters?: VenueFilterOptions) {
    // First, get all societies the user is a member of
    const userSocieties = await prisma.societyMember.findMany({
      where: {
        userId,
        isActive: true,
        status: 'ACTIVE' // Only active memberships
      },
      select: {
        societyId: true
      }
    });

    const societyIds = userSocieties.map(membership => membership.societyId);

    // Build base query conditions
    const baseConditions: any = {
      isActive: filters?.isActive ?? true
    };

    // Add location filter if provided
    if (filters?.location) {
      baseConditions.location = {
        contains: filters.location,
        mode: 'insensitive'
      };
    }

    // Add sport type filter if provided
    if (filters?.sportType) {
      baseConditions.courts = {
        some: {
          sportType: filters.sportType,
          isActive: true
        }
      };
    }

    // Get all public venues - accessible to everyone
    const publicVenues = await prisma.venue.findMany({
      where: {
        ...baseConditions,
        venueType: VenueType.PUBLIC
      },
      include: {
        courts: {
          where: {
            isActive: true,
            ...(filters?.sportType ? { sportType: filters.sportType } : {})
          },
          include: {
            timeSlots: {
              where: {
                isActive: true
              }
            }
          }
        },
        images: {
          take: 1,
          where: {
            isDefault: true
          }
        },
        society: true
      }
    });

    // Get private venues accessible to the user via society membership
    const privateSocietyVenues = await prisma.venue.findMany({
      where: {
        ...baseConditions,
        venueType: VenueType.PRIVATE,
        societyId: {
          in: societyIds.length > 0 ? societyIds : [-1] // Use -1 if no societies to avoid empty IN clause
        }
      },
      include: {
        courts: {
          where: {
            isActive: true,
            ...(filters?.sportType ? { sportType: filters.sportType } : {})
          },
          include: {
            timeSlots: {
              where: {
                isActive: true
              }
            }
          }
        },
        images: {
          take: 1,
          where: {
            isDefault: true
          }
        },
        society: true
      }
    });

    // Combine all venues (public + private society venues)
    const allVenues = [...publicVenues, ...privateSocietyVenues];

    // Remove duplicates (shouldn't happen, but just in case)
    const uniqueVenueIds = new Set();
    const uniqueVenues = allVenues.filter(venue => {
      if (uniqueVenueIds.has(venue.id)) {
        return false;
      }
      uniqueVenueIds.add(venue.id);
      return true;
    });

    return uniqueVenues;
  }

  /**
   * Get venue details by ID
   */
  async getVenueById(venueId: number, userId: number) {
    // Get venue with all related data
    const venue = await prisma.venue.findUnique({
      where: {
        id: venueId,
        isActive: true
      },
      include: {
        courts: {
          where: { isActive: true },
          include: {
            timeSlots: {
              where: { isActive: true }
            }
          }
        },
        images: true,
        society: true
      }
    });

    if (!venue) {
      throw new Error('Venue not found');
    }

    // For public venues, no access check required
    if (venue.venueType === VenueType.PUBLIC) {
      return venue;
    }

    // For private venues, check if user has access via society membership
    if (venue.societyId) {
      const societyMembership = await prisma.societyMember.findUnique({
        where: {
          userId_societyId: {
            userId,
            societyId: venue.societyId
          }
        }
      });
      
      const hasAccess = !!societyMembership && societyMembership.isActive && societyMembership.status === 'ACTIVE';
      
      if (!hasAccess) {
        throw new Error('You do not have access to this private venue. Please join the associated society first.');
      }
    }

    return venue;
  }

  /**
   * Get available sports at a venue
   */
  async getSportsByVenue(venueId: number) {
    // Check if venue exists
    const venue = await prisma.venue.findUnique({
      where: {
        id: venueId,
        isActive: true
      }
    });

    if (!venue) {
      throw new Error('Venue not found');
    }

    // Get distinct sport types at this venue
    const courtSports = await prisma.court.findMany({
      where: {
        venueId,
        isActive: true
      },
      distinct: ['sportType'],
      select: {
        sportType: true
      }
    });

    return courtSports.map(court => court.sportType);
  }

  /**
   * Get courts by venue and sport type
   */
  async getCourtsByVenueAndSport(venueId: number, sportType: SportType, date?: Date) {
    // Check if venue exists
    const venue = await prisma.venue.findUnique({
      where: {
        id: venueId,
        isActive: true
      }
    });

    if (!venue) {
      throw new Error('Venue not found');
    }

    // Get courts for the sport type
    const courts = await prisma.court.findMany({
      where: {
        venueId,
        sportType,
        isActive: true
      },
      include: {
        timeSlots: {
          where: {
            isActive: true
          }
        }
      }
    });

    // If date is provided, also get bookings for that date to check availability
    if (date) {
      const bookingDate = new Date(date);
      bookingDate.setHours(0, 0, 0, 0); // Set to start of day
      
      const nextDay = new Date(bookingDate);
      nextDay.setDate(nextDay.getDate() + 1); // Set to start of next day
      
      // Get all bookings for these courts on the specified date
      const bookings = await prisma.booking.findMany({
        where: {
          courtId: {
            in: courts.map(court => court.id)
          },
          bookingDate: {
            gte: bookingDate,
            lt: nextDay
          },
          status: {
            in: ['CONFIRMED', 'PENDING']
          }
        },
        select: {
          courtId: true,
          timeSlotId: true
        }
      });

      // Create a map of booked slots
      const bookedSlots = new Map();
      bookings.forEach(booking => {
        const key = `${booking.courtId}-${booking.timeSlotId}`;
        bookedSlots.set(key, true);
      });

      // Add availability information to time slots
      return courts.map(court => {
        const timeSlots = court.timeSlots.map(slot => {
          const key = `${court.id}-${slot.id}`;
          return {
            ...slot,
            isAvailable: !bookedSlots.has(key)
          };
        });
        
        return {
          ...court,
          timeSlots
        };
      });
    }

    return courts;
  }

  /**
   * Get all venues (for admin)
   */
  async getAllVenues(filters?: VenueFilterOptions) {
    const conditions: any = {};

    if (filters?.isActive !== undefined) {
      conditions.isActive = filters.isActive;
    }

    if (filters?.location) {
      conditions.location = {
        contains: filters.location,
        mode: 'insensitive'
      };
    }

    if (filters?.sportType) {
      conditions.courts = {
        some: {
          sportType: filters.sportType
        }
      };
    }

    return prisma.venue.findMany({
      where: conditions,
      include: {
        courts: {
          include: {
            _count: {
              select: {
                bookings: true
              }
            }
          }
        },
        society: true,
        images: {
          take: 1,
          where: {
            isDefault: true
          }
        },
        _count: {
          select: {
            courts: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  /**
   * Check if user can book a venue (for booking validation)
   */
  async canUserBookVenue(userId: number, venueId: number): Promise<boolean> {
    const venue = await prisma.venue.findUnique({
      where: {
        id: venueId,
        isActive: true
      },
      select: {
        venueType: true,
        societyId: true
      }
    });

    if (!venue) {
      return false;
    }

    // Public venues are always bookable
    if (venue.venueType === VenueType.PUBLIC) {
      return true;
    }

    // Private venues require society membership
    if (venue.societyId) {
      const membership = await prisma.societyMember.findUnique({
        where: {
          userId_societyId: {
            userId,
            societyId: venue.societyId
          }
        }
      });

      return !!membership && membership.isActive && membership.status === 'ACTIVE';
    }

    return false;
  }
}

export default new VenueService();