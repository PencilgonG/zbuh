import { prisma } from "@/lib/prisma";

export async function applyContribution(discordId: string, points: number) {
  if (points <= 0) return;

  const member = await prisma.factionMember.findUnique({
    where: { userId: discordId },
  });
  if (!member) return;

  await prisma.$transaction([
    prisma.factionMember.update({
      where: { id: member.id },
      data: { contributionPts: { increment: points } },
    }),
    prisma.faction.update({
      where: { id: member.factionId },
      data: { totalPoints: { increment: points } },
    }),
  ]);
}
