-- CreateEnum
CREATE TYPE "MatchState" AS ENUM ('PENDING', 'RUNNING', 'FINISHED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "lobbyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "captainId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "lobbyParticipantId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "lobbyId" TEXT NOT NULL,
    "teamAId" TEXT NOT NULL,
    "teamBId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "state" "MatchState" NOT NULL DEFAULT 'PENDING',
    "draftRoomId" TEXT,
    "blueUrl" TEXT,
    "redUrl" TEXT,
    "specUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_lobbyParticipantId_key" ON "TeamMember"("lobbyParticipantId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_teamId_lobbyParticipantId_key" ON "TeamMember"("teamId", "lobbyParticipantId");

-- CreateIndex
CREATE INDEX "Match_lobbyId_round_idx" ON "Match"("lobbyId", "round");

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "Lobby"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_lobbyParticipantId_fkey" FOREIGN KEY ("lobbyParticipantId") REFERENCES "LobbyParticipant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "Lobby"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_teamAId_fkey" FOREIGN KEY ("teamAId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_teamBId_fkey" FOREIGN KEY ("teamBId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
