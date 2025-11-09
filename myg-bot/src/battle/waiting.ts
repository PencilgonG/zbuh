// src/battle/waiting.ts
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Guild,
  TextChannel,
} from "discord.js";
import { prisma } from "../prismat";
import { mygEmbedBase } from "../utils/embeds";

/** Rendu/refresh du message d'attente Battle Royale dans le channel du lobby */
export async function renderBattleWaitingMessage(guild: Guild, lobbyId: string) {
  const lobby = await prisma.lobby.findUnique({
    where: { id: lobbyId },
    include: { participants: true },
  });
  if (!lobby) return;

  const ch = await guild.channels.fetch(lobby.channelId).catch(() => null);
  if (!ch || !("isTextBased" in ch) || !ch.isTextBased()) return;

  const t = ch as TextChannel;

  // Liste lisible des inscrits (mentions si possible)
  const names = lobby.participants
    .filter((p) => !p.isFake)
    .map((p) => (p.discordId ? `<@${p.discordId}>` : p.display));

  const maxField = 1024;
  let fieldValue =
    names.length > 0 ? names.join("\n") : "_Aucun joueur inscrit pour l’instant._";
  if (fieldValue.length > maxField) {
    // compactage si trop long
    fieldValue =
      names.slice(0, 30).join("\n") +
      `\n… (+${names.length - 30} joueurs supplémentaires)`;
  }

  const embed = new EmbedBuilder(
    mygEmbedBase({
      title: `Battle Royale — ${lobby.name}`,
      description:
        "Inscrivez-vous avec le bouton ci-dessous.\nAucun rôle, aucun cap. Le staff peut lancer le Round 1.",
      footer: { text: "MYG Inhouses" },
    }),
  ).addFields({
    name: `Inscrits (${names.length})`,
    value: fieldValue,
  });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`BR:JOIN:${lobby.id}`)
      .setLabel("S’inscrire / Se désinscrire")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`BR:TESTFILL:${lobby.id}`)
      .setLabel("Test (20 joueurs)")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`BR:VALIDATE:${lobby.id}`)
      .setLabel("Valider (lancer Round 1)")
      .setStyle(ButtonStyle.Success),
  );

  // Message existant ou création si manquant
  let msg = null as any;
  if (lobby.messageId) {
    msg = await t.messages.fetch(lobby.messageId).catch(() => null);
  }
  if (!msg) {
    const created = await t.send({ embeds: [embed], components: [row] });
    await prisma.lobby.update({
      where: { id: lobby.id },
      data: { messageId: created.id },
    });
  } else {
    await msg.edit({ embeds: [embed], components: [row] }).catch(() => {});
  }
}
