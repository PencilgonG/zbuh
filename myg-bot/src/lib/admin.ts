// src/lib/admin.ts
import { env } from "../env";

/**
 * Liste des admins, lue depuis ADMIN_USER_IDS
 * Format recommandé dans .env :
 *   ADMIN_USER_IDS=123456789012345678,987654321098765432
 */
const ADMIN_IDS: string[] = (env.ADMIN_USER_IDS ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter((id) => id.length > 0);

export function isAdminUser(userId: string): boolean {
  if (!ADMIN_IDS.length) return false;
  return ADMIN_IDS.includes(userId);
}

export function getAdminIds(): string[] {
  return ADMIN_IDS;
}
