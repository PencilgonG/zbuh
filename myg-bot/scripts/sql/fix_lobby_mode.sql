-- 1) Renommer la valeur d'ENUM 'BATTLE_ROYAL' -> 'BATTLE_ROYALE'
ALTER TYPE "LobbyMode" RENAME VALUE 'BATTLE_ROYAL' TO 'BATTLE_ROYALE';

-- 2) Mettre la colonne à NULL (si elle existe encore) avant le drop
UPDATE "Lobby" SET "surpriseRule" = NULL WHERE "surpriseRule" IS NOT NULL;
