// src/utils/factions.ts
import { prisma } from "../prismat";

/* =========================
 * Types & thèmes de faction
 * ========================= */
export type FactionKey =
  | "DEMACIA"
  | "NOXUS"
  | "IONIA"
  | "FRELJORD"
  | "PILTOVER"
  | "SHURIMA"
  | "ZAUN";

type Theme = {
  name: string;
  color: number;
  bannerUrl?: string;
};

export function getFactionTheme(key?: FactionKey): Theme {
  const k = key ?? "DEMACIA";
  const env = (name: string) => process.env[name];

  switch (k) {
    case "FRELJORD":
      return { name: "Freljord", color: 0x70b3ff, bannerUrl: env("BANNER_FRELJORD") ?? env("MYG_FRELJORD_BANNER") };
    case "DEMACIA":
      return { name: "Demacia", color: 0xf1c40f, bannerUrl: env("BANNER_DEMACIA") };
    case "NOXUS":
      return { name: "Noxus", color: 0xc0392b, bannerUrl: env("BANNER_NOXUS") };
    case "IONIA":
      return { name: "Ionia", color: 0xe67e22, bannerUrl: env("BANNER_IONIA") };
    case "PILTOVER":
      return { name: "Piltover", color: 0xf39c12, bannerUrl: env("BANNER_PILTOVER") };
    case "SHURIMA":
      return { name: "Shurima", color: 0xd4af37, bannerUrl: env("BANNER_SHURIMA") };
    case "ZAUN":
      return { name: "Zaun", color: 0x2ecc71, bannerUrl: env("BANNER_ZAUN") };
    default:
      return { name: "Faction", color: 0x95a5a6 };
  }
}

/* =========================
 * Courbe de coûts (≈3000 pts -> L30)
 * ========================= */
const LEVEL_COSTS: number[] = [
  80, 82, 83, 85, 87, 88, 90, 92, 93, 95,
  97, 98, 100, 102, 103, 105, 107, 108, 110, 112,
  114, 115, 117, 119, 120, 122, 124, 125, 127,
];

export function costForNextLevel(level: number): number | null {
  if (level < 1 || level >= 30) return null;
  return LEVEL_COSTS[level - 1] ?? null;
}

export function isMaxFactionLevel(level: number): boolean {
  return level >= 30;
}

/* =========================
 * Helpers récompenses
 * ========================= */

// Donne un consommable à TOUS les membres de la faction
async function giveConsumableToAllMembers(
  factionId: number,
  consumableType:
    | "FACTION_CHEST_I"
    | "TITLE_TOKEN_COMMON"
    | "TITLE_TOKEN_RARE"
    | "TITLE_TOKEN_EPIC",
  qty: number,
) {
  if (qty <= 0) return;

  const members = await prisma.userProfile.findMany({
    where: { factionId },
    select: { discordId: true },
  });
  if (members.length === 0) return;

  for (const { discordId } of members) {
    await prisma.consumableStock.upsert({
      where: { userId_type: { userId: discordId, type: consumableType } },
      update: { quantity: { increment: qty } },
      create: { userId: discordId, type: consumableType, quantity: qty },
    });
  }
}

// Incrémente la réduction boutique de `by` avec cap 15%
async function incrementDiscount(factionId: number, by: number) {
  const state = await prisma.factionState.findUnique({ where: { factionId } });
  const current = state?.discountPct ?? 0;
  const next = Math.min(15, Math.max(0, current + by));
  await prisma.factionState.update({ where: { factionId }, data: { discountPct: next } });
}

// Incrémente les tickets (champion|duel) de `by`
async function incrementTickets(
  factionId: number,
  field: "championTickets" | "duelTickets",
  by: number,
) {
  await prisma.factionState.update({
    where: { factionId },
    data: { [field]: { increment: by } },
  });
}

/* =========================
 * Récompenses par niveau (cumulatives)
 * =========================
 * L1–L3  : Coffre I ×1 par membre
 * L4–L5  : Réduc boutique +1%
 * L6–L9  : Coffre I ×1 par membre
 * L10    : Ticket Champion ×1 (faction)
 * L11–L13: Réduc boutique +1%
 * L14    : Jeton de titre (rare) ×1 par membre
 * L15    : Ticket de duel ×1 (faction)
 * L16–L19: Coffre I ×2 par membre
 * L20    : Ticket Champion ×1 (faction)
 * L21–L22: Coffre I ×2 par membre
 * L23    : Réduc boutique +1%
 * L24    : Jeton de titre (épique) ×1 par membre
 * L25    : Ticket de duel ×1 (faction)
 * L26    : Jeton de titre (épique) ×1 par membre
 * L27–L28: Réduc boutique +1%
 * L29    : Coffre I ×3 par membre
 * L30    : Ticket Champion ×1 (faction)
 */
export async function applyLevelReward(factionId: number, level: number) {
  switch (true) {
    case level >= 1 && level <= 3:
      await giveConsumableToAllMembers(factionId, "FACTION_CHEST_I", 1);
      break;

    case level >= 4 && level <= 5:
      await incrementDiscount(factionId, 1);
      break;

    case level >= 6 && level <= 9:
      await giveConsumableToAllMembers(factionId, "FACTION_CHEST_I", 1);
      break;

    case level === 10:
      await incrementTickets(factionId, "championTickets", 1);
      break;

    case level >= 11 && level <= 13:
      await incrementDiscount(factionId, 1);
      break;

    case level === 14:
      await giveConsumableToAllMembers(factionId, "TITLE_TOKEN_RARE", 1);
      break;

    case level === 15:
      await incrementTickets(factionId, "duelTickets", 1);
      break;

    case level >= 16 && level <= 19:
      await giveConsumableToAllMembers(factionId, "FACTION_CHEST_I", 2);
      break;

    case level === 20:
      await incrementTickets(factionId, "championTickets", 1);
      break;

    case level >= 21 && level <= 22:
      await giveConsumableToAllMembers(factionId, "FACTION_CHEST_I", 2);
      break;

    case level === 23:
      await incrementDiscount(factionId, 1);
      break;

    case level === 24:
      await giveConsumableToAllMembers(factionId, "TITLE_TOKEN_EPIC", 1);
      break;

    case level === 25:
      await incrementTickets(factionId, "duelTickets", 1);
      break;

    case level === 26:
      await giveConsumableToAllMembers(factionId, "TITLE_TOKEN_EPIC", 1);
      break;

    case level >= 27 && level <= 28:
      await incrementDiscount(factionId, 1);
      break;

    case level === 29:
      await giveConsumableToAllMembers(factionId, "FACTION_CHEST_I", 3);
      break;

    case level === 30:
      await incrementTickets(factionId, "championTickets", 1);
      break;

    default:
      break;
  }
}
