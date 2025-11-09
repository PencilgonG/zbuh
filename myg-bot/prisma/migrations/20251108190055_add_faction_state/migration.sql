-- CreateTable
CREATE TABLE "FactionState" (
    "factionId" INTEGER NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FactionState_pkey" PRIMARY KEY ("factionId")
);

-- AddForeignKey
ALTER TABLE "FactionState" ADD CONSTRAINT "FactionState_factionId_fkey" FOREIGN KEY ("factionId") REFERENCES "Faction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
