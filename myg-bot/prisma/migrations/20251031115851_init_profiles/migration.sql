-- CreateEnum
CREATE TYPE "Elo" AS ENUM ('IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('TOP', 'JGL', 'MID', 'ADC', 'SUPP', 'SUB');

-- CreateTable
CREATE TABLE "UserProfile" (
    "discordId" TEXT NOT NULL,
    "summonerName" TEXT,
    "elo" "Elo",
    "mainRole" "Role",
    "secondaryRole" "Role",
    "opggUrl" TEXT,
    "dpmUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("discordId")
);
