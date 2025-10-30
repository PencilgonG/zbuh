import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";
import { prisma } from "../../../db.js";
import { config } from "dotenv";

config();

/**
 * /profile view — affiche le profil d’un joueur
 */
export const data = new SlashCommandBuilder()
  .setName("profile")
  .setDescription("Affiche un profil League of Legends")
  .addSubcommand((sub) =>
    sub
      .setName("view")
      .setDescription("Voir le profil d’un joueur")
      .addUserOption((o) =>
        o
          .setName("utilisateur")
          .setDescription("Choisis le joueur à afficher")
          .setRequired(true)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand();
  if (sub !== "view") return;

  const user = interaction.options.getUser("utilisateur", true);

  // Recherche du profil dans la base Neon
  const profile = await prisma.userProfile.findUnique({
    where: { discordId: user.id },
  });

  if (!profile) {
    await interaction.reply({
      content: "❌ Ce joueur n’a pas encore créé de profil via `/profile set`.",
      ephemeral: true,
    });
    return;
  }

  // Création de l'embed
  const embed = new EmbedBuilder()
    .setColor("#00B2FF")
    .setTitle(`${profile.username} – Profil MYG`)
    .setThumbnail(user.displayAvatarURL())
    .setImage(process.env.BANNER_URL || null)
    .addFields(
      { name: "Pseudo LoL", value: profile.lolName, inline: true },
      { name: "Rôle principal", value: profile.mainRole, inline: true },
      {
        name: "Rôle secondaire",
        value: profile.secondaryRole || "Aucun",
        inline: true,
      },
      { name: "Elo", value: profile.elo, inline: true },
      {
        name: "Liens",
        value: `[OP.GG](${profile.opggLink}) | [DPM.LOL](${profile.dpmLink})`,
        inline: false,
      }
    )
    .setFooter({
      text: "MYG Database",
      iconURL: process.env.LOGO_URL || undefined,
    });

  await interaction.reply({ embeds: [embed] });
}
