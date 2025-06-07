/*
  Warnings:

  - The `allowedSports` column on the `MembershipPackage` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `sportType` on the `Course` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `sportType` on the `Court` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `sportType` on the `VenueSportsConfig` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "Course" DROP COLUMN "sportType",
ADD COLUMN     "sportType" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Court" DROP COLUMN "sportType",
ADD COLUMN     "sportType" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "MembershipPackage" DROP COLUMN "allowedSports",
ADD COLUMN     "allowedSports" TEXT[];

-- AlterTable
ALTER TABLE "VenueSportsConfig" DROP COLUMN "sportType",
ADD COLUMN     "sportType" TEXT NOT NULL;

-- DropEnum
DROP TYPE "SportType";

-- CreateIndex
CREATE UNIQUE INDEX "VenueSportsConfig_venueId_sportType_key" ON "VenueSportsConfig"("venueId", "sportType");
