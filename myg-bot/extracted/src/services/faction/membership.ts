import { prisma } from "@/lib/prisma";

export async function getMember(discordId: string) {
  return prisma.factionMember.findUnique({
    where: { userId: discordId },
    include: { faction: true },
  });
}

export async function ensureInitialJoin(discordId: string, factionId: string) {
  const existing = await getMember(discordId);
  if (existing) return existing;
  return prisma.factionMember.create({
    data: { userId: discordId, factionId },
  });
}

export async function setMemberFaction(discordId: string, factionId: string) {
  return prisma.factionMember.upsert({
    where: { userId: discordId },
    update: { factionId, joinedAt: new Date() },
    create: { userId: discordId, factionId },
  });
}
