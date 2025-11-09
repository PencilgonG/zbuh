-- CreateTable
CREATE TABLE "BattleMatch" (
    "id" TEXT NOT NULL,
    "lobbyId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "aId" TEXT NOT NULL,
    "bId" TEXT NOT NULL,
    "winnerId" TEXT,
    "isFinal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BattleMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BattleMatch_lobbyId_round_idx" ON "BattleMatch"("lobbyId", "round");

-- CreateIndex
CREATE INDEX "BattleMatch_lobbyId_isFinal_idx" ON "BattleMatch"("lobbyId", "isFinal");

-- AddForeignKey
ALTER TABLE "BattleMatch" ADD CONSTRAINT "BattleMatch_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "Lobby"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
