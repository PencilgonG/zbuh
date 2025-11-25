// src/bot/commands/debugFactionReport.ts
import {
  AttachmentBuilder,
  ChatInputCommandInteraction,
} from "discord.js";
import { isAdminUser } from "../../lib/admin";
import { renderMockFreljordReportPng } from "../../lib/factionReport";

export async function debugFactionReport(
  interaction: ChatInputCommandInteraction,
) {
  if (!isAdminUser(interaction.user.id)) {
    return interaction.reply({
      content: "⛔ Cette sous-commande est réservée aux admins debug.",
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const png = await renderMockFreljordReportPng();

    const file = new AttachmentBuilder(png, {
      name: "faction-freljord-report.png",
    });

    await interaction.editReply({
      content: "🧊 Rapport Freljord (debug).",
      files: [file],
    });
  } catch (err) {
    console.error("debugFactionReport error:", err);
    await interaction.editReply({
      content:
        "❌ Impossible de générer l'image du rapport de faction (voir logs).",
    });
  }
}
