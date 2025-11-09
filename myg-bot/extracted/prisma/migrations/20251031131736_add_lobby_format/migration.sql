-- CreateEnum
CREATE TYPE "LobbyFormat" AS ENUM ('BO1', 'BO3', 'BO5', 'RR1', 'RR2', 'RR3');

-- AlterTable
ALTER TABLE "Lobby" ADD COLUMN     "format" "LobbyFormat";
