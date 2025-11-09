// src/battle/round.ts
import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  Guild,
  TextChannel,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { prisma } from "../prismat";
import { mygEmbedBase } from "../utils/embeds";
import { createTempVoice, deleteChannelSafe } from "../utils/voice";
import { env } from "../env";

/**
 * Stockage éphémère (RAM) pour lier un BattleMatch à ses IDs message/vocal
 * car ces colonnes n’existent pas en base (volontairement).
 */
export const brRuntime = new Map<string, { messageId?: string; voiceId?: string }>();

/** Règles fixes 1v1 (définies par l’utilisateur). */
const ONE_VS_ONE_RULES =
  "Map ARAM • First blood only • Même champion • Mêmes runes • Mêmes items • Heals autorisés";

/** Construit la ligne de boutons “Victoire A / Victoire B” pour un match. */
function buildWinRow(matchId: string, aLabel: string, bLabel: string) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`BR:WIN:${matchId}:A`).setLabel(`🏆 Victoire ${aLabel}`).setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`BR:WIN:${matchId}:B`).setLabel(`🏆 Victoire ${bLabel}`).setStyle(ButtonStyle.Danger),
  );
}

function mentionFor(lp: { discordId: string | null; display: string }) {
  return lp.discordId ? `<@${lp.discordId}>` : lp.display;
}

/** Récupère un TextChannel de façon safe. */
async function getTextChannelById(guild: Guild, id: string) {
  const ch = await guild.channels.fetch(id).catch(() => null);
  if (!ch || !("isTextBased" in ch) || !ch.isTextBased()) return null;
  return ch as TextChannel;
}

/**
 * Lance un round de Battle Royale.
 * - Envoie 1 embed récap “Line-up” dans LINEUP_CHANNEL_ID
 * - Envoie chaque match dans MATCH_CHANNEL_ID (+ crée un vocal éphémère)
 * - Pour la finale, génère manche par manche (BO3)
 */
export async function startBattleRound(
  inter: ChatInputCommandInteraction | { guild: Guild; client: any },
  lobbyId: string,
  round: number,
) {
  const lobby = await prisma.lobby.findUnique({
    where: { id: lobbyId },
    include: { participants: true },
  });
  if (!lobby || !("guild" in inter) || !inter.guild) return;

  const guild = inter.guild as Guild;

  // Salons cibles (env)
  const lineupCh = await getTextChannelById(guild, env.LINEUP_CHANNEL_ID);
  const matchCh = await getTextChannelById(guild, env.MATCH_CHANNEL_ID);
  if (!lineupCh || !matchCh) return;

  // Avant de générer un nouveau round, on nettoie les vocs du round précédent
  if (round > 1) {
    const prev = await prisma.battleMatch.findMany({ where: { lobbyId, round: round - 1 } });
    for (const m of prev) {
      const st = brRuntime.get(m.id);
      if (st?.voiceId) await deleteChannelSafe(guild, st.voiceId);
    }
  }

  // Détermine la pool de joueurs :
  // round 1 => tous les participants
  // round >1 => uniquement les gagnants du round précédent
  let pool = lobby.participants;
  if (round > 1) {
    const prevWinners = await prisma.battleMatch.findMany({
      where: { lobbyId, round: round - 1, winnerId: { not: null } },
    });
    const ids = new Set(prevWinners.map((m) => m.winnerId!));
    pool = pool.filter((p) => ids.has(p.id));
  }

  // S’il reste 2 joueurs → gérer la finale en BO3 (manche par manche)
  if (pool.length === 2) {
    const [A, B] = pool;

    // Combien de manches déjà gagnées ?
    const finals = await prisma.battleMatch.findMany({
      where: { lobbyId, isFinal: true },
      orderBy: { createdAt: "asc" },
    });
    const winsA = finals.filter((m) => m.winnerId === A.id).length;
    const winsB = finals.filter((m) => m.winnerId === B.id).length;

    // Si déjà 2 victoires d’un côté, on stop (sécurité)
    if (winsA >= 2 || winsB >= 2) return;

    // Embed lineup (une seule ligne avec la finale)
    const lineEmbed = new EmbedBuilder(
      mygEmbedBase({
        title: `🏁 Finale (BO3) — ${lobby.name}`,
        description: `Manche ${winsA + winsB + 1}\n**${mentionFor(A)}** vs **${mentionFor(B)}**\n\nRègles : ${ONE_VS_ONE_RULES}`,
      }),
    );
    await lineupCh.send({ embeds: [lineEmbed] });

    // Crée la manche
    const created = await prisma.battleMatch.create({
      data: {
        lobbyId,
        round,
        aId: A.id,
        bId: B.id,
        isFinal: true,
      },
    });

    const row = buildWinRow(created.id, A.display, B.display);
    const matchEmbed = new EmbedBuilder(
      mygEmbedBase({
        title: `⚔️ Finale — ${lobby.name}`,
        description: `**${mentionFor(A)}** vs **${mentionFor(B)}**\n\nRègles : ${ONE_VS_ONE_RULES}`,
      }),
    );
    const msg = await matchCh.send({ embeds: [matchEmbed], components: [row] });

    // Vocal éphémère
    const vId = await createTempVoice(guild, `${A.display}-vs-${B.display}`);
    brRuntime.set(created.id, { messageId: msg.id, voiceId: vId ?? undefined });

    return;
  }

  // Sinon : Round classique — on génère toutes les paires aléatoires
  pool = [...pool].sort(() => Math.random() - 0.5);

  const pairs: Array<[typeof pool[number], typeof pool[number] | null]> = [];
  for (let i = 0; i < pool.length; i += 2) pairs.push([pool[i], pool[i + 1] ?? null]);

  // Embed LINEUP unique listant tous les 1v1 du round
  const lines = pairs.map(([A, B], idx) =>
    B
      ? `**Match ${idx + 1}** — ${mentionFor(A)} vs ${mentionFor(B)}`
      : `**Match ${idx + 1}** — ${mentionFor(A)} passe (bye)`,
  );
  const lineup = new EmbedBuilder(
    mygEmbedBase({
      title: `⚔️ Round ${round} — ${lobby.name}`,
      description: lines.join("\n"),
    }),
  );
  await lineupCh.send({ embeds: [lineup] });

  // Crée chaque match et poste dans le salon des matchs
  for (const [A, B] of pairs) {
    if (!B) {
      // Bye : A avance automatiquement
      await prisma.battleMatch.create({
        data: { lobbyId, round, aId: A.id, bId: A.id, winnerId: A.id },
      });
      continue;
    }

    const created = await prisma.battleMatch.create({
      data: { lobbyId, round, aId: A.id, bId: B.id },
    });

    const row = buildWinRow(created.id, A.display, B.display);
    const embed = new EmbedBuilder(
      mygEmbedBase({
        title: `⚔️ Round ${round} — ${lobby.name}`,
        description: `**${mentionFor(A)}** vs **${mentionFor(B)}**\n\nRègles : ${ONE_VS_ONE_RULES}`,
      }),
    );

    const msg = await matchCh.send({ embeds: [embed], components: [row] });

    // Vocal éphémère par match
    const vId = await createTempVoice(guild, `${A.display}-vs-${B.display}`);
    brRuntime.set(created.id, { messageId: msg.id, voiceId: vId ?? undefined });
  }
}

/**
 * Appelé après chaque validation d’un match :
 * - si round courant fini → lance le suivant
 * - gère la finale BO3 (arrêt quand l’un atteint 2 wins)
 */
export async function maybeAdvanceBattle(guild: Guild, lobbyId: string) {
  const lobby = await prisma.lobby.findUnique({ where: { id: lobbyId } });
  if (!lobby) return;

  const rounds = await prisma.battleMatch.findMany({
    where: { lobbyId },
    orderBy: [{ round: "asc" }, { createdAt: "asc" }],
  });
  if (rounds.length === 0) return;

  const maxRound = rounds[rounds.length - 1].round;
  const currentRound = rounds.filter((m) => m.round === maxRound && !m.isFinal);
  const finals = rounds.filter((m) => m.isFinal);

  // Gestion finale BO3
  if (finals.length > 0) {
    // Deux joueurs en finale
    const players = new Set<string>();
    for (const m of finals) {
      players.add(m.aId);
      players.add(m.bId);
    }
    if (players.size !== 2) return;

    let wins = new Map<string, number>();
    for (const m of finals) if (m.winnerId) wins.set(m.winnerId, (wins.get(m.winnerId) ?? 0) + 1);

    const entries = [...wins.entries()].sort((a, b) => b[1] - a[1]);
    const top = entries[0];

    if (top && top[1] >= 2) {
      // Champion trouvé
      const winnerLp = await prisma.lobbyParticipant.findUnique({ where: { id: top[0] } });
      const lineupCh = await getTextChannelById(guild, env.LINEUP_CHANNEL_ID);
      if (lineupCh) {
        await lineupCh.send(
          `🏆 **Champion Battle Royale :** ${winnerLp?.discordId ? `<@${winnerLp.discordId}>` : winnerLp?.display ?? "??"} !`,
        );
      }
      await prisma.lobby.update({ where: { id: lobbyId }, data: { status: "CLOSED" } });
      return;
    }

    // Pas encore 2 victoires → créer la manche suivante (toujours via startBattleRound)
    const fakeInter = { guild, client: guild.client } as any;
    await startBattleRound(fakeInter, lobbyId, maxRound + 1);
    return;
  }

  // Round courant incomplet ? on attend
  if (currentRound.some((m) => !m.winnerId)) return;

  // Round terminé → prochain round
  const fakeInter = { guild, client: guild.client } as any;
  await startBattleRound(fakeInter, lobbyId, maxRound + 1);
}
