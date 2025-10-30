import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from "discord.js";
import { prisma } from "../../../db.js";
import { config } from "dotenv";

config();

/**
 * /profile set — crée ou met à jour le profil MYG d’un joueur
 */
export const data = new SlashCommandBuilder()
  .setName("profile")
  .setDescription("Gère ton profil League of Legends")
  .addSubcommand((sub) =>
    sub
      .setName("set")
      .setDescription("Crée ou modifie ton profil MYG")

      // === Obligatoires (DOIVENT être listées avant les facultatives) ===
      .addStringOption((o) =>
        o
          .setName("lolname")
          .setDescription("Ton pseudo complet LoL (ex: Aram Fétichiste#Gang)")
          .setRequired(true)
      )
      .addStringOption((o) =>
        o
          .setName("mainrole")
          .setDescription("Ton rôle principal")
          .addChoices(
            { name: "Top", value: "Top" },
            { name: "Jungle", value: "Jungle" },
            { name: "Mid", value: "Mid" },
            { name: "ADC", value: "ADC" },
            { name: "Support", value: "Support" }
          )
          .setRequired(true)
      )
      .addStringOption((o) =>
        o
          .setName("elo")
          .setDescription("Ton elo (ex: Emerald 2)")
          .setRequired(true)
      )
      .addStringOption((o) =>
        o
          .setName("opgg")
          .setDescription("Lien vers ton profil OP.GG")
          .setRequired(true)
      )
      .addStringOption((o) =>
        o
          .setName("dpm")
          .setDescription("Lien vers ton profil DPM.LOL")
          .setRequired(true)
      )

      // === Facultative ===
      .addStringOption((o) =>
        o
          .setName("secondaryrole")
          .setDescription("Ton rôle secondaire")
          .addChoices(
            { name: "Top", value: "Top" },
            { name: "Jungle", value: "Jungle" },
            { name: "Mid", value: "Mid" },
            { name: "ADC", value: "ADC" },
            { name: "Support", value: "Support" },
            { name: "Aucun", value: "None" }
          )
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand();
  if (sub !== "set") return;

  const discordId = interaction.user.id;
  const username = interaction.user.username;

  const lolName = interaction.options.getString("lolname", true);
  const mainRole = interaction.options.getString("mainrole", true);
  const secondaryRole =
    interaction.options.getString("secondaryrole") || "None";
  const elo = interaction.options.getString("elo", true);
  const opgg = interaction.options.getString("opgg", true);
  const dpm = interaction.options.getString("dpm", true);

  // Enregistrement dans la base Neon (via Prisma)
  await prisma.userProfile.upsert({
    where: { discordId },
    update: {
      lolName,
      mainRole,
      secondaryRole,
      elo,
      opggLink: opgg,
      dpmLink: dpm,
    },
    create: {
      discordId,
      username,
      lolName,
      mainRole,
      secondaryRole,
      elo,
      opggLink: opgg,
      dpmLink: dpm,
    },
  });

  // Création de l’embed de confirmation
  const embed = new EmbedBuilder()
    .setTitle("✅ Profil mis à jour")
    .setColor("#00FFB3")
    .setThumbnail(interaction.user.displayAvatarURL())
    .setDescription(`Ton profil a bien été enregistré dans la base MYG.`)
    .addFields(
      { name: "Pseudo LoL", value: lolName, inline: true },
      { name: "Rôle principal", value: mainRole, inline: true },
      { name: "Rôle secondaire", value: secondaryRole, inline: true },
      { name: "Elo", value: elo, inline: true },
      { name: "OP.GG", value: opgg, inline: false },
      { name: "DPM", value: dpm, inline: false }
    )
    .setFooter({ text: "MYG Database", iconURL: process.env.LOGO_URL! });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
