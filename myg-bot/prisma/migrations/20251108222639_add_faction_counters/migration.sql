-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ConsumableType" ADD VALUE 'FACTION_CHEST_I';
ALTER TYPE "ConsumableType" ADD VALUE 'TITLE_TOKEN_COMMON';
ALTER TYPE "ConsumableType" ADD VALUE 'TITLE_TOKEN_RARE';
ALTER TYPE "ConsumableType" ADD VALUE 'TITLE_TOKEN_EPIC';

-- AlterTable
ALTER TABLE "FactionState" ADD COLUMN     "championTickets" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "discountPct" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "duelTickets" INTEGER NOT NULL DEFAULT 0;
