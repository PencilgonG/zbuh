// src/vote/handlers.ts
import {
  StringSelectMenuInteraction,
  ButtonInteraction,
  GuildMember,
  EmbedBuilder,
  TextChannel,
} from "discord.js";
import { prisma } from "../prismat";
import { env } from "../env";
import { MVP_POINTS } from "../results/points";
import { upsertMvpPanel } from "./panel";
import { applyContribution } from "../services/faction/contributions";

function hasRespo(member: GuildMember | null) {
  return !!member?.roles.cache?.has(env.ROLE_RESPO_ID);
}

/**
 * Un participant du lobby peut voter pour 1 joueur de la team affichée.
 * Le vote est upsert: re-cliquer remplace son vote.
 */
export async function handleMvpSelect(inter: StringSelectMenuInteraction) {
  const id = inter.customId;
  if (!id.startsWith("VOTE:MVP:")) return;

  const [, , lobbyId, teamId] = id.split(":");
  const voter = inter.user.id;
  const voted = inter.values[0];

  // 🔒 Seuls les participants du lobby peuvent voter
  const lobby = await prisma.lobby.findUnique({
    where: { id: lobbyId },
    include: { participants: true },
  });
  if (!lobby) return;

  const isParticipant = lobby.participants.some((p) => p.discordId === voter);
  if (!isParticipant) {
    await inter.reply({ content: "🔒 Seuls les participants peuvent voter.", ephemeral: true });
    return;
  }

  await inter.deferReply({ ephemeral: true });

  // Associe les votes au premier match du lobby (clé fonctionnelle pour le tally)
  const match = await prisma.match.findFirst({
    where: { lobbyId },
    orderBy: { round: "asc" },
  });
  if (!match) {
    await inter.followUp({ content: "⚠️ Aucun match trouvé pour ce lobby.", ephemeral: true });
    return;
  }

  await prisma.mvpVote.upsert({
    where: {
      matchId_teamId_voterDiscordId: { matchId: match.id, teamId, voterDiscordId: voter },
    },
    update: { votedDiscordId: voted },
    create: {
      lobbyId,
      matchId: match.id,
      teamId,
      voterDiscordId: voter,
      votedDiscordId: voted,
    },
  });

  // Rafraîchir le panneau (affichage live des votes)
  await upsertMvpPanel(inter.client, lobbyId);

  await inter.followUp({ content: "🗳️ Vote enregistré.", ephemeral: true });
}

/**
 * Clôture des votes — respo only
 * - calcule et crédite les points MVP
 * - désactive / nettoie les panneaux de vote
 * - publie un classement consolidé dans #résultats
 */
export async function handleMvpLock(inter: ButtonInteraction) {
  const id = inter.customId;
  if (!id.startsWith("VOTE:LOCK:")) return;

  const gm = inter.member as GuildMember | null;
  if (!hasRespo(gm)) {
    await inter.reply({ content: "🔒 Action réservée aux responsables.", ephemeral: true });
    return;
  }

  await inter.deferReply({ ephemeral: true });
  const lobbyId = id.split(":")[2];

  const lobby = await prisma.lobby.findUnique({
    where: { id: lobbyId },
    include: { teamsList: { include: { members: { include: { participant: true } } } } },
  });
  if (!lobby) return;

  const firstMatch = await prisma.match.findFirst({
    where: { lobbyId },
    orderBy: { round: "asc" },
  });
  if (!firstMatch) {
    await inter.followUp({ content: "⚠️ Aucun match trouvé pour ce lobby.", ephemeral: true });
    return;
  }

  // ===== Préparer double points MVP sur CE lobby =====
  const allDiscordIds = new Set<string>();
  for (const t of lobby.teamsList) for (const m of t.members) if (m.participant.discordId) allDiscordIds.add(m.participant.discordId);
  const ids = Array.from(allDiscordIds);

  const alreadyMarked = ids.length
    ? await prisma.pointsLedger.findMany({
        where: { discordId: { in: ids }, reason: `double_points_applied:${lobbyId}` },
        select: { discordId: true },
      })
    : [];
  const alreadySet = new Set(alreadyMarked.map((r) => r.discordId));

  const pendingDouble = ids.length
    ? await prisma.pendingEffect.findMany({
        where: { userId: { in: ids }, type: "DOUBLE_POINTS_TOKEN", consumedAt: null },
        select: { id: true, userId: true },
      })
    : [];

  // Utilisateurs pour lesquels on doit doubler les MVP
  const toDouble = new Set<string>([...alreadySet, ...pendingDouble.map((p) => p.userId)]);

  // Consommer les tokens et poser le marqueur si besoin
  await prisma.$transaction(async (tx) => {
    if (pendingDouble.length) {
      await tx.pendingEffect.updateMany({
        where: { id: { in: pendingDouble.map((p) => p.id) } },
        data: { consumedAt: new Date() },
      });
    }
    for (const userId of toDouble) {
      const exists = await tx.pointsLedger.findFirst({
        where: { discordId: userId, reason: `double_points_applied:${lobbyId}` },
      });
      if (!exists) {
        await tx.pointsLedger.create({
          data: { discordId: userId, matchId: firstMatch.id, points: 0, reason: `double_points_applied:${lobbyId}` },
        });
      }
    }
  });

  // 🧮 Calcul des points MVP par équipe
  for (const team of lobby.teamsList) {
    const votes = await prisma.mvpVote.findMany({
      where: { lobbyId, teamId: team.id },
    });

    const tally = new Map<string, number>();
    for (const v of votes) {
      if (!v.votedDiscordId) continue;
      tally.set(v.votedDiscordId, (tally.get(v.votedDiscordId) ?? 0) + 1);
    }

    const ranking = [...tally.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MVP_POINTS.length);

    // Crédite: ignore les faux joueurs (ids "fake:*")
    for (let i = 0; i < ranking.length; i++) {
      const discordId = ranking[i][0];
      if (!discordId || discordId.startsWith("fake:")) continue;

      const base = MVP_POINTS[i];
      const factor = toDouble.has(discordId) ? 2 : 1;
      const pts = base * factor;

      await prisma.pointsLedger.create({
        data: {
          discordId,
          matchId: firstMatch.id,
          points: pts,
          reason: `mvp_rank_${i + 1}`,
        },
      });

      await applyContribution(discordId, pts);
    }
  }

  // 🔒 Désactive le panneau MVP (désactive les composants)
  await upsertMvpPanel(inter.client, lobbyId, true);

  // 🧹 Nettoyage de sécurité: supprime tout panneau VOTE restant dans le salon vote
  const voteCh = await inter.client.channels.fetch(env.VOTE_CHANNEL_ID).catch(() => null);
  if (voteCh && (voteCh as any).isTextBased?.()) {
    const msgs = await (voteCh as TextChannel).messages.fetch({ limit: 100 }).catch(() => null);
    if (msgs) {
      for (const [, msg] of msgs) {
        if (msg.author?.id !== inter.client.user?.id) continue;
        const hasVoteControls = (msg.components ?? []).some((row) =>
          row.components.some(
            (c) => "customId" in c && typeof c.customId === "string" && (c.customId.startsWith("VOTE:") || c.customId.startsWith("MVP:")),
          ),
        );
        if (hasVoteControls) {
          await msg.delete().catch(() => {});
        }
      }
    }
  }

  // 🏆 Classement consolidé (points de tous les matches du lobby)
  const matchIds = (
    await prisma.match.findMany({ where: { lobbyId }, select: { id: true } })
  ).map((m) => m.id);

  const allPoints = await prisma.pointsLedger.groupBy({
    by: ["discordId"],
    where: { matchId: { in: matchIds } },
    _sum: { points: true },
  });

  const lines = allPoints
    .sort((a, b) => (b._sum.points ?? 0) - (a._sum.points ?? 0))
    .map((r, i) => `**${i + 1}.** <@${r.discordId}> — **${r._sum.points ?? 0} pts**`)
    .slice(0, 20);

  const embed = new EmbedBuilder()
    .setTitle(`Classement — ${lobby.name}`)
    .setDescription(lines.join("\n") || "_Aucun point_");

  const resCh = await inter.client.channels.fetch(env.RESULT_CHANNEL_ID).catch(() => null);
  if (resCh && (resCh as any).isTextBased?.()) {
    await (resCh as TextChannel).send({ embeds: [embed] }).catch(() => {});
  }

  await inter.followUp({
    content: "✅ Votes clôturés, points attribués (avec doubles si applicable), panneaux nettoyés et classement publié.",
    ephemeral: true,
  });
}
