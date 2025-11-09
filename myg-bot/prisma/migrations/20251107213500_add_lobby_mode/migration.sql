-- CreateEnum
CREATE TYPE "LobbyMode" AS ENUM ('NORMAL', 'SURPRISE', 'BATTLE_ROYAL');

-- AlterTable
ALTER TABLE "Lobby" ADD COLUMN     "mode" "LobbyMode" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "surpriseRule" TEXT;
