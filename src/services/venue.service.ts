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
        isActive: true
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

    // Get public venues
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

    // Get private venues with explicit user access via VenueUserAccess
    const userAccessVenues = await prisma.venueUserAccess.findMany({
      where: {
        userId
      },
      select: {
        venue: {
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
        }
      }
    });

    // Extract venues from user access records
    const privateAccessVenues = userAccessVenues
      .map(access => access.venue)
      .filter(venue => venue.isActive === (filters?.isActive ?? true));

    // Combine all venues
    const allVenues = [...publicVenues, ...privateSocietyVenues, ...privateAccessVenues];

    // Remove duplicates
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

    // For private venues, check if user has access
    // 1. Check society membership
    let hasAccess = false;

    if (venue.societyId) {
      const societyMembership = await prisma.societyMember.findUnique({
        where: {
          userId_societyId: {
            userId,
            societyId: venue.societyId
          }
        }
      });
      
      hasAccess = !!societyMembership && societyMembership.isActive;
    }

    // 2. Check explicit venue access
    if (!hasAccess) {
      const venueAccess = await prisma.venueUserAccess.findUnique({
        where: {
          venueId_userId: {
            venueId,
            userId
          }
        }
      });
      
      hasAccess = !!venueAccess;
    }

    if (!hasAccess) {
      throw new Error('You do not have access to this venue');
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
}

export default new VenueService();