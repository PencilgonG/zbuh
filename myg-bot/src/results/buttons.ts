import { ButtonInteraction, GuildMember, TextChannel } from "discord.js";
import { prisma } from "../prisma";
import { env } from "../env";

function isRespoOrCreator(member: GuildMember | null, lobbyCreatorId: string): boolean {
  if (!member) return false;
  if (member.id === lobbyCreatorId) return true;
  return member.roles.cache?.has(env.ROLE_RESPO_ID) ?? false;
}

export async function handleResultButton(inter: ButtonInteraction) {
  const id = inter.customId;

  // RESULT:WIN:<matchId>:<teamId> (✅ RESPO ONLY)
  if (id.startsWith("RESULT:WIN:")) {
    await inter.deferUpdate();
    const [, , matchId, winnerTeamId] = id.split(":");

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: { lobby: true },
    });
    if (!match) return;

    const member = inter.member as GuildMember | null;
    if (!isRespoOrCreator(member, match.lobby.createdBy)) {
      await inter.followUp({ content: "❌ Réservé aux responsables.", ephemeral: true });
      return;
    }

    await prisma.match.update({
      where: { id: matchId },
      data: { winnerTeamId, state: "FINISHED" },
    });

    await inter.followUp({ content: "✅ Résultat enregistré.", ephemeral: true });
    return;
  }

  // RESULT:FINALIZE:<lobbyId> (✅ RESPO ONLY + auto-clean)
  if (id.startsWith("RESULT:FINALIZE:")) {
    await inter.deferReply({ ephemeral: true });
    const lobbyId = id.split(":")[2];

    const lobby = await prisma.lobby.findUnique({
      where: { id: lobbyId },
      include: {
        teamsList: { include: { members: { include: { participant: true } } } },
        matches: true,
      },
    });
    if (!lobby) return;

    const member = inter.member as GuildMember | null;
    if (!isRespoOrCreator(member, lobby.createdBy)) {
      await inter.followUp({ content: "❌ Réservé aux responsables.", ephemeral: true });
      return;
    }

    if (lobby.matches.some((m) => !m.winnerTeamId)) {
      await inter.followUp({ content: "❌ Tous les vainqueurs ne sont pas définis.", ephemeral: true });
      return;
    }

    // Points + MatchResult
    for (const m of lobby.matches) {
      const winnerId = m.winnerTeamId!;
      const loserId = m.teamAId === winnerId ? m.teamBId : m.teamAId;

      const winner = lobby.teamsList.find((t) => t.id === winnerId)!;
      const loser = lobby.teamsList.find((t) => t.id === loserId)!;

      for (const mem of winner.members) {
        const did = mem.participant.discordId;
        if (did) {
          await prisma.pointsLedger.create({
            data: { discordId: did, matchId: m.id, points: 3, reason: "win" },
          });
        }
      }
      for (const mem of loser.members) {
        const did = mem.participant.discordId;
        if (did) {
          await prisma.pointsLedger.create({
            data: { discordId: did, matchId: m.id, points: 1, reason: "loss" },
          });
        }
      }

      await prisma.matchResult.upsert({
        where: { matchId: m.id },
        update: { winnerId, loserId },
        create: { matchId: m.id, winnerId, loserId },
      });
    }

    // Supprime le message de l’interaction
    if ("deletable" in inter.message && inter.message.deletable) {
      await inter.message.delete().catch(() => {});
    }

    // Balayage de sécurité (supprime tout autre panneau Résultats)
    const resCh = await inter.client.channels.fetch(env.RESULT_CHANNEL_ID).catch(() => null);
    if (resCh && resCh.isTextBased?.()) {
      const channel = resCh as TextChannel;
      const msgs = await channel.messages.fetch({ limit: 100 }).catch(() => null);
      if (msgs) {
        for (const [, msg] of msgs) {
          if (msg.author?.id !== inter.client.user?.id) continue;
          const hasResultControls = (msg.components ?? []).some((row) =>
            row.components.some((c) => "customId" in c && typeof c.customId === "string" && c.customId.startsWith("RESULT:"))
          );
          if (hasResultControls) {
            await msg.delete().catch(() => {});
          }
        }
      }
    }

    await inter.followUp({
      content: "✅ Résultats validés, points enregistrés et panneau supprimé.",
      ephemeral: true,
    });
    return;
  }
}
