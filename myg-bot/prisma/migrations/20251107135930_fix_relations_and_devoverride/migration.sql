-- CreateEnum
CREATE TYPE "ShopType" AS ENUM ('TITLE', 'CONSUMABLE', 'FACTION');

-- CreateEnum
CREATE TYPE "ConsumableType" AS ENUM ('BAN_PLUS_ONE', 'DOUBLE_IMPOSTOR_VOTE', 'FACTION_TRANSFER');

-- CreateEnum
CREATE TYPE "QuotaType" AS ENUM ('BAN_PLUS_ONE_WEEKLY', 'DOUBLE_IMPOSTOR_VOTE_WEEKLY', 'FACTION_TRANSFER_MONTHLY');

-- CreateEnum
CREATE TYPE "FactionBadgeType" AS ENUM ('INSIGNE', 'EMISSAIRE');

-- CreateEnum
CREATE TYPE "ChallengeStatus" AS ENUM ('PENDING', 'APPROVED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ListingType" AS ENUM ('TITLE', 'CONSUMABLE');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('ACTIVE', 'SOLD', 'CANCELLED', 'EXPIRED');

-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "activeTitleId" INTEGER,
ADD COLUMN     "factionId" INTEGER;

-- CreateTable
CREATE TABLE "FaqItem" (
    "id" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FaqItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InhouseEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "mode" TEXT,
    "maxPlayers" INTEGER,
    "description" TEXT,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InhouseEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Title" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rarity" TEXT,
    "price" INTEGER NOT NULL,
    "tradeable" BOOLEAN NOT NULL DEFAULT false,
    "factionLockId" INTEGER,

    CONSTRAINT "Title_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserTitle" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "titleId" INTEGER NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserTitle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopItem" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "ShopType" NOT NULL,
    "price" INTEGER NOT NULL,

    CONSTRAINT "ShopItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsumableStock" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ConsumableType" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsumableStock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserQuota" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "QuotaType" NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserQuota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Faction" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "colorHex" TEXT NOT NULL,
    "emblemUrl" TEXT,
    "totalPoints" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Faction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FactionBadge" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "factionId" INTEGER NOT NULL,
    "type" "FactionBadgeType" NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FactionBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FactionChallenge" (
    "id" SERIAL NOT NULL,
    "challengerFactionId" INTEGER NOT NULL,
    "opponentFactionId" INTEGER NOT NULL,
    "createdBy" TEXT NOT NULL,
    "approvedBy" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "status" "ChallengeStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FactionChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FactionOffering" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "factionId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FactionOffering_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FactionChest" (
    "id" SERIAL NOT NULL,
    "factionId" INTEGER NOT NULL,
    "season" TEXT,
    "openedAt" TIMESTAMP(3),
    "rewardsJson" JSONB,

    CONSTRAINT "FactionChest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" SERIAL NOT NULL,
    "sellerId" TEXT NOT NULL,
    "itemType" "ListingType" NOT NULL,
    "titleId" INTEGER,
    "consumableType" "ConsumableType",
    "price" INTEGER NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" SERIAL NOT NULL,
    "listingId" INTEGER NOT NULL,
    "buyerId" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "fee" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DevOverride" (
    "userId" TEXT NOT NULL,
    "infinitePoints" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DevOverride_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "InhouseEvent_startAt_idx" ON "InhouseEvent"("startAt");

-- CreateIndex
CREATE INDEX "UserTitle_userId_idx" ON "UserTitle"("userId");

-- CreateIndex
CREATE INDEX "UserTitle_titleId_idx" ON "UserTitle"("titleId");

-- CreateIndex
CREATE UNIQUE INDEX "UserTitle_userId_titleId_key" ON "UserTitle"("userId", "titleId");

-- CreateIndex
CREATE INDEX "Purchase_userId_idx" ON "Purchase"("userId");

-- CreateIndex
CREATE INDEX "Purchase_itemId_idx" ON "Purchase"("itemId");

-- CreateIndex
CREATE INDEX "ConsumableStock_userId_idx" ON "ConsumableStock"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsumableStock_userId_type_key" ON "ConsumableStock"("userId", "type");

-- CreateIndex
CREATE INDEX "UserQuota_userId_idx" ON "UserQuota"("userId");

-- CreateIndex
CREATE INDEX "UserQuota_type_idx" ON "UserQuota"("type");

-- CreateIndex
CREATE UNIQUE INDEX "UserQuota_userId_type_windowStart_key" ON "UserQuota"("userId", "type", "windowStart");

-- CreateIndex
CREATE INDEX "FactionBadge_userId_idx" ON "FactionBadge"("userId");

-- CreateIndex
CREATE INDEX "FactionBadge_factionId_idx" ON "FactionBadge"("factionId");

-- CreateIndex
CREATE UNIQUE INDEX "FactionBadge_userId_factionId_type_key" ON "FactionBadge"("userId", "factionId", "type");

-- CreateIndex
CREATE INDEX "FactionChallenge_challengerFactionId_idx" ON "FactionChallenge"("challengerFactionId");

-- CreateIndex
CREATE INDEX "FactionChallenge_opponentFactionId_idx" ON "FactionChallenge"("opponentFactionId");

-- CreateIndex
CREATE INDEX "FactionChallenge_status_idx" ON "FactionChallenge"("status");

-- CreateIndex
CREATE INDEX "FactionOffering_userId_idx" ON "FactionOffering"("userId");

-- CreateIndex
CREATE INDEX "FactionOffering_factionId_idx" ON "FactionOffering"("factionId");

-- CreateIndex
CREATE INDEX "FactionChest_factionId_idx" ON "FactionChest"("factionId");

-- CreateIndex
CREATE INDEX "Listing_sellerId_idx" ON "Listing"("sellerId");

-- CreateIndex
CREATE INDEX "Listing_status_idx" ON "Listing"("status");

-- CreateIndex
CREATE INDEX "Listing_expiresAt_idx" ON "Listing"("expiresAt");

-- CreateIndex
CREATE INDEX "Trade_buyerId_idx" ON "Trade"("buyerId");

-- CreateIndex
CREATE INDEX "Trade_listingId_idx" ON "Trade"("listingId");

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_factionId_fkey" FOREIGN KEY ("factionId") REFERENCES "Faction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_activeTitleId_fkey" FOREIGN KEY ("activeTitleId") REFERENCES "Title"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Title" ADD CONSTRAINT "Title_factionLockId_fkey" FOREIGN KEY ("factionLockId") REFERENCES "Faction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTitle" ADD CONSTRAINT "UserTitle_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "Title"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTitle" ADD CONSTRAINT "UserTitle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("discordId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ShopItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("discordId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsumableStock" ADD CONSTRAINT "ConsumableStock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("discordId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserQuota" ADD CONSTRAINT "UserQuota_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("discordId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactionBadge" ADD CONSTRAINT "FactionBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("discordId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactionBadge" ADD CONSTRAINT "FactionBadge_factionId_fkey" FOREIGN KEY ("factionId") REFERENCES "Faction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactionChallenge" ADD CONSTRAINT "FactionChallenge_challengerFactionId_fkey" FOREIGN KEY ("challengerFactionId") REFERENCES "Faction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactionChallenge" ADD CONSTRAINT "FactionChallenge_opponentFactionId_fkey" FOREIGN KEY ("opponentFactionId") REFERENCES "Faction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactionOffering" ADD CONSTRAINT "FactionOffering_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("discordId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactionOffering" ADD CONSTRAINT "FactionOffering_factionId_fkey" FOREIGN KEY ("factionId") REFERENCES "Faction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FactionChest" ADD CONSTRAINT "FactionChest_factionId_fkey" FOREIGN KEY ("factionId") REFERENCES "Faction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "UserProfile"("discordId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "Title"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "UserProfile"("discordId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevOverride" ADD CONSTRAINT "DevOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserProfile"("discordId") ON DELETE RESTRICT ON UPDATE CASCADE;
