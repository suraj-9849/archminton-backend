-- CreateTable
CREATE TABLE "_VenueSportsCourts" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_VenueSportsCourts_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_VenueSportsCourts_B_index" ON "_VenueSportsCourts"("B");

-- AddForeignKey
ALTER TABLE "_VenueSportsCourts" ADD CONSTRAINT "_VenueSportsCourts_A_fkey" FOREIGN KEY ("A") REFERENCES "Court"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_VenueSportsCourts" ADD CONSTRAINT "_VenueSportsCourts_B_fkey" FOREIGN KEY ("B") REFERENCES "VenueSportsConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
