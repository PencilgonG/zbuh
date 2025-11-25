// src/lib/admin.ts
import { env } from "../env";

/**
 * Liste des IDs admin en mémoire (Set pour lookup rapide).
 * Format dans .env : ADMIN_USER_IDS=123,456,789
 */
const adminIds: Set<string> = new Set(
  (env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0),
);

/** true si l'ID Discord appartient à un admin. */
export function isAdminUser(discordId: string): boolean {
  return adminIds.has(discordId);
}
