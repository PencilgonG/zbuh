import { ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { prisma } from "../../prismat";
import { mygEmbedBase } from "../../utils/embeds";

export async function handleProfilSet(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;

  const summonerName = interaction.options.getString("pseudo_lol", true);
  const elo = interaction.options.getString("elo", true) as any;
  const mainRole = interaction.options.getString("main_role", true) as any;
  const secondaryRole = interaction.options.getString("secondary_role", true) as any;
  const opggUrl = interaction.options.getString("opgg_url") ?? undefined;
  const dpmUrl = interaction.options.getString("dpm_url") ?? undefined;

  await interaction.deferReply({ ephemeral: true });

  const profile = await prisma.userProfile.upsert({
    where: { discordId: userId },
    update: { summonerName, elo, mainRole, secondaryRole, opggUrl, dpmUrl },
    create: { discordId: userId, summonerName, elo, mainRole, secondaryRole, opggUrl, dpmUrl },
  });

  const embed = new EmbedBuilder(
    mygEmbedBase({
      title: "Profil mis à jour",
      fields: [
        { name: "Pseudo LoL", value: profile.summonerName ?? "—", inline: true },
        { name: "Élo", value: (profile.elo as string) ?? "—", inline: true },
        {
          name: "Rôles",
          value: `Main: ${profile.mainRole ?? "—"} | Sec: ${profile.secondaryRole ?? "—"}`,
          inline: true,
        },
        { name: "OP.GG", value: profile.opggUrl ? `[Lien](${profile.opggUrl})` : "—", inline: true },
        { name: "DPM", value: profile.dpmUrl ? `[Lien](${profile.dpmUrl})` : "—", inline: true },
      ],
      thumbnail: { url: interaction.user.displayAvatarURL() },
    })
  );

  await interaction.editReply({ embeds: [embed] });
}
