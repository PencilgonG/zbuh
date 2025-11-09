import { prisma } from "../prismat";  // <- sans .js
import { ConsumableType, QuotaType } from "@prisma/client";

export async function getUserPoints(discordId: string) {
  const agg = await prisma.pointsLedger.aggregate({ _sum: { points: true }, where: { discordId } });
  return agg._sum.points ?? 0;
}

export async function hasInfinite(discordId: string) {
  const o = await prisma.devOverride.findUnique({ where: { userId: discordId } });
  return !!o?.infinitePoints;
}

export async function chargePoints(discordId: string, amount: number, reason: string) {
  if (amount <= 0) return;
  const infinite = await hasInfinite(discordId);
  if (infinite) {
    await prisma.pointsLedger.create({
      data: { discordId, matchId: "DEV", points: 0, reason: `DEV_OVERRIDE:${reason}` }
    });
    return;
  }
  const balance = await getUserPoints(discordId);
  if (balance < amount) throw new Error(`Solde insuffisant: ${balance} < ${amount}`);
  await prisma.pointsLedger.create({ data: { discordId, matchId: "SHOP", points: -amount, reason } });
}

export function currentWindowStart(type: QuotaType): Date {
  const d = new Date();
  if (type === "FACTION_TRANSFER_MONTHLY") {
    d.setUTCDate(1);
    d.setUTCHours(0, 0, 0, 0);
  } else {
    const day = d.getUTCDay();
    const diffToMon = (day + 6) % 7;
    d.setUTCDate(d.getUTCDate() - diffToMon);
    d.setUTCHours(0, 0, 0, 0);
  }
  return d;
}

export async function checkAndIncrementQuota(discordId: string, type: QuotaType, cap: number) {
  const windowStart = currentWindowStart(type);
  const key = { userId: discordId, type, windowStart };
  const q = await prisma.userQuota.findUnique({ where: { userId_type_windowStart: key } });
  if (!q) {
    await prisma.userQuota.create({ data: { ...key, count: 1 } });
    return { ok: true, remaining: cap - 1 };
  }
  if (q.count >= cap) return { ok: false, remaining: 0 };
  await prisma.userQuota.update({
    where: { userId_type_windowStart: key },
    data: { count: { increment: 1 } }
  });
  return { ok: true, remaining: cap - (q.count + 1) };
}

export async function addConsumable(discordId: string, type: ConsumableType, qty = 1) {
  await prisma.consumableStock.upsert({
    where: { userId_type: { userId: discordId, type } },
    update: { quantity: { increment: qty } },
    create: { userId: discordId, type, quantity: qty }
  });
}
