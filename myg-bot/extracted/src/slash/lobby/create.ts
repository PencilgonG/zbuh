import { ChatInputCommandInteraction } from "discord.js";
import { prisma } from "../../prismat";
import { renderLobbyMessage } from "../../lobby/render";

export async function handleLobbyCreate(interaction: ChatInputCommandInteraction) {
  const name = interaction.options.getString("nom", true);
  const teams = interaction.options.getInteger("equipes", true);

  if (![2,4].includes(teams)) {
    return interaction.reply({ content: "Nombre d'équipes invalide (2 ou 4).", ephemeral: true });
  }

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
    },
  });

  const view = await renderLobbyMessage(lobby.id);
  const sent = await interaction.editReply({
    embeds: [view.embed],
    components: [view.rows[0], view.rows[1]],
  });

  // Sauvegarde du messageId
  await prisma.lobby.update({
    where: { id: lobby.id },
    data: { messageId: sent.id },
  });
}
