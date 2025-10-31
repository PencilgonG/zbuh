import {
  Guild,
  ChannelType,
  TextChannel,
  APIActionRowComponent,
  APIMessageActionRowComponent,
} from "discord.js";
import { prisma } from "../prisma";
import { env } from "../env";
import { buildMatchEmbed, buildValidateRow } from "./embeds";
import { createDraftRoom } from "./draft";

// === utils ===
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Helper: fetch a text-based channel by ID
async function fetchTextChannel(guild: Guild, id: string) {
  const ch = await guild.channels.fetch(id).catch(() => null);
  if (!ch || !("isTextBased" in ch) || !ch.isTextBased()) return null;
  return ch as TextChannel;
}

// Cherche les channels texte des équipes créés en phase 3 (text-{teamName})
async function findTeamTextChannel(guild: Guild, teamName: string) {
  const targetName = `text-${teamName}`.toLowerCase().replace(/\s+/g, "-");
  const ch = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildText && c.name === targetName
  );
  if (!ch || !("isTextBased" in ch) || !ch.isTextBased()) return undefined;
  return ch as TextChannel;
}

// Supprime UNIQUEMENT la carte du match donné (on cherche le bouton MATCH:VALIDATE:<matchId>)
async function deleteMatchCard(guild: Guild, matchId: string) {
  const ch = await fetchTextChannel(guild, env.MATCH_CHANNEL_ID);
  if (!ch) return;
  const msgs = await ch.messages.fetch({ limit: 100 }).catch(() => null);
  if (!msgs) return;
  const targetCustomId = `MATCH:VALIDATE:${matchId}`;
  for (const [, msg] of msgs) {
    if (msg.author.id !== guild.client.user?.id) continue;
    const rows = (msg.components ?? []) as unknown as APIActionRowComponent<APIMessageActionRowComponent>[];
    const hasThisMatchButton = rows.some((row) =>
      (row.components ?? []).some((c: any) => (c.custom_id ?? c.customId) === targetCustomId)
    );
    if (hasThisMatchButton) {
      await msg.delete().catch(() => {});
      break;
    }
  }
}

/**
 * Lance tous les matchs d'un round donné (PENDING -> RUNNING + envoi des liens + embed MATCH)
 * - 2 équipes (BOx) => 1 match par round
 * - 4 équipes (RRx) => 2 matchs en parallèle par round
 */
export async function startRound(guild: Guild, lobbyId: string, round: number) {
  const pending = await prisma.match.findMany({
    where: { lobbyId, round, state: "PENDING" },
    include: { lobby: true, teamA: true, teamB: true },
    orderBy: { createdAt: "asc" },
  });
  if (pending.length === 0) return;

  const matchCh = await fetchTextChannel(guild, env.MATCH_CHANNEL_ID);

  for (const m of pending) {
    // Crée la room de draft (stub / à brancher API réelle)
    const draft = await createDraftRoom(m.teamA.name, m.teamB.name);

    // Passe RUNNING + liens
    await prisma.match.update({
      where: { id: m.id },
      data: {
        state: "RUNNING",
        draftRoomId: draft.roomId,
        blueUrl: draft.blueUrl,
        redUrl: draft.redUrl,
        specUrl: draft.specUrl,
      },
    });

    // Liens aux équipes
    const chA = await findTeamTextChannel(guild, m.teamA.name);
    const chB = await findTeamTextChannel(guild, m.teamB.name);
    if (chA) await chA.send(`🔵 **Lien draft BLUE**: ${draft.blueUrl}\nPrêts dès que possible.`);
    if (chB) await chB.send(`🔴 **Lien draft RED**: ${draft.redUrl}\nPrêts dès que possible.`);

    // Carte MATCH publique
    if (matchCh) {
      const embed = buildMatchEmbed({
        lobbyName: m.lobby.name,
        teamAName: m.teamA.name,
        teamBName: m.teamB.name,
        specUrl: draft.specUrl,
      });
      const row = buildValidateRow(m.id);
      await matchCh.send({ embeds: [embed], components: [row] });
    }
  }
}

/**
 * Valide un match (FINISHED) puis :
 * - enregistre (facultatif) winnerTeamId + MatchResult
 * - si d'autres matchs du même round sont encore en cours/pending -> on attend
 * - si le round est terminé et qu'il existe un round suivant PENDING -> on lance ce round
 * - sinon -> cleanup + Résultats + MVP
 */
export async function validateMatchAndMaybeCleanup(
  guild: Guild,
  matchId: string,
  winnerTeamId?: string
) {
  // On met à jour l'état + vainqueur si fourni
  const updated = await prisma.match.update({
    where: { id: matchId },
    data: {
      state: "FINISHED",
      ...(winnerTeamId ? { winnerTeamId } : {}),
    },
    include: { lobby: true, teamA: true, teamB: true },
  });

  // Trace MatchResult si on connaît le gagnant
  if (winnerTeamId) {
    const loserTeamId =
      winnerTeamId === updated.teamAId ? updated.teamBId : updated.teamAId;
    try {
      await prisma.matchResult.create({
        data: {
          matchId: updated.id,
          winnerId: winnerTeamId,
          loserId: loserTeamId,
        },
      });
    } catch {
      // ignore duplicate or any race
    }
  }

  // 🧹 Ne supprime QUE la carte du match validé
  await deleteMatchCard(guild, matchId);

  const lobbyId = updated.lobby.id;
  const currentRound = updated.round;

  // Snapshot à jour
  const all = await prisma.match.findMany({
    where: { lobbyId },
    orderBy: [{ round: "asc" }, { createdAt: "asc" }],
  });

  // Reste-t-il un match non FINISHED dans CE round ?
  const sameRoundRemaining = all.some(
    (x) => x.round === currentRound && x.id !== updated.id && x.state !== "FINISHED"
  );
  if (sameRoundRemaining) {
    // ➜ On attend la validation de l'autre match du round (cas 4 équipes)
    return;
  }

  // Le round est-il totalement terminé ?
  const roundDone = all.filter((x) => x.round === currentRound).every((x) => x.state === "FINISHED");
  if (!roundDone) return;

  // Existe-t-il un round suivant avec des matchs PENDING ?
  const nextRound = currentRound + 1;
  const nextPending = all.filter((x) => x.round === nextRound && x.state === "PENDING");
  if (nextPending.length > 0) {
    // ➜ Lancer le round suivant
    await startRound(guild, lobbyId, nextRound);
    return;
  }

  // Plus de round suivant: tout est FINISHED ? -> cleanup + Résultats + MVP
  const remainingAny = all.some((x) => x.state !== "FINISHED");
  if (!remainingAny) {
    // Cleanup des catégories/channels des équipes (créés à la phase 3)
    const cats = guild.channels.cache.filter(
      (c) => c.type === ChannelType.GuildCategory && c.name.startsWith("MYG — ")
    );
    for (const [, cat] of cats) {
      const children = guild.channels.cache.filter((c) => (c as any).parentId === cat.id);
      for (const [, child] of children) {
        await child.delete().catch(() => {});
      }
      await cat.delete().catch(() => {});
    }

    // Panneau résultats: envoie dans RESULT_CHANNEL_ID si possible, sinon fallback dans MATCH_CHANNEL_ID
    const { buildResultsPanel } = await import("../results/embeds");
    const panel = await buildResultsPanel(lobbyId);

    // ⚠️ Discord: 5 lignes max → chunk des components
    const rows = panel.components ?? [];
    const batches = chunk(rows, 5);

    const sendPanelBatches = async (channel: TextChannel | null) => {
      if (!channel) return;
      for (let i = 0; i < batches.length; i++) {
        const payload: any = {
          // embed seulement sur le 1er message
          embeds: i === 0 ? [panel.embed] : [],
          components: batches[i],
        };
        if (i === 0) {
          payload.content = `🧾 **${updated.lobby.name}** — Sélection des vainqueurs :`;
        }
        await channel.send(payload);
      }
    };

    const resCh = await fetchTextChannel(guild, env.RESULT_CHANNEL_ID);
    if (resCh) {
      await sendPanelBatches(resCh);
    } else {
      const fallback = await fetchTextChannel(guild, env.MATCH_CHANNEL_ID);
      await sendPanelBatches(fallback);
    }

    // Panneau MVP (upsert pour éviter doublon)
    const { upsertMvpPanel } = await import("../vote/panel");
    await upsertMvpPanel(guild.client, lobbyId);
  }
}
