import { ChatInputCommandInteraction } from "discord.js";
import { prisma } from "../../prismat";
import { renderLobbyMessage } from "../../lobby/render";

/**
 * NORMAL/SURPRISE uniquement ici (Battle Royale = commande séparée)
 */
export async function handleLobbyCreate(interaction: ChatInputCommandInteraction) {
  const name = interaction.options.getString("nom", true);
  const teams = interaction.options.getInteger("equipes", true);
  const mode = interaction.options.getString("mode", true) as "NORMAL" | "SURPRISE" | "BATTLE_ROYALE";

  if (mode === "BATTLE_ROYALE") {
    return interaction.reply({
      content: "⚠️ Le Battle Royale est géré par sa commande dédiée.",
      ephemeral: true,
    });
  }

  if (![2, 4].includes(teams)) {
    return interaction.reply({
      content: "Nombre d'équipes invalide (2 ou 4).",
      ephemeral: true,
    });
  }

  // On répond dans le canal (message normal), comme avant
  await interaction.deferReply();

  const lobby = await prisma.lobby.create({
    data: {
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      messageId: "pending",
      name,
      teams,
      status: "WAITING",
      createdBy: interaction.user.id,
      mode,           // ✅ NORMAL ou SURPRISE
      format: null,   // défini plus tard par le Team Builder
    },
  });

  const view = await renderLobbyMessage(lobby.id);

  // ✅ IMPORTANT : on envoie exactement les rangées retournées (0..n)
  const sent = await interaction.editReply({
    embeds: [view.embed],
    components: view.rows,
  });

  // Sauvegarde du messageId
  await prisma.lobby.update({
    where: { id: lobby.id },
    data: { messageId: (sent as any).id },
  });
}
