// src/slash/debug.ts
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from "discord.js";
import { isAdminUser } from "../lib/admin";

export const data = new SlashCommandBuilder()
  .setName("debug")
  .setDescription("Outils de debug MYG (réservé aux admins)")
  .addSubcommand((sub) =>
    sub
      .setName("faction-report")
      .setDescription("Génère un rapport factice de faction (test)")
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!isAdminUser(interaction.user.id)) {
    return interaction.reply({
      content: "⛔ Cette commande est réservée aux **admins MYG**.",
      ephemeral: true,
    });
  }

  const sub = interaction.options.getSubcommand();

  if (sub === "faction-report") {
    // Pour l'instant, simple placeholder.
    // À l'étape suivante on pluggera le rendu HTML -> image PNG.
    return interaction.reply({
      content:
        "✅ `/debug faction-report` fonctionne. Prochaine étape : génération de l'image Freljord.",
      ephemeral: true,
    });
  }

  return interaction.reply({
    content: "Sous-commande inconnue.",
    ephemeral: true,
  });
}
