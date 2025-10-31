import { ChatInputCommandInteraction, EmbedBuilder, userMention } from "discord.js";
import { prisma } from "../../prisma";
import { mygEmbedBase } from "../../utils/embeds";

export async function handleProfilView(interaction: ChatInputCommandInteraction) {
  const target = interaction.options.getUser("user") ?? interaction.user;

  await interaction.deferReply({ ephemeral: false });

  const profile = await prisma.userProfile.findUnique({
    where: { discordId: target.id },
  });

  if (!profile) {
    await interaction.editReply({
      content: `Aucun profil trouvé pour ${userMention(target.id)}. Utilise \`/profil set\`.`,
    });
    return;
  }

  // 🧮 Récupère le total de points dans la table pointsLedger
  const totalPoints = await prisma.pointsLedger.aggregate({
    where: { discordId: target.id },
    _sum: { points: true },
  });
  const pts = totalPoints._sum.points ?? 0;

  const fields = [
    { name: "Pseudo LoL", value: profile.summonerName ?? "—", inline: true },
    { name: "Élo", value: (profile.elo as string) ?? "—", inline: true },
    {
      name: "Rôles",
      value: `Main: ${profile.mainRole ?? "—"} | Sec: ${profile.secondaryRole ?? "—"}`,
      inline: true,
    },
    { name: "OP.GG", value: profile.opggUrl ? `[Lien](${profile.opggUrl})` : "—", inline: true },
    { name: "DPM", value: profile.dpmUrl ? `[Lien](${profile.dpmUrl})` : "—", inline: true },
    { name: "Points MYG", value: `**${pts}**`, inline: true }, // 🟢 Nouveau champ
  ];

  const embed = new EmbedBuilder(
    mygEmbedBase({
      title: `Profil de ${target.username}`,
      fields,
      thumbnail: { url: target.displayAvatarURL() },
    })
  );

  await interaction.editReply({ embeds: [embed] });
}
