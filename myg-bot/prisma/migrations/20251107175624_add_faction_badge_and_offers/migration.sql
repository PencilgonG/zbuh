-- CreateEnum
CREATE TYPE "OfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "FactionTransferOffer" (
    "id" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "fromFactionId" INTEGER NOT NULL,
    "toFactionId" INTEGER NOT NULL,
    "status" "OfferStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "FactionTransferOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FactionTransferOffer_status_expiresAt_idx" ON "FactionTransferOffer"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "FactionTransferOffer_targetUserId_status_idx" ON "FactionTransferOffer"("targetUserId", "status");

-- CreateIndex
CREATE INDEX "Faction_name_idx" ON "Faction"("name");

-- CreateIndex
CREATE INDEX "Faction_totalPoints_idx" ON "Faction"("totalPoints");

-- CreateIndex
CREATE INDEX "UserProfile_factionId_idx" ON "UserProfile"("factionId");

-- AddForeignKey
ALTER TABLE "FactionTransferOffer" ADD CONSTRAINT "FactionTransferOffer_fromFactionId_fkey" FOREIGN KEY ("fromFactionId") REFERENCES "Faction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactionTransferOffer" ADD CONSTRAINT "FactionTransferOffer_toFactionId_fkey" FOREIGN KEY ("toFactionId") REFERENCES "Faction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
