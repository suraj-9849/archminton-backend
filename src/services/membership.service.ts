import {
  PrismaClient,
  MembershipType,
  MembershipStatus,
  PaymentStatus,
  PaymentMethod,
  SportType,
} from "@prisma/client";
import logger from "../utils/logger";

const prisma = new PrismaClient();

interface CreateMembershipPackageInput {
  name: string;
  description?: string;
  type: MembershipType;
  price: number;
  durationMonths: number;
  credits?: number;
  features?: any;
  maxBookingsPerMonth?: number;
  allowedSports?: SportType[];
  venueAccess?: number[];
}

interface UpdateMembershipPackageInput {
  name?: string;
  description?: string;
  type?: MembershipType;
  price?: number;
  durationMonths?: number;
  credits?: number;
  features?: any;
  maxBookingsPerMonth?: number;
  allowedSports?: SportType[];
  venueAccess?: number[];
  isActive?: boolean;
}

interface CreateUserMembershipInput {
  userId: number;
  packageId: number;
  startDate?: Date;
  autoRenew?: boolean;
  paymentMethod?: PaymentMethod;
  paymentReference?: string;
  skipPayment?: boolean; // For admin-created memberships
}

interface ProcessPaymentInput {
  membershipId: number;
  paymentMethod: PaymentMethod;
  paymentReference?: string;
  transactionId?: string;
}

export class MembershipService {
  // Membership Package Management
  async getAllPackages(filters?: {
    type?: MembershipType;
    isActive?: boolean;
    venueId?: number;
  }) {
    const where: any = {};

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters?.venueId) {
      where.venueAccess = {
        has: filters.venueId,
      };
    }

    return prisma.membershipPackage.findMany({
      where,
      include: {
        _count: {
          select: {
            memberships: {
              where: {
                status: "ACTIVE",
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async getPackageById(packageId: number) {
    const package_ = await prisma.membershipPackage.findUnique({
      where: { id: packageId },
      include: {
        memberships: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
        _count: {
          select: {
            memberships: true,
          },
        },
      },
    });

    if (!package_) {
      throw new Error("Membership package not found");
    }

    return package_;
  }

  async createPackage(packageData: CreateMembershipPackageInput) {
    // Check for duplicate name
    const existingPackage = await prisma.membershipPackage.findFirst({
      where: {
        name: packageData.name,
      },
    });

    if (existingPackage) {
      throw new Error("Membership package with this name already exists");
    }

    return prisma.membershipPackage.create({
      data: {
        name: packageData.name,
        description: packageData.description,
        type: packageData.type,
        price: packageData.price,
        durationMonths: packageData.durationMonths,
        credits: packageData.credits,
        features: packageData.features,
        maxBookingsPerMonth: packageData.maxBookingsPerMonth,
        allowedSports: packageData.allowedSports || [],
        venueAccess: packageData.venueAccess || [],
      },
    });
  }

  async updatePackage(
    packageId: number,
    updateData: UpdateMembershipPackageInput
  ) {
    const package_ = await prisma.membershipPackage.findUnique({
      where: { id: packageId },
    });

    if (!package_) {
      throw new Error("Membership package not found");
    }

    // Check for duplicate name if updating name
    if (updateData.name && updateData.name !== package_.name) {
      const existingPackage = await prisma.membershipPackage.findFirst({
        where: {
          name: updateData.name,
          id: { not: packageId },
        },
      });

      if (existingPackage) {
        throw new Error("Membership package with this name already exists");
      }
    }

    return prisma.membershipPackage.update({
      where: { id: packageId },
      data: updateData,
    });
  }

  async deletePackage(packageId: number) {
    const package_ = await prisma.membershipPackage.findUnique({
      where: { id: packageId },
      include: {
        memberships: {
          where: {
            status: "ACTIVE",
          },
        },
      },
    });

    if (!package_) {
      throw new Error("Membership package not found");
    }

    // Check if package has active memberships
    if (package_.memberships.length > 0) {
      // Soft delete - deactivate package
      return prisma.membershipPackage.update({
        where: { id: packageId },
        data: { isActive: false },
      });
    } else {
      // Hard delete package
      return prisma.membershipPackage.delete({
        where: { id: packageId },
      });
    }
  }

  // User Membership Management
  async getUserMemberships(
    userId: number,
    filters?: {
      status?: MembershipStatus;
      includeExpired?: boolean;
      paymentStatus?: PaymentStatus;
    }
  ) {
    const where: any = { userId };

    if (filters?.status) {
      where.status = filters.status;
    } else if (!filters?.includeExpired) {
      where.status = {
        in: ["ACTIVE", "SUSPENDED"],
      };
    }

    if (filters?.paymentStatus) {
      where.paymentStatus = filters.paymentStatus;
    }

    return prisma.userMembership.findMany({
      where,
      include: {
        package: true,
        transactions: {
          orderBy: {
            transactionDate: "desc",
          },
          take: 5,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async getMembershipById(membershipId: number) {
    const membership = await prisma.userMembership.findUnique({
      where: { id: membershipId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        package: true,
        transactions: {
          orderBy: {
            transactionDate: "desc",
          },
        },
      },
    });

    if (!membership) {
      throw new Error("Membership not found");
    }

    return membership;
  }

  async createUserMembership(membershipData: CreateUserMembershipInput) {
    // Get package details
    const package_ = await prisma.membershipPackage.findUnique({
      where: { id: membershipData.packageId },
    });

    if (!package_ || !package_.isActive) {
      throw new Error("Membership package not found or inactive");
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: membershipData.userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Calculate dates
    const startDate = membershipData.startDate || new Date();
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + package_.durationMonths);

    // Calculate next billing date for auto-renewal
    let nextBillingDate = null;
    if (membershipData.autoRenew && package_.type !== "LIFETIME") {
      nextBillingDate = new Date(endDate);
    }

    // Determine payment status and membership status
    const paymentStatus = membershipData.skipPayment ? PaymentStatus.PAID : PaymentStatus.PENDING;
    const membershipStatus = membershipData.skipPayment ? MembershipStatus.ACTIVE : MembershipStatus.PENDING;

    const membership = await prisma.$transaction(async (tx) => {
      // Create membership
      const newMembership = await tx.userMembership.create({
        data: {
          userId: membershipData.userId,
          packageId: membershipData.packageId,
          startDate,
          endDate,
          status: membershipStatus,
          creditsRemaining: membershipData.skipPayment ? (package_.credits || 0) : 0,
          autoRenew: membershipData.autoRenew || false,
          paymentStatus: paymentStatus,
          purchasePrice: package_.price,
          nextBillingDate,
        },
      });

      // Create transaction record
      await tx.membershipTransaction.create({
        data: {
          membershipId: newMembership.id,
          type: membershipData.skipPayment ? "PURCHASE" : "PENDING_PAYMENT",
          amount: package_.price,
          credits: membershipData.skipPayment ? (package_.credits || 0) : 0,
          description: membershipData.skipPayment 
            ? `Purchase of ${package_.name} membership`
            : `Pending payment for ${package_.name} membership`,
          paymentMethod: membershipData.paymentMethod,
          paymentReference: membershipData.paymentReference,
        },
      });

      return newMembership;
    });

    return this.getMembershipById(membership.id);
  }

  // New method to process payment for pending memberships
  async processPayment(paymentData: ProcessPaymentInput) {
    const membership = await prisma.userMembership.findUnique({
      where: { id: paymentData.membershipId },
      include: { package: true },
    });

    if (!membership) {
      throw new Error("Membership not found");
    }

    if (membership.paymentStatus === PaymentStatus.PAID) {
      throw new Error("Payment already processed for this membership");
    }

    if (membership.paymentStatus === PaymentStatus.FAILED) {
      throw new Error("Cannot process payment for failed membership");
    }

    const processedMembership = await prisma.$transaction(async (tx) => {
      // Update membership payment status and activate
      const updated = await tx.userMembership.update({
        where: { id: paymentData.membershipId },
        data: {
          paymentStatus: PaymentStatus.PAID,
          status: MembershipStatus.ACTIVE,
          creditsRemaining: membership.package.credits || 0,
        },
      });

      // Create payment confirmation transaction
      await tx.membershipTransaction.create({
        data: {
          membershipId: paymentData.membershipId,
          type: "PAYMENT_CONFIRMATION",
          amount: membership.purchasePrice,
          credits: membership.package.credits || 0,
          description: `Payment confirmed for ${membership.package.name} membership`,
          paymentMethod: paymentData.paymentMethod,
          paymentReference: paymentData.paymentReference,
        },
      });

      return updated;
    });

    return this.getMembershipById(processedMembership.id);
  }

  // Method to mark payment as failed
  async markPaymentFailed(membershipId: number, reason?: string) {
    const membership = await prisma.userMembership.findUnique({
      where: { id: membershipId },
      include: { package: true },
    });

    if (!membership) {
      throw new Error("Membership not found");
    }

    const failedMembership = await prisma.$transaction(async (tx) => {
      // Update membership payment status
      const updated = await tx.userMembership.update({
        where: { id: membershipId },
        data: {
          paymentStatus: PaymentStatus.FAILED,
          status: MembershipStatus.CANCELLED,
        },
      });

      // Create failure transaction
      await tx.membershipTransaction.create({
        data: {
          membershipId: membershipId,
          type: "PAYMENT_FAILED",
          description: reason || `Payment failed for ${membership.package.name} membership`,
        },
      });

      return updated;
    });

    return this.getMembershipById(failedMembership.id);
  }

  async renewMembership(membershipId: number, paymentReference?: string) {
    const membership = await prisma.userMembership.findUnique({
      where: { id: membershipId },
      include: {
        package: true,
      },
    });

    if (!membership) {
      throw new Error("Membership not found");
    }

    if (membership.package.type === "LIFETIME") {
      throw new Error("Lifetime memberships cannot be renewed");
    }

    // Calculate new dates
    const newStartDate = new Date(membership.endDate);
    const newEndDate = new Date(newStartDate);
    newEndDate.setMonth(
      newEndDate.getMonth() + membership.package.durationMonths
    );

    let nextBillingDate = null;
    if (membership.autoRenew) {
      nextBillingDate = new Date(newEndDate);
    }

    const renewedMembership = await prisma.$transaction(async (tx) => {
      // Update membership
      const updated = await tx.userMembership.update({
        where: { id: membershipId },
        data: {
          endDate: newEndDate,
          status: "ACTIVE",
          creditsRemaining: membership.package.credits || 0,
          bookingsThisMonth: 0,
          lastBillingDate: newStartDate,
          nextBillingDate,
          paymentStatus: PaymentStatus.PAID,
        },
      });

      // Create renewal transaction
      await tx.membershipTransaction.create({
        data: {
          membershipId,
          type: "RENEWAL",
          amount: membership.package.price,
          credits: membership.package.credits || 0,
          description: `Renewal of ${membership.package.name} membership`,
          paymentReference,
        },
      });

      return updated;
    });

    return this.getMembershipById(renewedMembership.id);
  }

  async cancelMembership(membershipId: number, reason?: string) {
    const membership = await prisma.userMembership.findUnique({
      where: { id: membershipId },
      include: {
        package: true,
      },
    });

    if (!membership) {
      throw new Error("Membership not found");
    }

    if (membership.status === "CANCELLED") {
      throw new Error("Membership is already cancelled");
    }

    const cancelledMembership = await prisma.$transaction(async (tx) => {
      // Update membership status
      const updated = await tx.userMembership.update({
        where: { id: membershipId },
        data: {
          status: "CANCELLED",
          autoRenew: false,
          nextBillingDate: null,
        },
      });

      // Create cancellation transaction
      await tx.membershipTransaction.create({
        data: {
          membershipId,
          type: "CANCELLATION",
          description: reason || "Membership cancelled",
        },
      });

      return updated;
    });

    return this.getMembershipById(cancelledMembership.id);
  }

  async updateMembershipStatus(membershipId: number, status: MembershipStatus) {
    const membership = await prisma.userMembership.findUnique({
      where: { id: membershipId },
    });

    if (!membership) {
      throw new Error("Membership not found");
    }

    return prisma.userMembership.update({
      where: { id: membershipId },
      data: { status },
    });
  }

  // Get pending payments
  async getPendingPayments(venueId?: number) {
    const membershipFilter: any = {
      paymentStatus: PaymentStatus.PENDING,
      status: MembershipStatus.PENDING,
    };

    if (venueId) {
      membershipFilter.package = {
        venueAccess: {
          has: venueId,
        },
      };
    }

    return prisma.userMembership.findMany({
      where: membershipFilter,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        package: {
          select: {
            id: true,
            name: true,
            type: true,
            price: true,
          },
        },
        transactions: {
          orderBy: {
            transactionDate: "desc",
          },
          take: 1,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  // Statistics and Analytics
  async getMembershipStatistics(venueId?: number) {
    const packageFilter = venueId
      ? {
          venueAccess: {
            has: venueId,
          },
        }
      : {};

    const membershipFilter = venueId
      ? {
          package: packageFilter,
        }
      : {};

    const [
      totalPackages,
      activePackages,
      totalMemberships,
      activeMemberships,
      expiredMemberships,
      pendingPayments,
      totalRevenue,
      monthlyRevenue,
    ] = await Promise.all([
      // Total packages
      prisma.membershipPackage.count({
        where: packageFilter,
      }),

      // Active packages
      prisma.membershipPackage.count({
        where: {
          ...packageFilter,
          isActive: true,
        },
      }),

      // Total memberships
      prisma.userMembership.count({
        where: membershipFilter,
      }),

      // Active memberships
      prisma.userMembership.count({
        where: {
          ...membershipFilter,
          status: "ACTIVE",
        },
      }),

      // Expired memberships
      prisma.userMembership.count({
        where: {
          ...membershipFilter,
          status: "EXPIRED",
        },
      }),

      // Pending payments
      prisma.userMembership.count({
        where: {
          ...membershipFilter,
          paymentStatus: "PENDING",
        },
      }),

      // Total revenue
      prisma.userMembership.aggregate({
        where: {
          ...membershipFilter,
          paymentStatus: "PAID",
        },
        _sum: {
          purchasePrice: true,
        },
      }),

      // This month's revenue
      prisma.userMembership.aggregate({
        where: {
          ...membershipFilter,
          paymentStatus: "PAID",
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
        _sum: {
          purchasePrice: true,
        },
      }),
    ]);

    return {
      packages: {
        total: totalPackages,
        active: activePackages,
        inactive: totalPackages - activePackages,
      },
      memberships: {
        total: totalMemberships,
        active: activeMemberships,
        expired: expiredMemberships,
        pending: pendingPayments,
        other: totalMemberships - activeMemberships - expiredMemberships - pendingPayments,
      },
      revenue: {
        total: Number(totalRevenue._sum.purchasePrice) || 0,
        thisMonth: Number(monthlyRevenue._sum.purchasePrice) || 0,
      },
    };
  }

  async getExpiringMemberships(days: number = 30, venueId?: number) {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + days);

    const membershipFilter: any = {
      status: "ACTIVE",
      endDate: {
        lte: expiryDate,
        gte: new Date(),
      },
    };

    if (venueId) {
      membershipFilter.package = {
        venueAccess: {
          has: venueId,
        },
      };
    }

    return prisma.userMembership.findMany({
      where: membershipFilter,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
        package: {
          select: {
            id: true,
            name: true,
            type: true,
            price: true,
          },
        },
      },
      orderBy: {
        endDate: "asc",
      },
    });
  }

  // Usage tracking
  async useCredits(membershipId: number, credits: number, description: string) {
    const membership = await prisma.userMembership.findUnique({
      where: { id: membershipId },
    });

    if (!membership) {
      throw new Error("Membership not found");
    }

    if (membership.status !== "ACTIVE") {
      throw new Error("Membership is not active");
    }

    if (membership.paymentStatus !== "PAID") {
      throw new Error("Membership payment is not confirmed");
    }

    if ((membership.creditsRemaining || 0) < credits) {
      throw new Error("Insufficient credits");
    }

    return prisma.$transaction(async (tx) => {
      // Update membership credits
      const updated = await tx.userMembership.update({
        where: { id: membershipId },
        data: {
          creditsRemaining: (membership.creditsRemaining || 0) - credits,
        },
      });

      // Create usage transaction
      await tx.membershipTransaction.create({
        data: {
          membershipId,
          type: "CREDIT_USAGE",
          credits: -credits,
          description,
        },
      });

      return updated;
    });
  }

  async incrementBookingCount(membershipId: number) {
    return prisma.userMembership.update({
      where: { id: membershipId },
      data: {
        bookingsThisMonth: {
          increment: 1,
        },
      },
    });
  }
}

export default new MembershipService();