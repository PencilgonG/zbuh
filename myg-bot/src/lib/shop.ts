// src/lib/shop.ts
import { prisma } from "../prismat";
import type { ConsumableType, QuotaType } from "@prisma/client";

/**
 * Certains schémas imposent matchId NOT NULL dans PointsLedger.
 * On autorise un matchId "neutre" configurable via env, sinon 0.
 */
const SHOP_MATCH_ID =
  Number(process.env.SHOP_MATCH_ID ?? "0"); // <- mets un ID de match factice si besoin

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
    const msg = `⛔ Solde insuffisant: ${bal} pts (prix = ${cost} pts).`;
    const err = new Error(msg) as Error & { code?: string };
    err.code = "INSUFFICIENT_POINTS";
    throw err;
  }
}

/**
 * Débite des points (enregistre une ligne négative).
 * NOTE: ton modèle impose "matchId": on fournit SHOP_MATCH_ID (ou 0).
 */
export async function chargePoints(
  userId: string,
  amount: number, // coût positif (ex: 50)
  reason: string,
) {
  await assertSufficientBalance(userId, amount);

  await prisma.pointsLedger.create({
    data: {
      discordId: userId,
      points: -Math.abs(amount),
      reason,
      matchId: SHOP_MATCH_ID,
    } as any,
  });
}

/** Crédite des points (utile pour récompenses/admin). */
export async function addPoints(userId: string, amount: number, reason: string) {
  await prisma.pointsLedger.create({
    data: {
      discordId: userId,
      points: Math.abs(amount),
      reason,
      matchId: SHOP_MATCH_ID,
    } as any,
  });
}

/**
 * Quotas sans nouvelle table :
 * on compte dans PointsLedger les achats dont le reason contient un tag stable,
 * sur une fenêtre temporelle glissante (7j pour WEEKLY, 30j pour MONTHLY).
 *
 * Convention:
 *  - pour les consommables: reason = `BUY_CONSUMABLE:<label>`
 *  - on filtre par `contains: tag`
 */
function windowStartFor(quota: QuotaType): Date {
  const now = new Date();
  if (quota.includes("WEEKLY")) {
    now.setDate(now.getDate() - 7);
  } else if (quota.includes("MONTHLY")) {
    now.setMonth(now.getMonth() - 1);
  } else {
    now.setDate(now.getDate() - 7); // défaut weekly
  }
  return now;
}

/**
 * checkAndIncrementQuota:
 *  - compte les entrées PointsLedger avec reason contenant `[QUOTA:<quota>]`
 *    ET la balise d’action fournie par l’appelant (`tag`).
 *  - si < cap -> "réserve" la place en écrivant une ligne 0 point (trace).
 *
 * Pour l’appeler proprement depuis la boutique:
 *   await checkAndIncrementQuota(userId, "BAN_PLUS_ONE_WEEKLY", 3, "BUY_CONSUMABLE:Ban +1");
 */
export async function checkAndIncrementQuota(
  userId: string,
  quota: QuotaType,
  cap: number,
  tag?: string, // ex: "BUY_CONSUMABLE:Ban +1"
): Promise<{ ok: boolean; used: number; cap: number }> {
  const after = windowStartFor(quota);
  const quotaMarker = `[QUOTA:${quota}]`;

  const used = await prisma.pointsLedger.count({
    where: {
      discordId: userId,
      createdAt: { gte: after },
      reason: {
        contains: quotaMarker,
      },
    },
  });

  if (used >= cap) return { ok: false, used, cap };

  // On "consomme" le quota par une ligne 0 point
  await prisma.pointsLedger.create({
    data: {
      discordId: userId,
      points: 0,
      reason: `${quotaMarker}${tag ? ` ${tag}` : ""}`,
      matchId: SHOP_MATCH_ID,
    } as any,
  });

  return { ok: true, used: used + 1, cap };
}

/**
 * addConsumable:
 * SANS modèle d’inventaire confirmé, on logge une ligne 0 pt
 * pour tracer l’octroi (`[CONSUME:TYPE]`). Dis-moi la vraie table
 * (nom + colonnes), je branche un upsert persistant immédiatement.
 */
export async function addConsumable(
  userId: string,
  type: ConsumableType,
  qty = 1,
) {
  await prisma.pointsLedger.create({
    data: {
      discordId: userId,
      points: 0,
      reason: `[CONSUMABLE:${type}] +${qty}`,
      matchId: SHOP_MATCH_ID,
    } as any,
  });
}
