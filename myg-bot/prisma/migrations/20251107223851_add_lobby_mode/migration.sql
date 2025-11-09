/*
  Warnings:

  - The values [BATTLE_ROYAL] on the enum `LobbyMode` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `surpriseRule` on the `Lobby` table. All the data in the column will be lost.
  - You are about to drop the `BattleMatch` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "LobbyMode_new" AS ENUM ('NORMAL', 'SURPRISE', 'BATTLE_ROYALE');
ALTER TABLE "myg"."Lobby" ALTER COLUMN "mode" DROP DEFAULT;
ALTER TABLE "Lobby" ALTER COLUMN "mode" TYPE "LobbyMode_new" USING ("mode"::text::"LobbyMode_new");
ALTER TYPE "LobbyMode" RENAME TO "LobbyMode_old";
ALTER TYPE "LobbyMode_new" RENAME TO "LobbyMode";
DROP TYPE "myg"."LobbyMode_old";
ALTER TABLE "Lobby" ALTER COLUMN "mode" SET DEFAULT 'NORMAL';
COMMIT;

-- DropForeignKey
ALTER TABLE "BattleMatch" DROP CONSTRAINT "BattleMatch_lobbyId_fkey";

-- DropIndex
DROP INDEX "Lobby_mode_idx";

-- AlterTable
ALTER TABLE "Lobby" DROP COLUMN "surpriseRule";

-- DropTable
DROP TABLE "BattleMatch";
