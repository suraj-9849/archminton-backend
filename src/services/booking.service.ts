import { PrismaClient, BookingStatus, PaymentStatus, PaymentMethod } from '@prisma/client';
import logger from '../utils/logger';

const prisma = new PrismaClient();

// Booking creation input interface
interface CreateBookingInput {
  courtId: number;
  timeSlotId: number;
  bookingDate: Date;
  addOns?: BookingAddOnInput[];
}

// Add-on input interface
interface BookingAddOnInput {
  addOnType: string;
  quantity: number;
  price: number;
}

// Interface for payment creation
interface CreatePaymentInput {
  bookingId: number;
  amount: number;
  paymentMethod: PaymentMethod;
  transactionId?: string;
}

/**
 * Service for booking-related operations
 */
export class BookingService {
  /**
   * Create a new booking
   */
  async createBooking(userId: number, bookingData: CreateBookingInput) {
    // Check if court exists
    const court = await prisma.court.findUnique({
      where: {
        id: bookingData.courtId,
        isActive: true
      },
      include: {
        venue: {
          include: {
            society: true
          }
        }
      }
    });

    if (!court) {
      throw new Error('Court not found or inactive');
    }

    // Check if time slot exists and belongs to the court
    const timeSlot = await prisma.timeSlot.findFirst({
      where: {
        id: bookingData.timeSlotId,
        courtId: bookingData.courtId,
        isActive: true
      }
    });

    if (!timeSlot) {
      throw new Error('Time slot not found or inactive');
    }

    // Check if venue is private and user has access
    if (court.venue.venueType === 'PRIVATE') {
      // Check if user has society membership
      if (court.venue.societyId) {
        const hasMembership = await prisma.societyMember.findUnique({
          where: {
            userId_societyId: {
              userId,
              societyId: court.venue.societyId
            }
          }
        });

        if (!hasMembership || !hasMembership.isActive) {
          // Check if user has direct venue access
          const hasVenueAccess = await prisma.venueUserAccess.findUnique({
            where: {
              venueId_userId: {
                venueId: court.venue.id,
                userId
              }
            }
          });

          if (!hasVenueAccess) {
            throw new Error('You do not have access to this venue');
          }
        }
      }
    }

    // Check if the slot is already booked for the given date
    const existingBooking = await prisma.booking.findFirst({
      where: {
        courtId: bookingData.courtId,
        timeSlotId: bookingData.timeSlotId,
        bookingDate: bookingData.bookingDate,
        status: {
          in: [BookingStatus.CONFIRMED, BookingStatus.PENDING]
        }
      }
    });

    if (existingBooking) {
      throw new Error('This time slot is already booked for the selected date');
    }

    // Calculate total amount
    let totalAmount = Number(court.pricePerHour);

    // Add prices for add-ons
    if (bookingData.addOns && bookingData.addOns.length > 0) {
      for (const addOn of bookingData.addOns) {
        totalAmount += Number(addOn.price) * addOn.quantity;
      }
    }

    // Create booking transaction
    const booking = await prisma.$transaction(async (tx) => {
      // Create the booking
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
          paymentStatus: PaymentStatus.PENDING,
        }
      });

      // Create add-ons if provided
      if (bookingData.addOns && bookingData.addOns.length > 0) {
        for (const addOn of bookingData.addOns) {
          await tx.bookingAddOn.create({
            data: {
              bookingId: newBooking.id,
              addOnType: addOn.addOnType,
              quantity: addOn.quantity,
              price: addOn.price
            }
          });
        }
      }

      // Return booking with included related data
      return tx.booking.findUnique({
        where: { id: newBooking.id },
        include: {
          court: {
            include: {
              venue: true
            }
          },
          timeSlot: true,
          addOns: true
        }
      });
    });

    return booking;
  }

  /**
   * Process payment for a booking
   */
  async processPayment(bookingId: number, paymentData: CreatePaymentInput) {
    // Find the booking
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId }
    });

    if (!booking) {
      throw new Error('Booking not found');
    }

    // Check if payment already exists
    const existingPayment = await prisma.payment.findUnique({
      where: { bookingId }
    });

    if (existingPayment && existingPayment.status === PaymentStatus.PAID) {
      throw new Error('Payment has already been processed for this booking');
    }

    // Process the payment
    const payment = await prisma.$transaction(async (tx) => {
      // Create or update payment
      let payment;
      if (existingPayment) {
        payment = await tx.payment.update({
          where: { id: existingPayment.id },
          data: {
            amount: paymentData.amount,
            paymentMethod: paymentData.paymentMethod,
            transactionId: paymentData.transactionId,
            status: PaymentStatus.PAID
          }
        });
      } else {
        payment = await tx.payment.create({
          data: {
            bookingId,
            amount: paymentData.amount,
            paymentMethod: paymentData.paymentMethod,
            transactionId: paymentData.transactionId,
            status: PaymentStatus.PAID
          }
        });
      }

      // Update booking status
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.CONFIRMED,
          paymentStatus: PaymentStatus.PAID
        }
      });

      return payment;
    });

    // Get updated booking with all related data
    const updatedBooking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        court: {
          include: {
            venue: true
          }
        },
        timeSlot: true,
        addOns: true,
        payment: true
      }
    });

    return {
      booking: updatedBooking,
      payment
    };
  }

  /**
   * Get booking availability for a court on a specific date
   */
  async getCourtAvailability(courtId: number, date: Date) {
    // Check if court exists
    const court = await prisma.court.findUnique({
      where: {
        id: courtId,
        isActive: true
      },
      include: {
        timeSlots: {
          where: { isActive: true }
        }
      }
    });

    if (!court) {
      throw new Error('Court not found or inactive');
    }

    // Set date to start of day
    const bookingDate = new Date(date);
    bookingDate.setHours(0, 0, 0, 0);
    
    const nextDay = new Date(bookingDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // Get all bookings for this court on the specified date
    const bookings = await prisma.booking.findMany({
      where: {
        courtId,
        bookingDate: {
          gte: bookingDate,
          lt: nextDay
        },
        status: {
          in: [BookingStatus.CONFIRMED, BookingStatus.PENDING]
        }
      },
      select: {
        timeSlotId: true
      }
    });

    // Create a set of booked time slot IDs
    const bookedTimeSlotIds = new Set(bookings.map(booking => booking.timeSlotId));

    // Return time slots with availability information
    const availabilityInfo = court.timeSlots.map(slot => ({
      ...slot,
      isAvailable: !bookedTimeSlotIds.has(slot.id)
    }));

    return {
      court,
      date: bookingDate,
      availability: availabilityInfo
    };
  }

  /**
   * Cancel a booking
   */
  async cancelBooking(bookingId: number, userId: number, isAdmin: boolean = false) {
    // Find the booking
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        payment: true
      }
    });

    if (!booking) {
      throw new Error('Booking not found');
    }

    // Check if user is authorized to cancel
    if (!isAdmin && booking.userId !== userId) {
      throw new Error('You are not authorized to cancel this booking');
    }

    // Check if booking can be cancelled
    if (booking.status === BookingStatus.CANCELLED) {
      throw new Error('Booking is already cancelled');
    }

    if (booking.status === BookingStatus.COMPLETED) {
      throw new Error('Cannot cancel a completed booking');
    }

    // Cancel the booking
    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: BookingStatus.CANCELLED
      },
      include: {
        court: {
          include: {
            venue: true
          }
        },
        timeSlot: true,
        addOns: true,
        payment: true
      }
    });

    // Process refund if payment was made
    if (booking.payment && booking.payment.status === PaymentStatus.PAID) {
      await prisma.payment.update({
        where: { id: booking.payment.id },
        data: {
          status: PaymentStatus.REFUNDED
        }
      });

      // Update booking payment status
      await prisma.booking.update({
        where: { id: bookingId },
        data: {
          paymentStatus: PaymentStatus.REFUNDED
        }
      });
    }

    return updatedBooking;
  }

  /**
   * Get booking by ID
   */
  async getBookingById(bookingId: number) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        court: {
          include: {
            venue: true
          }
        },
        timeSlot: true,
        addOns: true,
        payment: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        }
      }
    });

    if (!booking) {
      throw new Error('Booking not found');
    }

    return booking;
  }

  /**
   * Update booking status
   */
  async updateBookingStatus(bookingId: number, status: BookingStatus) {
    // Find the booking
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId }
    });

    if (!booking) {
      throw new Error('Booking not found');
    }

    // Update booking status
    const updatedBooking = await prisma.booking.update({
      where: { id: bookingId },
      data: { status },
      include: {
        court: {
          include: {
            venue: true
          }
        },
        timeSlot: true,
        addOns: true,
        payment: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        }
      }
    });

    return updatedBooking;
  }
}

export default new BookingService();