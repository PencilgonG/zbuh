// src/match/flow.ts
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

async function fetchTextChannel(guild: Guild, id: string) {
  const ch = await guild.channels.fetch(id).catch(() => null);
  if (!ch || !("isTextBased" in ch) || !ch.isTextBased()) return null;
  return ch as TextChannel;
}

async function findTeamTextChannel(guild: Guild, teamName: string) {
  const targetName = `text-${teamName}`.toLowerCase().replace(/\s+/g, "-");
  const ch = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildText && c.name === targetName
  );
  if (!ch || !("isTextBased" in ch) || !ch.isTextBased()) return undefined;
  return ch as TextChannel;
}

// Détection d'une carte MATCH déjà envoyée pour un matchId
async function matchCardExists(guild: Guild, matchId: string) {
  const ch = await fetchTextChannel(guild, env.MATCH_CHANNEL_ID);
  if (!ch) return false;
  const msgs = await ch.messages.fetch({ limit: 100 }).catch(() => null);
  if (!msgs) return false;
  const targetCustomId = `MATCH:VALIDATE:${matchId}`;
  for (const [, msg] of msgs) {
    if (msg.author.id !== guild.client.user?.id) continue;
    const rows = (msg.components ?? []) as unknown as APIActionRowComponent<APIMessageActionRowComponent>[];
    const hasBtn = rows.some((row) =>
      (row.components ?? []).some((c: any) => (c.custom_id ?? c.customId) === targetCustomId)
    );
    if (hasBtn) return true;
  }
  return false;
}

// Détection d’un panel Résultats déjà présent (cherche des boutons RESULT:)
async function resultsPanelExists(guild: Guild) {
  const scan = async (channelId: string) => {
    const ch = await fetchTextChannel(guild, channelId);
    if (!ch) return false;
    const msgs = await ch.messages.fetch({ limit: 100 }).catch(() => null);
    if (!msgs) return false;
    for (const [, msg] of msgs) {
      if (msg.author.id !== guild.client.user?.id) continue;
      const rows = (msg.components ?? []) as unknown as APIActionRowComponent<APIMessageActionRowComponent>[];
      const hasResultButtons = rows.some((row) =>
        (row.components ?? []).some((c: any) =>
          typeof (c.custom_id ?? c.customId) === "string" &&
          (c.custom_id ?? c.customId).startsWith("RESULT:")
        )
      );
      if (hasResultButtons) return true;
    }
    return false;
  };

  if (await scan(env.RESULT_CHANNEL_ID)) return true;
  if (await scan(env.MATCH_CHANNEL_ID)) return true;
  return false;
}

// Supprime UNIQUEMENT la carte du match donné
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
 * - 2 équipes (BOx)  => 1 match par round
 * - 4 équipes (RRx)  => 2 matchs en parallèle par round
 *
 * 🔒 Anti-duplication:
 *   - Si un match du round est déjà RUNNING, on ne relance pas le round.
 * 🎯 Sides:
 *   - 2 équipes: alternance déterministe par round (pair/impair) => 50/50 garanti.
 *   - 4 équipes: 50/50 aléatoire par match.
 */
export async function startRound(guild: Guild, lobbyId: string, round: number) {
  const alreadyRunning = await prisma.match.count({
    where: { lobbyId, round, state: "RUNNING" },
  });
  if (alreadyRunning > 0) return;

  const pending = await prisma.match.findMany({
    where: { lobbyId, round, state: "PENDING" },
    include: { lobby: true, teamA: true, teamB: true },
    orderBy: { createdAt: "asc" },
  });
  if (pending.length === 0) return;

  const matchCh = await fetchTextChannel(guild, env.MATCH_CHANNEL_ID);

  for (const m of pending) {
    // 2 équipes -> un seul match dans ce round => alternance par round
    // 4 équipes -> deux matchs en parallèle => aléatoire 50/50 par match
    const isTwoTeams = pending.length === 1;
    const swapSides = isTwoTeams ? (round % 2 === 0) : (Math.random() < 0.5);

    const draft = await createDraftRoom(m.teamA.name, m.teamB.name, swapSides);

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

    const chA = await findTeamTextChannel(guild, m.teamA.name);
    const chB = await findTeamTextChannel(guild, m.teamB.name);
    if (chA) await chA.send(`🔵 **Lien draft BLUE**: ${draft.blueUrl}\nPrêts dès que possible.`);
    if (chB) await chB.send(`🔴 **Lien draft RED**: ${draft.redUrl}\nPrêts dès que possible.`);

    if (matchCh) {
      const already = await matchCardExists(guild, m.id);
      if (!already) {
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
}

/**
 * Valide un match (FINISHED) puis :
 * - si d'autres matchs du même round sont encore en cours/pending -> on attend
 * - si le round est terminé et qu'il existe un round suivant PENDING -> on lance ce round
 * - sinon -> cleanup + Résultats + MVP (une seule fois, en fin de lobby)
 */
export async function validateMatchAndMaybeCleanup(
  guild: Guild,
  matchId: string,
  winnerTeamId?: string
) {
  const updated = await prisma.match.update({
    where: { id: matchId },
    data: {
      state: "FINISHED",
      ...(winnerTeamId ? { winnerTeamId } : {}),
    },
    include: { lobby: true, teamA: true, teamB: true },
  });

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
      // ignore duplicate/race
    }
  }

  await deleteMatchCard(guild, matchId);

  const lobbyId = updated.lobby.id;
  const currentRound = updated.round;

  const all = await prisma.match.findMany({
    where: { lobbyId },
    orderBy: [{ round: "asc" }, { createdAt: "asc" }],
  });

  const sameRoundRemaining = all.some(
    (x) => x.round === currentRound && x.id !== updated.id && x.state !== "FINISHED"
  );
  if (sameRoundRemaining) return;

  const roundDone = all.filter((x) => x.round === currentRound).every((x) => x.state === "FINISHED");
  if (!roundDone) return;

  const nextRound = currentRound + 1;
  const nextPending = all.filter((x) => x.round === nextRound && x.state === "PENDING");
  if (nextPending.length > 0) {
    await startRound(guild, lobbyId, nextRound);
    return;
  }

  // ——— Fin de lobby uniquement si plus AUCUN match en PENDING/RUNNING ———
  const unfinished = await prisma.match.count({
    where: { lobbyId, state: { in: ["PENDING", "RUNNING"] } },
  });
  if (unfinished > 0) return;

  // ✅ Toujours faire le cleanup, même si un panel existe déjà
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

  // Panel Résultats : dédup (n'envoie qu'une seule fois)
  const alreadyHasPanel = await resultsPanelExists(guild);

  if (!alreadyHasPanel) {
    const { buildResultsPanel } = await import("../results/embeds");
    const panel = await buildResultsPanel(lobbyId);

    const rows = panel.components ?? [];
    const batches = chunk(rows, 5);

    const sendPanelBatches = async (channel: TextChannel | null) => {
      if (!channel) return;
      for (let i = 0; i < batches.length; i++) {
        const payload: any = {
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
  }

  // MVP : upsert (idempotent)
  const { upsertMvpPanel } = await import("../vote/panel");
  await upsertMvpPanel(guild.client, lobbyId);
}
