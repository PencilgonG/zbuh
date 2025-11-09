// src/battle/buttons.ts
import {
  ButtonInteraction,
  GuildMember,
} from "discord.js";
import { prisma } from "../prismat";
import { env } from "../env";
import { maybeAdvanceBattle, startBattleRound, brRuntime } from "./round";
import { deleteChannelSafe } from "../utils/voice";
import { applyContribution } from "../services/faction/contributions";

function isRespo(member: GuildMember | null) {
  return !!member?.roles.cache?.has(env.ROLE_RESPO_ID);
}

/**
 * Boutons Battle Royale :
 * - BR:JOIN:<lobbyId>           (toggle inscription)
 * - BR:TESTFILL:<lobbyId>       (remplit 20 fake joueurs) [staff only]
 * - BR:VALIDATE:<lobbyId>       (lance le Round 1)        [staff only]
 * - BR:WIN:<matchId>:A|B        (déclare le gagnant du match) [staff only]
 */
export async function handleBattleButton(inter: ButtonInteraction) {
  const id = inter.customId;
  if (!id.startsWith("BR:")) return;

  // --- GAGNANT D’UN MATCH ---
  if (id.startsWith("BR:WIN:")) {
    await inter.deferUpdate();
    const [, , matchId, side] = id.split(":");

    const bm = await prisma.battleMatch.findUnique({ where: { id: matchId } });
    if (!bm || !inter.guild) return;

    // Staff only
    const gm = inter.member as GuildMember | null;
    if (!isRespo(gm)) {
      await inter.followUp({ content: "🔒 Réservé aux responsables.", ephemeral: true });
      return;
    }

    // Détermine gagnant/perdant en LobbyParticipant.id
    const winnerLpId = side === "A" ? bm.aId : bm.bId;
    const loserLpId  = side === "A" ? bm.bId : bm.aId;

    // MAJ gagnant en DB
    await prisma.battleMatch.update({
      where: { id: matchId },
      data: { winnerId: winnerLpId },
    });

    // Récupère les discordId des deux joueurs
    const [lpWin, lpLose] = await Promise.all([
      prisma.lobbyParticipant.findUnique({ where: { id: winnerLpId } }),
      prisma.lobbyParticipant.findUnique({ where: { id: loserLpId } }),
    ]);

    // ⚖️ Attribution de points : base classique (3/1) + (round-1)
    const winPts  = 3 + Math.max(0, (bm.round ?? 1) - 1);
    const losePts = 1 + Math.max(0, (bm.round ?? 1) - 1);

    // On utilise battleMatch.id comme "matchId" dans PointsLedger (pas de FK stricte)
    const ledgerMatchId = bm.id;

    // Crédit gagnant / perdant si on a leur discordId
    if (lpWin?.discordId) {
      await prisma.pointsLedger.create({
        data: { discordId: lpWin.discordId, matchId: ledgerMatchId, points: winPts, reason: `br_win_r${bm.round}` },
      });
      // Contribution de faction équivalente
      await applyContribution(lpWin.discordId, winPts).catch(() => {});
    }
    if (lpLose?.discordId) {
      await prisma.pointsLedger.create({
        data: { discordId: lpLose.discordId, matchId: ledgerMatchId, points: losePts, reason: `br_loss_r${bm.round}` },
      });
      await applyContribution(lpLose.discordId, losePts).catch(() => {});
    }

    // Nettoyage du vocal si existait
    const runtime = brRuntime.get(matchId);
    if (runtime?.voiceId) {
      await deleteChannelSafe(inter.guild, runtime.voiceId);
      brRuntime.set(matchId, { messageId: runtime.messageId }); // on garde l'ID message si stocké
    }

    // Auto-cleanup du message du match
    if (inter.message && "delete" in inter.message) {
      await (inter.message as any).delete().catch(() => {});
    } else if (runtime?.messageId) {
      const channel = inter.channel;
      if (channel && "messages" in channel) {
        await (channel as any).messages.delete(runtime.messageId).catch(() => {});
      }
    }

    // Enchaîne le flux (prochain round / finale si nécessaire)
    await maybeAdvanceBattle(inter.guild, bm.lobbyId);
    return;
  }

  // --- Toggle inscription joueur ---
  if (id.startsWith("BR:JOIN:")) {
    await inter.deferUpdate();
    const [, , lobbyId] = id.split(":");

    const existing = await prisma.lobbyParticipant.findFirst({
      where: { lobbyId, discordId: inter.user.id },
    });

    if (existing) {
      await prisma.lobbyParticipant.delete({ where: { id: existing.id } });
    } else {
      await prisma.lobbyParticipant.create({
        data: {
          lobbyId,
          discordId: inter.user.id,
          display: inter.user.username,
          role: "SUB", // enum existant, non utilisé en BR
          isFake: false,
        },
      });
    }

    // MAJ panneau d’attente
    const participants = await prisma.lobbyParticipant.findMany({
      where: { lobbyId },
      orderBy: { joinedAt: "asc" },
    });
    const list =
      participants.length === 0
        ? "Aucun joueur inscrit pour l’instant."
        : participants.map((p, i) => `${i + 1}. ${p.discordId ? `<@${p.discordId}>` : p.display}`).join("\n");

    await (inter.message as any).edit({
      embeds: [
        {
          ...inter.message.embeds[0].toJSON(),
          fields: [{ name: `Inscrits (${participants.length})`, value: list }],
        },
      ],
      components: inter.message.components as any,
    });

    return;
  }

  // --- Remplissage test (20 joueurs) ---
  if (id.startsWith("BR:TESTFILL:")) {
    await inter.deferReply({ ephemeral: true });
    const [, , lobbyId] = id.split(":");

    const gm = inter.member as GuildMember | null;
    if (!isRespo(gm)) {
      await inter.editReply("🔒 Réservé aux responsables.");
      return;
    }

    const data = Array.from({ length: 20 }).map((_, i) => ({
      lobbyId,
      discordId: null as string | null,
      display: `Test${String(i + 1).padStart(2, "0")}`,
      role: "SUB" as const,
      isFake: true,
    }));
    await prisma.lobbyParticipant.createMany({ data });

    if ("edit" in inter.message) {
      const participants = await prisma.lobbyParticipant.findMany({
        where: { lobbyId },
        orderBy: { joinedAt: "asc" },
      });
      const list =
        participants.length === 0
          ? "Aucun joueur inscrit pour l’instant."
          : participants.map((p, i) => `${i + 1}. ${p.discordId ? `<@${p.discordId}>` : p.display}`).join("\n");

      await (inter.message as any).edit({
        embeds: [
          {
            ...inter.message.embeds[0].toJSON(),
            fields: [{ name: `Inscrits (${participants.length})`, value: list }],
          },
        ],
        components: (inter.message as any).components,
      });
    }

    await inter.editReply("✅ 20 joueurs de test ajoutés.");
    return;
  }

  // --- Lancer Round 1 ---
  if (id.startsWith("BR:VALIDATE:")) {
    await inter.deferReply({ ephemeral: true });
    const [, , lobbyId] = id.split(":");

    const gm = inter.member as GuildMember | null;
    if (!isRespo(gm)) {
      await inter.editReply("🔒 Réservé aux responsables.");
      return;
    }

    const ctx =
      inter.guild && inter.client
        ? (inter as unknown as { guild: any; client: any })
        : ({ guild: (inter as any).guild, client: (inter as any).client } as any);

    await startBattleRound(ctx, lobbyId, 1);
    await inter.editReply("🚀 Round 1 lancé.");
    return;
  }
}
