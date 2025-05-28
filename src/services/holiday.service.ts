import { PrismaClient } from "@prisma/client";
import logger from "../utils/logger";

const prisma = new PrismaClient();

interface CreateHolidayInput {
  name: string;
  date: Date;
  venueId?: number;
  multiplier?: number;
  description?: string;
}

interface UpdateHolidayInput {
  name?: string;
  date?: Date;
  multiplier?: number;
  description?: string;
  isActive?: boolean;
}

export class HolidayService {
  async getAllHolidays(venueId?: number, includeInactive = false) {
    const where: any = {};

    if (venueId) {
      where.OR = [
        { venueId: venueId },
        { venueId: null }, // Global holidays
      ];
    }

    if (!includeInactive) {
      where.isActive = true;
    }

    return prisma.holiday.findMany({
      where,
      include: {
        venue: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        date: "asc",
      },
    });
  }

  async getHolidayById(holidayId: number) {
    const holiday = await prisma.holiday.findUnique({
      where: { id: holidayId },
      include: {
        venue: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!holiday) {
      throw new Error("Holiday not found");
    }

    return holiday;
  }

  async createHoliday(holidayData: CreateHolidayInput) {
    // Check for duplicate holiday on the same date for the same venue
    const existingHoliday = await prisma.holiday.findFirst({
      where: {
        date: holidayData.date,
        venueId: holidayData.venueId || null,
      },
    });

    if (existingHoliday) {
      throw new Error("Holiday already exists for this date and venue");
    }

    // If venueId is provided, verify venue exists
    if (holidayData.venueId) {
      const venue = await prisma.venue.findUnique({
        where: { id: holidayData.venueId },
      });

      if (!venue) {
        throw new Error("Venue not found");
      }
    }

    return prisma.holiday.create({
      data: {
        name: holidayData.name,
        date: holidayData.date,
        venueId: holidayData.venueId,
        multiplier: holidayData.multiplier || 1.5,
        description: holidayData.description,
      },
      include: {
        venue: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async updateHoliday(holidayId: number, updateData: UpdateHolidayInput) {
    const holiday = await prisma.holiday.findUnique({
      where: { id: holidayId },
    });

    if (!holiday) {
      throw new Error("Holiday not found");
    }

    // Check for duplicate if date is being updated
    if (updateData.date) {
      const existingHoliday = await prisma.holiday.findFirst({
        where: {
          date: updateData.date,
          venueId: holiday.venueId,
          id: { not: holidayId },
        },
      });

      if (existingHoliday) {
        throw new Error("Holiday already exists for this date and venue");
      }
    }

    return prisma.holiday.update({
      where: { id: holidayId },
      data: updateData,
      include: {
        venue: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  async deleteHoliday(holidayId: number) {
    const holiday = await prisma.holiday.findUnique({
      where: { id: holidayId },
    });

    if (!holiday) {
      throw new Error("Holiday not found");
    }

    return prisma.holiday.delete({
      where: { id: holidayId },
    });
  }

  async getHolidaysForDateRange(
    startDate: Date,
    endDate: Date,
    venueId?: number
  ) {
    const where: any = {
      date: {
        gte: startDate,
        lte: endDate,
      },
      isActive: true,
    };

    if (venueId) {
      where.OR = [
        { venueId: venueId },
        { venueId: null }, // Global holidays
      ];
    }

    return prisma.holiday.findMany({
      where,
      orderBy: {
        date: "asc",
      },
    });
  }

  async isHoliday(
    date: Date,
    venueId?: number
  ): Promise<{ isHoliday: boolean; multiplier: number; holidayName?: string }> {
    const where: any = {
      date: date,
      isActive: true,
    };

    if (venueId) {
      where.OR = [
        { venueId: venueId },
        { venueId: null }, // Global holidays
      ];
    }

    const holiday = await prisma.holiday.findFirst({
      where,
      orderBy: {
        venueId: "desc", // Venue-specific holidays take precedence over global ones
      },
    });

    if (holiday) {
      return {
        isHoliday: true,
        multiplier: Number(holiday.multiplier),
        holidayName: holiday.name,
      };
    }

    return {
      isHoliday: false,
      multiplier: 1,
    };
  }

  async getUpcomingHolidays(venueId?: number, days: number = 30) {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    return this.getHolidaysForDateRange(startDate, endDate, venueId);
  }
}

export default new HolidayService();
