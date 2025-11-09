import { ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { prisma } from "../prismat";
import { mygEmbedBase } from "../utils/embeds";

/**
 * /leaderboard
 * Affiche le classement global des points MYG, avec :
 * - Pseudo cliquable (lien OP.GG s’il existe)
 * - Titre actif affiché après le pseudo  →  Pseudo [*Titre*]
 * - Tri décroissant par total de points
 */
export async function handleLeaderboard(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  // 1) Récupération des points groupés par utilisateur
  const totals = await prisma.pointsLedger.groupBy({
    by: ["discordId"],
    _sum: { points: true },
  });

  // Filtre les discordId valides et trie par points DESC
  const rows = totals
    .map((r) => ({ discordId: r.discordId, points: r._sum.points ?? 0 }))
    .filter((r) => !!r.discordId)
    .sort((a, b) => b.points - a.points);

  if (rows.length === 0) {
    return interaction.editReply({
      content: "Aucune donnée de classement pour le moment.",
    });
  }

  const ids = rows.map((r) => r.discordId!) as string[];

  // 2) Récupération des profils (pour les pseudos, liens OP.GG, titres actifs)
  const profiles = await prisma.userProfile.findMany({
    where: { discordId: { in: ids } },
    include: { activeTitle: true },
  });
  const profById = new Map(profiles.map((p) => [p.discordId, p]));

  // 3) Construction des lignes affichées
  const lines = rows.map((r, idx) => {
    const p = profById.get(r.discordId!);
    const display = p?.summonerName || r.discordId!.slice(0, 6); // fallback court si pas de profil
    const title = p?.activeTitle?.name;

    // on ne met le lien que sur le pseudo
    const nameLinked = p?.opggUrl ? `[${display}](${p.opggUrl})` : display;
    const withTitle = title ? `${nameLinked} [*${title}*]` : nameLinked;

    const rank = `**${idx + 1}.**`.padEnd(5, " ");
    return `${rank} ${withTitle} — **${r.points}** pts`;
  });

  // 4) Embed
  const embed = new EmbedBuilder(
    mygEmbedBase({
      title: "Leaderboard — Points MYG",
      description: lines.join("\n"),
      footer: { text: "Les points sont cumulés depuis l’historique de la PointsLedger." },
    }),
  );

  await interaction.editReply({ embeds: [embed] });
}
