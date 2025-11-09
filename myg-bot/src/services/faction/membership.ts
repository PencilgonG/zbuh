// src/services/faction/membership.ts
import { prisma } from "../../prismat";

/**
 * Retourne userProfile + faction (si relié).
 */
export async function getMember(discordId: string) {
  return prisma.userProfile.findUnique({
    where: { discordId },
    include: { faction: true },
  });
}

/**
 * Assigne une faction à l'utilisateur s'il n'en a pas.
 */
export async function ensureInitialJoin(discordId: string, factionId: number) {
  const profile = await prisma.userProfile.findUnique({ where: { discordId } });
  if (!profile) {
    return prisma.userProfile.create({
      data: { discordId, factionId },
    });
  }
  if (!profile.factionId) {
    return prisma.userProfile.update({
      where: { discordId },
      data: { factionId },
    });
  }
  return profile;
}

/**
 * Force le changement de faction (sans consommable ici).
 */
export async function setMemberFaction(discordId: string, factionId: number) {
  return prisma.userProfile.upsert({
    where: { discordId },
    update: { factionId },
    create: { discordId, factionId },
  });
}
