/*
  Warnings:

  - A unique constraint covering the columns `[lobbyId,round,teamAId,teamBId]` on the table `Match` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE INDEX "Match_lobbyId_round_state_idx" ON "Match"("lobbyId", "round", "state");

-- CreateIndex
CREATE UNIQUE INDEX "Match_lobbyId_round_teamAId_teamBId_key" ON "Match"("lobbyId", "round", "teamAId", "teamBId");
