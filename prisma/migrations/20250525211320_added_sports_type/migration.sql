/*
  Warnings:

  - The primary key for the `_VenueUserAccess` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[A,B]` on the table `_VenueUserAccess` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SportType" ADD VALUE 'ARCHERY';
ALTER TYPE "SportType" ADD VALUE 'TABLE_TENNIS';
ALTER TYPE "SportType" ADD VALUE 'SQUASH';

-- AlterTable
ALTER TABLE "_VenueUserAccess" DROP CONSTRAINT "_VenueUserAccess_AB_pkey";

-- CreateTable
CREATE TABLE "VenueSportsConfig" (
    "id" SERIAL NOT NULL,
    "venueId" INTEGER NOT NULL,
    "sportType" "SportType" NOT NULL,
    "maxCourts" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VenueSportsConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VenueSportsConfig_venueId_sportType_key" ON "VenueSportsConfig"("venueId", "sportType");

-- CreateIndex
CREATE UNIQUE INDEX "_VenueUserAccess_AB_unique" ON "_VenueUserAccess"("A", "B");

-- AddForeignKey
ALTER TABLE "VenueSportsConfig" ADD CONSTRAINT "VenueSportsConfig_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
