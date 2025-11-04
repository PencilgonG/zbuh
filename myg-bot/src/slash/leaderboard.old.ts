import { ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { prisma } from "../../prisma";
import { mygEmbedBase } from "../../utils/embeds";

export async function handleLeaderboard(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  // Récupère le top 20 des joueurs par total de points
  const leaderboard = await prisma.pointsLedger.groupBy({
    by: ["discordId"],
    _sum: { points: true },
    orderBy: { _sum: { points: "desc" } },
    take: 20,
  });

  if (leaderboard.length === 0) {
    await interaction.editReply("Aucun point enregistré pour le moment.");
    return;
  }

  // Récupération des pseudos via UserProfile
  const ids = leaderboard.map(l => l.discordId);
  const profiles = await prisma.userProfile.findMany({
    where: { discordId: { in: ids } },
    select: { discordId: true, summonerName: true },
  });

  const fields = leaderboard.map((l, i) => {
    const profile = profiles.find(p => p.discordId === l.discordId);
    const name = profile?.summonerName ?? `Joueur ${i + 1}`;
    const pts = l._sum.points ?? 0;
    return {
      name: `#${i + 1} — ${name}`,
      value: `**${pts} pts**`,
      inline: false,
    };
  });

  const embed = new EmbedBuilder(
    mygEmbedBase({
      title: "🏆 Classement MYG — Top 20",
      description: "Classement global basé sur les points cumulés.",
      fields,
      image: { url: process.env.BANNER_URL },
    })
  );

  await interaction.editReply({ embeds: [embed] });
}
