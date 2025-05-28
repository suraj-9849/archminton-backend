-- CreateTable
CREATE TABLE "Holiday" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "venueId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Holiday_date_idx" ON "Holiday"("date");

-- CreateIndex
CREATE INDEX "Holiday_venueId_idx" ON "Holiday"("venueId");

-- CreateIndex
CREATE INDEX "Holiday_isActive_idx" ON "Holiday"("isActive");

-- AddForeignKey
ALTER TABLE "Holiday" ADD CONSTRAINT "Holiday_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
