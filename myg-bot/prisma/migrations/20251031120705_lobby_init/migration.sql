-- CreateEnum
CREATE TYPE "LobbyStatus" AS ENUM ('WAITING', 'BUILDER', 'CLOSED');

-- CreateTable
CREATE TABLE "Lobby" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "teams" INTEGER NOT NULL,
    "status" "LobbyStatus" NOT NULL DEFAULT 'WAITING',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lobby_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LobbyParticipant" (
    "id" TEXT NOT NULL,
    "lobbyId" TEXT NOT NULL,
    "discordId" TEXT,
    "display" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "isFake" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LobbyParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LobbyParticipant_lobbyId_role_idx" ON "LobbyParticipant"("lobbyId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "LobbyParticipant_lobbyId_discordId_key" ON "LobbyParticipant"("lobbyId", "discordId");

-- AddForeignKey
ALTER TABLE "LobbyParticipant" ADD CONSTRAINT "LobbyParticipant_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "Lobby"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
