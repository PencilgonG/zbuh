// src/results/buttons.ts
import { ButtonInteraction, GuildMember, TextChannel } from "discord.js";
import { prisma } from "../prismat";
import { env } from "../env";
import { applyContribution } from "../services/faction/contributions";

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

    // ===== Double points — préparer la liste des utilisateurs concernés sur CE lobby =====
    // On marque le lobby comme "double appliqué" via un entry PointsLedger 0pt pour éviter double application (MVP).
    const allDiscordIds = new Set<string>();
    for (const t of lobby.teamsList) {
      for (const m of t.members) if (m.participant.discordId) allDiscordIds.add(m.participant.discordId);
    }
    const ids = Array.from(allDiscordIds);

    // Cherche tokens non consommés
    const pendingDouble = ids.length
      ? await prisma.pendingEffect.findMany({
          where: { userId: { in: ids }, type: "DOUBLE_POINTS_TOKEN", consumedAt: null },
          select: { id: true, userId: true },
        })
      : [];

    const alreadyMarked = ids.length
      ? await prisma.pointsLedger.findMany({
          where: {
            discordId: { in: ids },
            reason: `double_points_applied:${lobbyId}`,
          },
          select: { discordId: true },
        })
      : [];
    const alreadySet = new Set(alreadyMarked.map((r) => r.discordId));

    // Users à doubler pour CE lobby (soit possèdent token non consommé, soit déjà marqué par MVP)
    const alsoMarkedByMvp = ids.length
      ? await prisma.pointsLedger.findMany({
          where: {
            discordId: { in: ids },
            reason: `double_points_applied:${lobbyId}`,
          },
          select: { discordId: true },
        })
      : [];
    for (const r of alsoMarkedByMvp) alreadySet.add(r.discordId);

    const toDouble = new Set<string>([...pendingDouble.map((p) => p.userId), ...alreadySet]);

    // Consommer les tokens et poser le marqueur si pas déjà marqué
    await prisma.$transaction(async (tx) => {
      // Consommer tous les tokens non consommés
      await tx.pendingEffect.updateMany({
        where: { id: { in: pendingDouble.map((p) => p.id) } },
        data: { consumedAt: new Date() },
      });

      // Marqueurs
      for (const userId of toDouble) {
        const exists = await tx.pointsLedger.findFirst({
          where: { discordId: userId, reason: `double_points_applied:${lobbyId}` },
        });
        if (!exists) {
          await tx.pointsLedger.create({
            data: { discordId: userId, matchId: lobby.matches[0].id, points: 0, reason: `double_points_applied:${lobbyId}` },
          });
        }
      }
    });

    // Points + MatchResult (+ contribution de faction), en doublant si nécessaire
    for (const m of lobby.matches) {
      const winnerId = m.winnerTeamId!;
      const loserId = m.teamAId === winnerId ? m.teamBId : m.teamAId;

      const winner = lobby.teamsList.find((t) => t.id === winnerId)!;
      const loser = lobby.teamsList.find((t) => t.id === loserId)!;

      for (const mem of winner.members) {
        const did = mem.participant.discordId;
        if (did) {
          const base = 3;
          const factor = toDouble.has(did) ? 2 : 1;
          const pts = base * factor;
          await prisma.pointsLedger.create({
            data: { discordId: did, matchId: m.id, points: pts, reason: "win" },
          });
          await applyContribution(did, pts);
        }
      }
      for (const mem of loser.members) {
        const did = mem.participant.discordId;
        if (did) {
          const base = 1;
          const factor = toDouble.has(did) ? 2 : 1;
          const pts = base * factor;
          await prisma.pointsLedger.create({
            data: { discordId: did, matchId: m.id, points: pts, reason: "loss" },
          });
          await applyContribution(did, pts);
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
            row.components.some((c) => "customId" in c && typeof c.customId === "string" && c.customId.startsWith("RESULT:")),
          );
          if (hasResultControls) {
            await msg.delete().catch(() => {});
          }
        }
      }
    }

    await inter.followUp({
      content: "✅ Résultats validés, points enregistrés (avec doubles si applicable) et panneau supprimé.",
      ephemeral: true,
    });
    return;
  }
}
