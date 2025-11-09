// src/services/faction/contributions.ts
import { prisma } from "../../prismat";

/**
 * Crédite une contribution liée à la faction d’un joueur.
 * Actuel: le schéma utilise `userProfile.factionId` (pas de FactionMember).
 *
 * - Si le joueur appartient à une faction -> incrémente Faction.totalPoints.
 * - No-op si points <= 0, si pas de profil ou pas de faction.
 *
 * NOTE: Quand on ajoutera le modèle FactionMember + contributionPts,
 * on étendra ici pour incrémenter aussi la contribution individuelle.
 */
export async function applyContribution(discordId: string, points: number) {
  if (points <= 0) return;

  const profile = await prisma.userProfile.findUnique({
    where: { discordId },
    select: { factionId: true },
  });

  if (!profile?.factionId) return;

  await prisma.faction.update({
    where: { id: profile.factionId },
    data: { totalPoints: { increment: points } },
  });
}
