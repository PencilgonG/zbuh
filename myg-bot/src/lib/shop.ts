// src/lib/shop.ts
import { prisma } from "../prismat";
import type { ConsumableType, QuotaType } from "@prisma/client";

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
    const err = new Error(msg);
    // @ts-ignore
    err.code = "INSUFFICIENT_POINTS";
    throw err;
  }
}

/**
 * Débite des points (enregistre une ligne négative si nécessaire).
 * Utilise un tx si tu veux enchaîner plusieurs écritures atomiques
 * depuis l’appelant.
 */
export async function chargePoints(
  userId: string,
  amount: number, // coût positif (ex: 50)
  reason: string,
) {
  // Vérif stricte avant débit
  await assertSufficientBalance(userId, amount);

  await prisma.pointsLedger.create({
    data: {
      discordId: userId,
      points: -Math.abs(amount), // débit
      reason,
    },
  });
}

/** Crédite des points (utile pour debug ou récompenses). */
export async function addPoints(userId: string, amount: number, reason: string) {
  await prisma.pointsLedger.create({
    data: { discordId: userId, points: Math.abs(amount), reason },
  });
}

/** Quotas hebdo/mensuels : renvoie { ok, used, cap }. */
export async function checkAndIncrementQuota(
  userId: string,
  quota: QuotaType,
  cap: number,
): Promise<{ ok: boolean; used: number; cap: number }> {
  const now = new Date();

  // Fenêtre temporelle selon type de quota
  let after = new Date(now);
  if (quota.includes("WEEKLY")) {
    after.setDate(after.getDate() - 7);
  } else if (quota.includes("MONTHLY")) {
    after.setMonth(after.getMonth() - 1);
  } else {
    after.setDate(after.getDate() - 7); // fallback weekly
  }

  const used = await prisma.quotaLog.count({
    where: { discordId: userId, quota, createdAt: { gte: after } },
  });
  if (used >= cap) return { ok: false, used, cap };

  await prisma.quotaLog.create({
    data: { discordId: userId, quota },
  });
  return { ok: true, used: used + 1, cap };
}

/** Ajoute un consommable dans l’inventaire utilisateur. */
export async function addConsumable(
  userId: string,
  type: ConsumableType,
  qty = 1,
) {
  // upsert simple
  await prisma.userConsumable.upsert({
    where: { userId_type: { userId, type } },
    create: { userId, type, qty },
    update: { qty: { increment: qty } },
  });
}
