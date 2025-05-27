-- AlterEnum
ALTER TYPE "MembershipStatus" ADD VALUE 'PENDING';

-- AlterTable
ALTER TABLE "MembershipTransaction" ADD COLUMN     "transactionId" TEXT;

-- AlterTable
ALTER TABLE "_VenueUserAccess" ADD CONSTRAINT "_VenueUserAccess_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_VenueUserAccess_AB_unique";

-- CreateIndex
CREATE INDEX "UserMembership_paymentStatus_idx" ON "UserMembership"("paymentStatus");
