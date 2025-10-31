import { ButtonInteraction, GuildMember, ActionRowBuilder } from "discord.js";
import { prisma } from "../prisma";
import { env } from "../env";
import { parseLobbyCustomId } from "./ids";
import { roleCap } from "./state";
import { renderLobbyMessage } from "./render";

// Vérifie le rôle respo proprement
function hasRespoRole(inter: ButtonInteraction): boolean {
  const m = inter.member;
  if (!m) return false;
  const gm = m as GuildMember;
  return gm.roles?.cache?.has?.(env.ROLE_RESPO_ID) ?? false;
}

export async function handleLobbyButton(interaction: ButtonInteraction) {
  const parsed = parseLobbyCustomId(interaction.customId);
  if (!parsed) return;

  // on va éditer le message d'origine
  await interaction.deferUpdate();

  const lobby = await prisma.lobby.findUnique({ where: { id: parsed.lobbyId } });
  if (!lobby) return;

  // Pendant BUILDER/CLOSED, on bloque tout sauf VALIDATE (qui ne sert plus de toute façon)
  if (lobby.status !== "WAITING" && parsed.kind !== "VALIDATE") {
    return;
  }

  if (parsed.kind === "JOIN") {
    const role = parsed.role;
    const userId = interaction.user.id;

    await prisma.$transaction(async (tx) => {
      // déjà inscrit ?
      const existing = await tx.lobbyParticipant.findFirst({
        where: { lobbyId: lobby.id, discordId: userId },
      });
      if (existing) return;

      // cap
      const cap = roleCap(lobby.teams, role);
      const count = await tx.lobbyParticipant.count({
        where: { lobbyId: lobby.id, role },
      });
      if (count >= cap) return;

      await tx.lobbyParticipant.create({
        data: {
          lobbyId: lobby.id,
          discordId: userId,
          display: interaction.user.username,
          role,
          isFake: false,
        },
      });
    });

  } else if (parsed.kind === "QUIT") {
    const userId = interaction.user.id;
    await prisma.lobbyParticipant.deleteMany({
      where: { lobbyId: lobby.id, discordId: userId },
    });

  } else if (parsed.kind === "TEST") {
    // Only creator or respo
    const allowed = interaction.user.id === lobby.createdBy || hasRespoRole(interaction);
    if (!allowed) return;

    const roles: Array<"TOP" | "JGL" | "MID" | "ADC" | "SUPP"> = ["TOP", "JGL", "MID", "ADC", "SUPP"];
    for (const r of roles) {
      const cap = roleCap(lobby.teams, r);
      const current = await prisma.lobbyParticipant.count({ where: { lobbyId: lobby.id, role: r } });
      const missing = Math.max(0, cap - current);
      if (missing > 0) {
        await prisma.lobbyParticipant.createMany({
          data: Array.from({ length: missing }, (_, i) => ({
            lobbyId: lobby.id,
            discordId: null,
            display: `Test${r}${i + 1}`,
            role: r,
            isFake: true,
          })),
        });
      }
    }

  } else if (parsed.kind === "VALIDATE") {
    // respo only
    if (!hasRespoRole(interaction)) return;

    await prisma.lobby.update({
      where: { id: lobby.id },
      data: { status: "BUILDER" },
    });

    // Geler la salle d'attente
    const view = await renderLobbyMessage(lobby.id);
    view.embed.setFooter({ text: `Statut: BUILDER • inscriptions gelées` });
    await interaction.message.edit({ embeds: [view.embed], components: [] });

    // Lancer le Team Builder
    const { launchTeamBuilder } = await import("../team/builder.js");
    // @ts-expect-error: on réutilise ButtonInteraction comme ChatInput pour followUp
    await launchTeamBuilder(lobby.id, interaction as any);
    return;
  }

  // Rafraîchir l'embed après action
  const view = await renderLobbyMessage(lobby.id);
  await interaction.message.edit({ embeds: [view.embed], components: [view.rows[0], view.rows[1]] });
}
