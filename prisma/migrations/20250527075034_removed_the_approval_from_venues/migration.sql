/*
  Warnings:

  - The values [VENUE_MANAGER_ACCESS,VENUE_USER_ACCESS,ROLE_CHANGE_REQUEST] on the enum `ApprovalType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `requestData` on the `Approval` table. All the data in the column will be lost.
  - You are about to drop the column `venueId` on the `Approval` table. All the data in the column will be lost.
  - You are about to drop the `VenueUserAccess` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_VenueUserAccess` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `societyId` on table `Approval` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ApprovalType_new" AS ENUM ('SOCIETY_MEMBERSHIP');
ALTER TABLE "Approval" ALTER COLUMN "type" TYPE "ApprovalType_new" USING ("type"::text::"ApprovalType_new");
ALTER TYPE "ApprovalType" RENAME TO "ApprovalType_old";
ALTER TYPE "ApprovalType_new" RENAME TO "ApprovalType";
DROP TYPE "ApprovalType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "Approval" DROP CONSTRAINT "Approval_societyId_fkey";

-- DropForeignKey
ALTER TABLE "Approval" DROP CONSTRAINT "Approval_venueId_fkey";

-- DropForeignKey
ALTER TABLE "VenueUserAccess" DROP CONSTRAINT "VenueUserAccess_userId_fkey";

-- DropForeignKey
ALTER TABLE "VenueUserAccess" DROP CONSTRAINT "VenueUserAccess_venueId_fkey";

-- DropForeignKey
ALTER TABLE "_VenueUserAccess" DROP CONSTRAINT "_VenueUserAccess_A_fkey";

-- DropForeignKey
ALTER TABLE "_VenueUserAccess" DROP CONSTRAINT "_VenueUserAccess_B_fkey";

-- AlterTable
ALTER TABLE "Approval" DROP COLUMN "requestData",
DROP COLUMN "venueId",
ALTER COLUMN "type" SET DEFAULT 'SOCIETY_MEMBERSHIP',
ALTER COLUMN "societyId" SET NOT NULL;

-- DropTable
DROP TABLE "VenueUserAccess";

-- DropTable
DROP TABLE "_VenueUserAccess";

-- DropEnum
DROP TYPE "AccessStatus";

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
