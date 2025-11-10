// src/lib/shop.ts
import { prisma } from "../prismat";
import type { ConsumableType, QuotaType } from "@prisma/client";

/**
 * Certains schémas imposent matchId NOT NULL (type STRING) dans PointsLedger.
 * On utilise un matchId "neutre" configurable, sinon "0".
 */
const SHOP_MATCH_ID: string = process.env.SHOP_MATCH_ID ?? "0";

/** Solde courant (somme de PointsLedger). */
export async function getBalance(userId: string): Promise<number> {
  const agg = await prisma.pointsLedger.aggregate({
    where: { discordId: userId },
    _sum: { points: true },
  });
  return agg._sum.points ?? 0;
}

/** Lève une erreur si le solde est insuffisant. */
export async function assertSufficientBalance(userId: string, cost: number) {
  const bal = await getBalance(userId);
  if (bal < cost) {
    const err = new Error(`⛔ Solde insuffisant: ${bal} pts (prix = ${cost} pts).`) as Error & {
      code?: string;
    };
    err.code = "INSUFFICIENT_POINTS";
    throw err;
  }
}

/** Débite des points (enregistre une ligne négative). */
export async function chargePoints(userId: string, amount: number, reason: string) {
  await assertSufficientBalance(userId, amount);

  await prisma.pointsLedger.create({
    data: {
      discordId: userId,
      points: -Math.abs(amount),
      reason,
      matchId: SHOP_MATCH_ID, // <-- string OK
    },
  });
}

/** Crédite des points (utile pour récompenses/admin). */
export async function addPoints(userId: string, amount: number, reason: string) {
  await prisma.pointsLedger.create({
    data: {
      discordId: userId,
      points: Math.abs(amount),
      reason,
      matchId: SHOP_MATCH_ID, // <-- string OK
    },
  });
}

/** Fenêtre temporelle pour les quotas. */
function windowStartFor(quota: QuotaType): Date {
  const now = new Date();
  if (quota.includes("WEEKLY")) now.setDate(now.getDate() - 7);
  else if (quota.includes("MONTHLY")) now.setMonth(now.getMonth() - 1);
  else now.setDate(now.getDate() - 7); // défaut weekly
  return now;
}

/**
 * Quotas via PointsLedger :
 * - on compte les lignes dont reason contient `[QUOTA:<quota>]`
 * - si < cap → on réserve avec une ligne 0 point (trace)
 *
 * Exemple d'appel:
 *   await checkAndIncrementQuota(userId, "BAN_PLUS_ONE_WEEKLY", 3, "BUY_CONSUMABLE:Ban +1")
 */
export async function checkAndIncrementQuota(
  userId: string,
  quota: QuotaType,
  cap: number,
  tag?: string,
): Promise<{ ok: boolean; used: number; cap: number }> {
  const after = windowStartFor(quota);
  const quotaMarker = `[QUOTA:${quota}]`;

  const used = await prisma.pointsLedger.count({
    where: {
      discordId: userId,
      createdAt: { gte: after },
      reason: { contains: quotaMarker },
    },
  });

  if (used >= cap) return { ok: false, used, cap };

  await prisma.pointsLedger.create({
    data: {
      discordId: userId,
      points: 0,
      reason: `${quotaMarker}${tag ? ` ${tag}` : ""}`,
      matchId: SHOP_MATCH_ID, // <-- string OK
    },
  });

  return { ok: true, used: used + 1, cap };
}

/**
 * addConsumable:
 * SANS modèle d’inventaire confirmé, on logge une ligne 0 pt
 * pour tracer l’octroi (`[CONSUMABLE:TYPE] +QTY`).
 * Si tu as une vraie table d’inventaire, je branche un upsert.
 */
export async function addConsumable(userId: string, type: ConsumableType, qty = 1) {
  await prisma.pointsLedger.create({
    data: {
      discordId: userId,
      points: 0,
      reason: `[CONSUMABLE:${type}] +${qty}`,
      matchId: SHOP_MATCH_ID, // <-- string OK
    },
  });
}
