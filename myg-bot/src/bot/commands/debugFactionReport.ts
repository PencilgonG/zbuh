// src/bot/commands/debugFactionReport.ts
import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { isAdminUser } from "../../lib/admin";

export const data = new SlashCommandBuilder()
  .setName("debug")
  .setDescription("Outils de debug (admin only)")
  .addSubcommand((sub) =>
    sub
      .setName("faction-report")
      .setDescription("Génère un rapport Freljord factice (debug)"),
  );

/**
 * Handler principal de /debug
 */
export async function execute(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand();

  // ✅ Vérif admin par ID
  if (!isAdminUser(interaction.user.id)) {
    return interaction.reply({
      content: "⛔ Cette commande est réservée aux **admins** MYG.",
      ephemeral: true,
    });
  }

  if (sub === "faction-report") {
    // Pour l’instant : simple message de test
    return interaction.reply({
      content:
        "✅ Debug OK : `/debug faction-report` est bien limité aux admins (squelette).",
      ephemeral: true,
    });
  }

  return interaction.reply({
    content: "Sous-commande inconnue.",
    ephemeral: true,
  });
}
