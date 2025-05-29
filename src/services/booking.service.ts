import {
  PrismaClient,
  BookingStatus,
  PaymentStatus,
  PaymentMethod,
  SportType,
} from "@prisma/client";
import logger from "../utils/logger";

const prisma = new PrismaClient();

interface CreateBookingInput {
  courtId: number;
  timeSlotId: number;
  bookingDate: Date;
  addOns?: BookingAddOnInput[];
}

interface BookingAddOnInput {
  addOnType: string;
  quantity: number;
  price: number;
}

interface CreatePaymentInput {
  bookingId: number;
  amount: number;
  paymentMethod: PaymentMethod;
  transactionId?: string;
}

interface BulkAvailabilityInput {
  sportType: SportType;
  venueId?: number;
  courts?: number[];
  fromDate: string;
  toDate: string;
  days: number[];
  timeSlots: Array<{ startTime: string; endTime: string }>;
}

interface BulkBookingInput {
  sportType: SportType;
  venueId?: number;
  courts?: number[];
  fromDate: string;
  toDate: string;
  days: number[];
  timeSlots: Array<{ startTime: string; endTime: string }>;
  ignoreUnavailable?: boolean;
  userId?: number;
}

export class BookingService {
  async createBooking(userId: number, bookingData: CreateBookingInput) {
    logger.info("Creating booking for user:", userId, bookingData);
    if (!userId || !bookingData) {
      throw new Error("User ID and booking data are required");
    }
    if (
      !bookingData.courtId ||
      !bookingData.timeSlotId ||
      !bookingData.bookingDate
    ) {
      throw new Error("Court ID, time slot ID, and booking date are required");
    }
    if (isNaN(bookingData.courtId) || isNaN(bookingData.timeSlotId)) {
      throw new Error("Invalid court ID or time slot ID");
    }
    const userExists = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!userExists) {
      throw new Error("User not found");
    }

    const court = await prisma.court.findFirst({
      where: {
        id: bookingData.courtId,
        isActive: true,
      },
      include: {
        venue: {
          include: {
            society: true,
          },
        },
      },
    });

    if (!court) {
      throw new Error("Court not found or inactive");
    }

    const timeSlot = await prisma.timeSlot.findFirst({
      where: {
        id: bookingData.timeSlotId,
        courtId: bookingData.courtId,
        isActive: true,
      },
    });

    if (!timeSlot) {
      throw new Error("Time slot not found or inactive");
    }

    // ... existing venue access checks remain the same ...

    const existingBooking = await prisma.booking.findFirst({
      where: {
        courtId: bookingData.courtId,
        timeSlotId: bookingData.timeSlotId,
        bookingDate: bookingData.bookingDate,
        status: {
          in: [BookingStatus.CONFIRMED, BookingStatus.PENDING],
        },
      },
    });

    if (existingBooking) {
      throw new Error("This time slot is already booked for the selected date");
    }

    let totalAmount = Number(court.pricePerHour);
    if (bookingData.addOns && bookingData.addOns.length > 0) {
      for (const addOn of bookingData.addOns) {
        totalAmount += Number(addOn.price) * addOn.quantity;
      }
    }

    // Create booking with proper initial values
    const booking = await prisma.$transaction(async (tx) => {
      const newBooking = await tx.booking.create({
        data: {
          userId,
          courtId: bookingData.courtId,
          timeSlotId: bookingData.timeSlotId,
          bookingDate: bookingData.bookingDate,
          startTime: timeSlot.startTime,
          endTime: timeSlot.endTime,
          status: BookingStatus.PENDING,
          totalAmount,
          paidAmount: 0, // Initialize with 0
          balanceAmount: totalAmount, // Initialize with full amount
          paymentStatus: PaymentStatus.PENDING,
        },
      });

      // Handle add-ons if they exist
      if (bookingData.addOns && bookingData.addOns.length > 0) {
        await Promise.all(
          bookingData.addOns.map((addOn) =>
            tx.bookingAddOn.create({
              data: {
                bookingId: newBooking.id,
                addOnType: addOn.addOnType,
                quantity: addOn.quantity,
                price: addOn.price,
              },
            })
          )
        );
      }

      // Return booking with all relations
      return tx.booking.findUnique({
        where: { id: newBooking.id },
        include: {
          court: { include: { venue: true } },
          timeSlot: true,
          addOns: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
            },
          },
        },
      });
    });

    console.log("Created booking with initial state:", {
      id: booking?.id,
      totalAmount: booking?.totalAmount,
      paidAmount: booking?.paidAmount,
      balanceAmount: booking?.balanceAmount,
      paymentStatus: booking?.paymentStatus,
    });

    return booking;
  }

  async checkBulkAvailability(params: BulkAvailabilityInput) {
    try {
      logger.info("Checking bulk availability:", params);

      let targetCourts = [];
      if (params.courts && params.courts.length > 0) {
        targetCourts = await prisma.court.findMany({
          where: {
            id: { in: params.courts },
            sportType: params.sportType,
            isActive: true,
            ...(params.venueId && { venueId: params.venueId }),
          },
          include: {
            venue: {
              select: {
                id: true,
                name: true,
                location: true,
              },
            },
            timeSlots: {
              where: { isActive: true },
            },
          },
        });
      } else {
        targetCourts = await prisma.court.findMany({
          where: {
            sportType: params.sportType,
            isActive: true,
            ...(params.venueId && { venueId: params.venueId }),
          },
          include: {
            venue: {
              select: {
                id: true,
                name: true,
                location: true,
              },
            },
            timeSlots: {
              where: { isActive: true },
            },
          },
        });
      }

      if (targetCourts.length === 0) {
        throw new Error("No courts found matching the criteria");
      }

      const startDate = new Date(params.fromDate);
      const endDate = new Date(params.toDate);
      const dates: Date[] = [];

      for (
        let date = new Date(startDate);
        date <= endDate;
        date.setDate(date.getDate() + 1)
      ) {
        if (params.days.includes(date.getDay())) {
          dates.push(new Date(date));
        }
      }

      logger.info(`Generated ${dates.length} dates for availability check`);

      const existingBookings = await prisma.booking.findMany({
        where: {
          courtId: { in: targetCourts.map((c) => c.id) },
          bookingDate: {
            gte: startDate,
            lte: endDate,
          },
          status: {
            in: [BookingStatus.CONFIRMED, BookingStatus.PENDING],
          },
        },
        select: {
          courtId: true,
          bookingDate: true,
          startTime: true,
          endTime: true,
          timeSlotId: true,
        },
      });

      const bookedSlots = new Map<string, boolean>();
      existingBookings.forEach((booking) => {
        const key = `${booking.courtId}-${
          booking.bookingDate.toISOString().split("T")[0]
        }-${booking.startTime}-${booking.endTime}`;
        bookedSlots.set(key, true);
      });

      const availability = [];

      for (const court of targetCourts) {
        for (const date of dates) {
          for (const timeSlot of params.timeSlots) {
            const dayOfWeek = date.getDay();
            const courtTimeSlot = court.timeSlots.find(
              (ts) =>
                ts.dayOfWeek === dayOfWeek &&
                ts.startTime === timeSlot.startTime &&
                ts.endTime === timeSlot.endTime
            );

            if (!courtTimeSlot) {
              availability.push({
                id: `${date.toISOString().split("T")[0]}-${court.id}-${
                  timeSlot.startTime
                }-${timeSlot.endTime}`,
                courtId: court.id,
                courtName: court.name,
                venueName: court.venue.name,
                date: date.toISOString().split("T")[0],
                startTime: timeSlot.startTime,
                endTime: timeSlot.endTime,
                available: false,
                reason: "Time slot not configured for this day",
                price: 0,
              });
              continue;
            }

            const bookingKey = `${court.id}-${
              date.toISOString().split("T")[0]
            }-${timeSlot.startTime}-${timeSlot.endTime}`;
            const isBooked = bookedSlots.has(bookingKey);

            const startHour = parseInt(timeSlot.startTime.split(":")[0]);
            const startMinute = parseInt(timeSlot.startTime.split(":")[1]);
            const endHour = parseInt(timeSlot.endTime.split(":")[0]);
            const endMinute = parseInt(timeSlot.endTime.split(":")[1]);
            const durationHours =
              endHour + endMinute / 60 - (startHour + startMinute / 60);
            const price = Number(court.pricePerHour) * durationHours;

            availability.push({
              id: `${date.toISOString().split("T")[0]}-${court.id}-${
                timeSlot.startTime
              }-${timeSlot.endTime}`,
              courtId: court.id,
              courtName: court.name,
              venueName: court.venue.name,
              date: date.toISOString().split("T")[0],
              startTime: timeSlot.startTime,
              endTime: timeSlot.endTime,
              available: !isBooked,
              reason: isBooked ? "Already booked" : null,
              price: price,
            });
          }
        }
      }

      const summary = {
        total: availability.length,
        available: availability.filter((a) => a.available).length,
        unavailable: availability.filter((a) => !a.available).length,
      };

      logger.info("Bulk availability check completed:", summary);

      return {
        success: true,
        data: availability,
        summary,
      };
    } catch (error: any) {
      logger.error("Error in bulk availability check:", error);
      throw new Error(`Bulk availability check failed: ${error.message}`);
    }
  }

  async createBulkBooking(userId: number, params: BulkBookingInput) {
    try {
      logger.info("Creating bulk booking:", params);

      const results = {
        successful: 0,
        failed: 0,
        errors: [] as string[],
        bookings: [] as any[],
      };

      let targetCourts = [];
      if (params.courts && params.courts.length > 0) {
        targetCourts = await prisma.court.findMany({
          where: {
            id: { in: params.courts },
            sportType: params.sportType,
            isActive: true,
            ...(params.venueId && { venueId: params.venueId }),
          },
          include: {
            venue: {
              include: {
                society: true,
              },
            },
            timeSlots: {
              where: { isActive: true },
            },
          },
        });
      } else {
        targetCourts = await prisma.court.findMany({
          where: {
            sportType: params.sportType,
            isActive: true,
            ...(params.venueId && { venueId: params.venueId }),
          },
          include: {
            venue: {
              include: {
                society: true,
              },
            },
            timeSlots: {
              where: { isActive: true },
            },
          },
        });
      }

      if (targetCourts.length === 0) {
        throw new Error("No courts found matching the criteria");
      }

      const startDate = new Date(params.fromDate);
      const endDate = new Date(params.toDate);
      const dates: Date[] = [];

      for (
        let date = new Date(startDate);
        date <= endDate;
        date.setDate(date.getDate() + 1)
      ) {
        if (params.days.includes(date.getDay())) {
          dates.push(new Date(date));
        }
      }

      logger.info(
        `Attempting to create bookings for ${targetCourts.length} courts across ${dates.length} dates with ${params.timeSlots.length} time slots`
      );

      for (const court of targetCourts) {
        for (const date of dates) {
          for (const timeSlot of params.timeSlots) {
            try {
              const dayOfWeek = date.getDay();
              const courtTimeSlot = court.timeSlots.find(
                (ts) =>
                  ts.dayOfWeek === dayOfWeek &&
                  ts.startTime === timeSlot.startTime &&
                  ts.endTime === timeSlot.endTime
              );

              if (!courtTimeSlot) {
                const error = `Time slot ${timeSlot.startTime}-${
                  timeSlot.endTime
                } not configured for ${court.name} on ${date.toDateString()}`;
                results.errors.push(error);
                results.failed++;
                if (!params.ignoreUnavailable) {
                  logger.warn(error);
                }
                continue;
              }

              if (court.venue.venueType === "PRIVATE") {
                if (court.venue.societyId) {
                  const hasMembership = await prisma.societyMember.findUnique({
                    where: {
                      userId_societyId: {
                        userId,
                        societyId: court.venue.societyId,
                      },
                    },
                  });

                  if (!hasMembership || !hasMembership.isActive) {
                    const hasVenueAccess =
                      await prisma.venueUserAccess.findUnique({
                        where: {
                          venueId_userId: {
                            venueId: court.venue.id,
                            userId,
                          },
                        },
                      });

                    if (!hasVenueAccess) {
                      const error = `No access to private venue ${court.venue.name}`;
                      results.errors.push(error);
                      results.failed++;
                      if (!params.ignoreUnavailable) {
                        throw new Error(error);
                      }
                      continue;
                    }
                  }
                }
              }

              const existingBooking = await prisma.booking.findFirst({
                where: {
                  courtId: court.id,
                  timeSlotId: courtTimeSlot.id,
                  bookingDate: date,
                  status: {
                    in: [BookingStatus.CONFIRMED, BookingStatus.PENDING],
                  },
                },
              });

              if (existingBooking) {
                const error = `${
                  court.name
                } already booked on ${date.toDateString()} at ${
                  timeSlot.startTime
                }-${timeSlot.endTime}`;
                results.errors.push(error);
                results.failed++;
                if (!params.ignoreUnavailable) {
                  logger.warn(error);
                }
                continue;
              }

              const startHour = parseInt(timeSlot.startTime.split(":")[0]);
              const startMinute = parseInt(timeSlot.startTime.split(":")[1]);
              const endHour = parseInt(timeSlot.endTime.split(":")[0]);
              const endMinute = parseInt(timeSlot.endTime.split(":")[1]);
              const durationHours =
                endHour + endMinute / 60 - (startHour + startMinute / 60);
              const totalAmount = Number(court.pricePerHour) * durationHours;

              const booking = await prisma.booking.create({
                data: {
                  userId,
                  courtId: court.id,
                  timeSlotId: courtTimeSlot.id,
                  bookingDate: date,
                  startTime: timeSlot.startTime,
                  endTime: timeSlot.endTime,
                  status: BookingStatus.CONFIRMED, // Auto-confirm bulk bookings
                  totalAmount,
                  paymentStatus: PaymentStatus.PENDING,
                },
                include: {
                  court: {
                    include: {
                      venue: true,
                    },
                  },
                  timeSlot: true,
                },
              });

              results.successful++;
              results.bookings.push(booking);

              logger.info(
                `Successfully created booking for ${
                  court.name
                } on ${date.toDateString()} at ${timeSlot.startTime}-${
                  timeSlot.endTime
                }`
              );
            } catch (error: any) {
              const errorMsg = `Failed to book ${
                court.name
              } on ${date.toDateString()} at ${timeSlot.startTime}-${
                timeSlot.endTime
              }: ${error.message}`;
              results.errors.push(errorMsg);
              results.failed++;

              logger.warn(errorMsg);

              if (!params.ignoreUnavailable && results.failed > 10) {
                throw new Error(
                  `Too many booking failures. Stopping bulk creation. Last error: ${error.message}`
                );
              }
            }
          }
        }
      }

      logger.info("Bulk booking completed:", {
        successful: results.successful,
        failed: results.failed,
        totalErrors: results.errors.length,
      });

      return {
        success: true,
        message: `Created ${results.successful} bookings successfully${
          results.failed > 0 ? `, ${results.failed} failed` : ""
        }`,
        data: results,
      };
    } catch (error: any) {
      logger.error("Error in bulk booking creation:", error);
      throw new Error(`Bulk booking failed: ${error.message}`);
    }
  }

  async processPayment(bookingId: number, paymentData: CreatePaymentInput) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new Error("Booking not found");
    }

    const existingPayment = await prisma.payment.findUnique({
      where: { bookingId },
    });

    if (existingPayment && existingPayment.status === PaymentStatus.PAID) {
      throw new Error("Payment has already been processed for this booking");
    }

    const payment = await prisma.$transaction(async (tx) => {
      let payment;
      if (existingPayment) {
        payment = await tx.payment.update({
          where: { id: existingPayment.id },
          data: {
            amount: paymentData.amount,
            paymentMethod: paymentData.paymentMethod,
            transactionId: paymentData.transactionId,
            status: PaymentStatus.PAID,
          },
        });
      } else {
        payment = await tx.payment.create({
          data: {
            bookingId,
            amount: paymentData.amount,
            paymentMethod: paymentData.paymentMethod,
            transactionId: paymentData.transactionId,
            status: PaymentStatus.PAID,
          },
        });
      }

      await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.CONFIRMED,
          paymentStatus: PaymentStatus.PAID,
        },
      });

      return payment;
    });

    const updatedBooking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        court: {
          include: {
            venue: true,
          },
        },
        timeSlot: true,
        addOns: true,
        payment: true,
      },
    });

    return {
      booking: updatedBooking,
      payment,
    };
  }

  async getCourtAvailability(courtId: number, date: Date) {
    const court = await prisma.court.findUnique({
      where: {
        id: courtId,
        isActive: true,
      },
      include: {
        timeSlots: {
          where: { isActive: true },
        },
      },
    });

    if (!court) {
      throw new Error("Court not found or inactive");
    }

    const bookingDate = new Date(date);
    bookingDate.setHours(0, 0, 0, 0);

    const nextDay = new Date(bookingDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const bookings = await prisma.booking.findMany({
      where: {
        courtId,
        bookingDate: {
          gte: bookingDate,
          lt: nextDay,
        },
        status: {
          in: [BookingStatus.CONFIRMED, BookingStatus.PENDING],
        },
      },
      select: {
        timeSlotId: true,
      },
    });

    const bookedTimeSlotIds = new Set(
      bookings.map((booking) => booking.timeSlotId)
    );

    const availabilityInfo = court.timeSlots.map((slot) => ({
      ...slot,
      isAvailable: !bookedTimeSlotIds.has(slot.id),
    }));

    return {
      court,
      date: bookingDate,
      availability: availabilityInfo,
    };
  }

  async cancelBooking(
    bookingId: number,
    userId: number,
    isAdmin: boolean = false
  ) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        payment: true,
      },
    });

    if (!booking) {
      throw new Error("Booking not found");
    }

    if (!isAdmin && booking.userId !== userId) {
      throw new Error("You are not authorized to cancel this booking");
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw new Error("Booking is already cancelled");
    }

    if (booking.status === BookingStatus.COMPLETED) {
      throw new Error("Cannot cancel a completed booking");
    }

    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.CANCELLED,
      },
      include: {
        court: {
          include: {
            venue: true,
          },
        },
        timeSlot: true,
        addOns: true,
        payment: true,
      },
    });

    if (booking.payment && booking.payment.status === PaymentStatus.PAID) {
      await prisma.payment.update({
        where: { id: booking.payment.id },
        data: {
          status: PaymentStatus.REFUNDED,
        },
      });

      await prisma.booking.update({
        where: { id: bookingId },
        data: {
          paymentStatus: PaymentStatus.REFUNDED,
        },
      });
    }

    return updatedBooking;
  }

  async getBookingById(bookingId: number) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        court: {
          include: {
            venue: true,
          },
        },
        timeSlot: true,
        addOns: true,
        payment: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!booking) {
      throw new Error("Booking not found");
    }

    return booking;
  }

  async updateBookingStatus(bookingId: number, status: BookingStatus) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new Error("Booking not found");
    }

    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: { status },
      include: {
        court: {
          include: {
            venue: true,
          },
        },
        timeSlot: true,
        addOns: true,
        payment: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    return updatedBooking;
  }
}

export default new BookingService();
