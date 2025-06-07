import { PrismaClient, VenueType } from "@prisma/client";
import logger from "../utils/logger";

const prisma = new PrismaClient();

// Interface for venue query filters
interface VenueFilterOptions {
  sportType?: any;
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
    const userSocieties = await prisma.societyMember.findMany({
      where: {
        userId,
        isActive: true,
      },
      select: {
        societyId: true,
      },
    });

    const societyIds = userSocieties.map((membership) => membership.societyId);

    const baseConditions: any = {
      isActive: filters?.isActive ?? true,
    };

    if (filters?.location) {
      baseConditions.location = {
        contains: filters.location,
        mode: "insensitive",
      };
    }

    if (filters?.sportType) {
      baseConditions.courts = {
        some: {
          sportType: filters.sportType,
          isActive: true,
        },
      };
    }

    const publicVenues = await prisma.venue.findMany({
      where: {
        ...baseConditions,
        venueType: VenueType.PUBLIC,
      },
      include: {
        courts: {
          where: {
            isActive: true,
            ...(filters?.sportType ? { sportType: filters.sportType } : {}),
          },
        },
        images: true,
        society: true,
      },
    });

    const privateSocietyVenues = await prisma.venue.findMany({
      where: {
        ...baseConditions,
        venueType: VenueType.PRIVATE,
        societyId: {
          in: societyIds.length > 0 ? societyIds : [-1],
        },
      },
      include: {
        courts: {
          where: {
            isActive: true,
            ...(filters?.sportType ? { sportType: filters.sportType } : {}),
          },
          include: {
            timeSlots: {
              where: {
                isActive: true,
              },
            },
          },
        },
        images: true,
        society: true,
      },
    });

    const userAccessVenues = await prisma.venueUserAccess.findMany({
      where: {
        userId,
      },
      select: {
        venue: {
          include: {
            courts: {
              where: {
                isActive: true,
                ...(filters?.sportType ? { sportType: filters.sportType } : {}),
              },
              include: {
                timeSlots: {
                  where: {
                    isActive: true,
                  },
                },
              },
            },
            images: true,
            society: true,
          },
        },
      },
    });

    const privateAccessVenues = userAccessVenues
      .map((access) => access.venue)
      .filter((venue) => venue.isActive === (filters?.isActive ?? true));

    const allVenues = [
      ...publicVenues,
      ...privateSocietyVenues,
      ...privateAccessVenues,
    ];

    const uniqueVenueIds = new Set();
    const uniqueVenues = allVenues.filter((venue) => {
      if (uniqueVenueIds.has(venue.id)) {
        return false;
      }
      uniqueVenueIds.add(venue.id);
      return true;
    });

    const finalVenues = uniqueVenues.map((venue) => ({
      ...venue,
      services: venue.services ?? [],
      amenities: venue.amenities ?? [],
      images: venue.images.map((img) => img.imageUrl),
    }));

    return finalVenues;
  }

  async getVenueById(venueId: number, userId: number) {
    const venue = await prisma.venue.findUnique({
      where: {
        id: venueId,
        isActive: true,
      },
      include: {
        courts: {
          where: { isActive: true },
          include: {
            timeSlots: {
              where: { isActive: true },
            },
          },
        },
        images: true,
        society: true,
      },
    });

    if (!venue) {
      throw new Error("Venue not found");
    }

    if (venue.venueType === VenueType.PUBLIC) {
      return {
        ...venue,
        services: venue.services ?? [],
        amenities: venue.amenities ?? [],
        images: venue.images.map((img) => img.imageUrl),
      };
    }

    let hasAccess = false;

    if (venue.societyId) {
      const societyMembership = await prisma.societyMember.findUnique({
        where: {
          userId_societyId: {
            userId,
            societyId: venue.societyId,
          },
        },
      });

      hasAccess = !!societyMembership && societyMembership.isActive;
    }

    if (!hasAccess) {
      const venueAccess = await prisma.venueUserAccess.findUnique({
        where: {
          venueId_userId: {
            venueId,
            userId,
          },
        },
      });

      hasAccess = !!venueAccess;
    }

    if (!hasAccess) {
      throw new Error("You do not have access to this venue");
    }

    return {
      ...venue,
      services: venue.services ?? [],
      amenities: venue.amenities ?? [],
      images: venue.images.map((img) => img.imageUrl),
    };
  }

  async getSportsByVenue(venueId: number) {
    const venue = await prisma.venue.findUnique({
      where: {
        id: venueId,
        isActive: true,
      },
    });

    if (!venue) {
      throw new Error("Venue not found");
    }

    const courtSports = await prisma.court.findMany({
      where: {
        venueId,
        isActive: true,
      },
      distinct: ["sportType"],
      select: {
        sportType: true,
      },
    });

    return courtSports.map((court) => court.sportType);
  }

  async getCourtsByVenueAndSport(
    venueId: number,
    sportType: any,
    date?: Date
  ) {
    const venue = await prisma.venue.findUnique({
      where: {
        id: venueId,
        isActive: true,
      },
    });

    if (!venue) {
      throw new Error("Venue not found");
    }

    const courts = await prisma.court.findMany({
      where: {
        venueId,
        sportType,
        isActive: true,
      },
      include: {
        timeSlots: {
          where: {
            isActive: true,
          },
        },
      },
    });

    if (date) {
      const bookingDate = new Date(date);
      bookingDate.setHours(0, 0, 0, 0);

      const nextDay = new Date(bookingDate);
      nextDay.setDate(nextDay.getDate() + 1);

      const bookings = await prisma.booking.findMany({
        where: {
          courtId: {
            in: courts.map((court) => court.id),
          },
          bookingDate: {
            gte: bookingDate,
            lt: nextDay,
          },
          status: {
            in: ["CONFIRMED", "PENDING"],
          },
        },
        select: {
          courtId: true,
          timeSlotId: true,
        },
      });

      const bookedSlots = new Map();
      bookings.forEach((booking) => {
        const key = `${booking.courtId}-${booking.timeSlotId}`;
        bookedSlots.set(key, true);
      });

      return courts.map((court) => {
        const timeSlots = court.timeSlots.map((slot) => {
          const key = `${court.id}-${slot.id}`;
          return {
            ...slot,
            isAvailable: !bookedSlots.has(key),
          };
        });

        return {
          ...court,
          timeSlots,
        };
      });
    }

    return courts;
  }

  async getAllVenues(filters?: VenueFilterOptions) {
    const conditions: any = {};

    if (filters?.isActive !== undefined) {
      conditions.isActive = filters.isActive;
    }

    if (filters?.location) {
      conditions.location = {
        contains: filters.location,
        mode: "insensitive",
      };
    }

    if (filters?.sportType) {
      conditions.courts = {
        some: {
          sportType: filters.sportType,
        },
      };
    }

    const venues = await prisma.venue.findMany({
      where: conditions,
      include: {
        courts: {
          include: {
            _count: {
              select: {
                bookings: true,
              },
            },
          },
        },
        society: true,
        images: true,
        _count: {
          select: {
            courts: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return venues.map((venue) => ({
      ...venue,
      services: venue.services ?? [],
      amenities: venue.amenities ?? [],
      images: venue.images.map((img) => img.imageUrl),
    }));
  }
}

export default new VenueService();
