-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "winnerTeamId" TEXT;

-- CreateTable
CREATE TABLE "MvpVote" (
    "id" TEXT NOT NULL,
    "lobbyId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "voterDiscordId" TEXT NOT NULL,
    "votedDiscordId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MvpVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointsLedger" (
    "id" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointsLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MvpVote_lobbyId_idx" ON "MvpVote"("lobbyId");

-- CreateIndex
CREATE UNIQUE INDEX "MvpVote_matchId_teamId_voterDiscordId_key" ON "MvpVote"("matchId", "teamId", "voterDiscordId");

-- CreateIndex
CREATE INDEX "PointsLedger_discordId_idx" ON "PointsLedger"("discordId");

-- CreateIndex
CREATE INDEX "PointsLedger_matchId_idx" ON "PointsLedger"("matchId");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_winnerTeamId_fkey" FOREIGN KEY ("winnerTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
