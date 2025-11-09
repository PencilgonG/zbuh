import {
  ModalSubmitInteraction,
  ButtonInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuInteraction,
  GuildTextBasedChannel,
} from "discord.js";
import { prisma } from "../prismat";
import { mygEmbedBase } from "../utils/embeds";
import {
  costForNextLevel,
  getFactionTheme,
  isMaxFactionLevel,
  type FactionKey,
  applyLevelReward,
} from "../utils/factions";
import { env } from "../env";

// ====== Duel flow (mémoire volatile par user) ======
type DuelTmp = { region?: FactionKey; format?: "1v1" | "BO1" | "BO3" | "BO5" };
const duelTmp = new Map<string, DuelTmp>();

// Helper: convertir un nom en FactionKey (local)
const NAME_TO_KEY: Record<string, FactionKey> = {
  DEMACIA: "DEMACIA",
  NOXUS: "NOXUS",
  IONIA: "IONIA",
  FRELJORD: "FRELJORD",
  PILTOVER: "PILTOVER",
  SHURIMA: "SHURIMA",
  ZAUN: "ZAUN",
};
function inferKeyFromName(name?: string | null): FactionKey | null {
  if (!name) return null;
  const n = name.trim().toUpperCase();
  return NAME_TO_KEY[n] ?? null;
}

/* ---------------- DONATE ---------------- */
export async function showFactionDonateModal(interaction: ButtonInteraction) {
  const modal = new ModalBuilder()
    .setCustomId("FACTION:DONATE:SUBMIT")
    .setTitle("Donner des points à ta faction");

  const amount = new TextInputBuilder()
    .setCustomId("amount")
    .setLabel("Montant (entier ≥ 1)")
    .setPlaceholder("Ex: 3")
    .setRequired(true)
    .setStyle(TextInputStyle.Short);

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(amount));
  await interaction.showModal(modal);
}

export async function handleFactionDonateModal(modal: ModalSubmitInteraction) {
  if (modal.customId !== "FACTION:DONATE:SUBMIT") return;

  const amountStr = modal.fields.getTextInputValue("amount")?.trim() ?? "";
  const parsed = Math.floor(Number(amountStr));
  const amount = Number.isFinite(parsed) ? Math.max(1, parsed) : 0;

  const profile = await prisma.userProfile.findUnique({
    where: { discordId: modal.user.id },
    include: { faction: true, overrides: true },
  });

  if (!profile || !profile.faction) {
    return modal.reply({ content: "❌ Tu n’as pas de profil ou de faction.", ephemeral: true });
  }

  const sum = await prisma.pointsLedger.aggregate({
    where: { discordId: modal.user.id },
    _sum: { points: true },
  });
  const balance = sum._sum.points ?? 0;
  const hasInfinite = !!profile.overrides?.infinitePoints;

  if (amount <= 0) {
    return modal.reply({ content: "❌ Montant invalide (entier ≥ 1).", ephemeral: true });
  }
  if (!hasInfinite && balance < amount) {
    return modal.reply({
      content: `❌ Solde insuffisant. Il te manque **${amount - balance}** points.`,
      ephemeral: true,
    });
  }

  const factionId = profile.faction.id;

  // On garde l'ancien niveau pour savoir quels paliers on franchit
  let prevLevel = 1;
  let newLevel = 1;

  await prisma.$transaction(async (tx) => {
    await tx.pointsLedger.create({
      data: { discordId: modal.user.id, matchId: "FACTION", points: -amount, reason: "FACTION_DONATION" },
    });

    let state = await tx.factionState.findUnique({ where: { factionId } });
    if (!state) {
      state = await tx.factionState.create({
        data: {
          factionId,
          level: 1,
          progress: 0,
          discountPct: 0,
          championTickets: 0,
          duelTickets: 0,
        },
      });
    }

    prevLevel = state.level;
    let lvl = state.level;
    let prog = state.progress + amount;

    while (!isMaxFactionLevel(lvl)) {
      const need = costForNextLevel(lvl);
      if (!need || prog < need) break;
      prog -= need;
      lvl += 1;
    }
    if (isMaxFactionLevel(lvl)) prog = 0;
    newLevel = lvl;

    await tx.factionState.update({ where: { factionId }, data: { level: lvl, progress: prog } });
    await tx.faction.update({ where: { id: factionId }, data: { totalPoints: { increment: amount } } });
  });

  // ✅ Distribuer les récompenses pour chaque niveau franchi
  if (newLevel > prevLevel) {
    for (let L = prevLevel + 1; L <= newLevel; L++) {
      await applyLevelReward(factionId, L);
    }
  }

  const rebuilt = await buildFactionStatusEmbed(modal.user.id);
  if (rebuilt) {
    try {
      if (modal.channel) {
        const g: any = globalThis as any;
        const cache: Map<string, string> | undefined = g.factionStatusCache;
        const messageId = cache?.get(modal.user.id);
        if (messageId) {
          const msg = await modal.channel.messages.fetch(messageId).catch(() => null);
          if (msg) await msg.edit({ embeds: [rebuilt.embed], components: [rebuilt.row] });
        }
      }
    } catch {}
    return modal.reply({ embeds: [rebuilt.embed], components: [rebuilt.row], ephemeral: true });
  }

  return modal.reply({
    content: `✅ Don de **${amount}** points effectué pour **${profile.faction.name}** !`,
    ephemeral: true,
  });
}

async function buildFactionStatusEmbed(userId: string) {
  const profile = await prisma.userProfile.findUnique({
    where: { discordId: userId },
    include: { faction: true },
  });
  if (!profile?.faction) return null;

  const f = profile.faction;
  const MAP = {
    DEMACIA: "DEMACIA",
    NOXUS: "NOXUS",
    IONIA: "IONIA",
    FRELJORD: "FRELJORD",
    PILTOVER: "PILTOVER",
    SHURIMA: "SHURIMA",
    ZAUN: "ZAUN",
  } as const;
  type K = keyof typeof MAP;
  const key = (MAP[(f.name?.trim().toUpperCase() as K) ?? "DEMACIA"] ?? "DEMACIA") as FactionKey;
  const theme = getFactionTheme(key);

  const [membersCount, rankAbove, state, unopenedChests] = await Promise.all([
    prisma.userProfile.count({ where: { factionId: f.id } }),
    prisma.faction.count({ where: { totalPoints: { gt: f.totalPoints ?? 0 } } }),
    prisma.factionState.findUnique({ where: { factionId: f.id } }),
    prisma.factionChest.count({ where: { factionId: f.id, openedAt: null } }),
  ]);
  const rank = rankAbove + 1;

  const level = state?.level ?? 1;
  const progress = state?.progress ?? 0;
  const nextCost = costForNextLevel(level);
  const max = isMaxFactionLevel(level);

  let progDesc = "";
  if (max) {
    progDesc = `**Niveau :** 30 (MAX)\n**Progression :** —\n**Coût palier :** —`;
  } else {
    const pct = nextCost ? Math.min(100, Math.floor((progress / nextCost) * 100)) : 0;
    const barLen = 20;
    const filled = Math.round((pct / 100) * barLen);
    const bar = "█".repeat(filled) + "░".repeat(Math.max(0, barLen - filled));
    progDesc = `**Niveau :** ${level}\n**Progression :** ${bar} ${pct}%\n**Coût palier :** ${nextCost ?? 0} pts`;
  }

  const avgPerMember =
    membersCount > 0 ? Math.round(((f.totalPoints ?? 0) / membersCount) * 100) / 100 : 0;
  const discount = state?.discountPct ?? 0;
  const championTickets = state?.championTickets ?? 0;
  const duelTickets = state?.duelTickets ?? 0;
  const championReserved = (state as any)?.championReserved ?? null;

  const inventoryText = `▪ Coffre I ×${unopenedChests}`;
  const bonusParts = [
    `▪ Réduc boutique : ${discount}%`,
    `▪ Tickets Champion : ${championTickets}`,
    `▪ Tickets Duel : ${duelTickets}`,
  ];
  if (championReserved) bonusParts.push(`▪ Champion acquis : ${championReserved}`);
  const bonusText = bonusParts.join("\n");

  const embed = new EmbedBuilder()
    .setTitle(`Myg ${theme.name}`)
    .setDescription(progDesc)
    .setColor(theme.color)
    .setImage(theme.bannerUrl ?? null)
    .addFields(
      { name: "Points totaux (faction)", value: `**${f.totalPoints ?? 0}**`, inline: true },
      { name: "Membres", value: `**${membersCount}**`, inline: true },
      { name: "Rang", value: `**#${rank}**`, inline: true },
      { name: "Moyenne / membre", value: `**${avgPerMember}**`, inline: true },
      { name: "Inventaire (faction)", value: inventoryText, inline: true },
      { name: "Bonus (faction)", value: bonusText, inline: true },
    )
    .setFooter({ text: `ID faction: ${f.id}` });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("FACTION:GIFTS").setLabel("Gifts").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("FACTION:LEADERBOARD").setLabel("Leaderboard").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("FACTION:DONATE")
      .setLabel(max ? "MAX" : "Donate")
      .setStyle(max ? ButtonStyle.Secondary : ButtonStyle.Success)
      .setDisabled(max),
  );

  return { embed, row };
}

/* ---------------- DUEL ---------------- */
export async function handleDuelSelect(inter: StringSelectMenuInteraction) {
  const id = inter.customId;
  if (!id.startsWith("DUEL:SELECT:")) return;

  const userId = inter.user.id;
  const prev = duelTmp.get(userId) ?? {};

  if (id === "DUEL:SELECT:REGION") {
    const v = (inter.values?.[0] ?? "") as keyof typeof NAME_TO_KEY;
    if (!NAME_TO_KEY[v]) return inter.update({ content: "Région invalide.", components: [] });

    // 🔒 Empêche de choisir sa propre région
    const me = await prisma.userProfile.findUnique({
      where: { discordId: inter.user.id },
      include: { faction: true },
    });
    const myKey = inferKeyFromName(me?.faction?.name ?? null);
    if (myKey && myKey === v) {
      return inter.update({
        content: "🚫 Tu dois choisir **une région différente de la tienne**.",
        components: inter.message.components,
      });
    }

    prev.region = v as FactionKey;
  } else if (id === "DUEL:SELECT:FORMAT") {
    const v = inter.values?.[0] as "1v1" | "BO1" | "BO3" | "BO5";
    if (!["1v1", "BO1", "BO3", "BO5"].includes(v)) {
      return inter.update({ content: "Format invalide.", components: [] });
    }
    prev.format = v;
  }

  duelTmp.set(userId, prev);
  return inter.deferUpdate();
}

export async function handleDuelSubmit(button: ButtonInteraction) {
  if (button.customId !== "DUEL:SUBMIT") return;
  const tmp = duelTmp.get(button.user.id);
  if (!tmp?.region || !tmp?.format) {
    return button.reply({ content: "❌ Choisis une **région** et un **format** avant de valider.", ephemeral: true });
  }

  const modal = new ModalBuilder().setCustomId("DUEL:MSG:SUBMIT").setTitle("Message (optionnel)");
  const msg = new TextInputBuilder()
    .setCustomId("msg")
    .setLabel("Ajoute un message (optionnel)")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false);
  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(msg));
  await button.showModal(modal);
}

export async function handleDuelMsgModal(modal: ModalSubmitInteraction) {
  if (modal.customId !== "DUEL:MSG:SUBMIT") return;

  const tmp = duelTmp.get(modal.user.id);
  if (!tmp?.region || !tmp?.format) {
    return modal.reply({ content: "❌ Sélection perdue. Recommence la configuration du duel.", ephemeral: true });
  }

  const me = await prisma.userProfile.findUnique({
    where: { discordId: modal.user.id },
    include: { faction: true },
  });
  if (!me?.faction) return modal.reply({ content: "❌ Tu n’as pas de faction.", ephemeral: true });

  const state = await prisma.factionState.findUnique({ where: { factionId: me.faction.id } });
  if (!state || (state.duelTickets ?? 0) <= 0) {
    return modal.reply({ content: "❌ Aucun ticket Duel disponible.", ephemeral: true });
  }

  // Consommer le ticket ici (validation finale)
  await prisma.factionState.update({
    where: { factionId: me.faction.id },
    data: { duelTickets: { decrement: 1 } },
  });

  const note = modal.fields.getTextInputValue("msg")?.trim() || "";
  const targetKey = tmp.region;                         // faction défiée
  const attackerKey = inferKeyFromName(me.faction.name) as FactionKey; // faction qui défie
  const format = tmp.format;

  // Récupération de la faction cible par NOM (targetKey)
  const targetFaction = await prisma.faction.findFirst({
    where: { name: { equals: targetKey, mode: "insensitive" } },
  });

  // Mentions de TOUS les membres de la faction défiée
  let mentions = "_(faction cible non trouvée)_";
  if (targetFaction) {
    const members = await prisma.userProfile.findMany({
      where: { factionId: targetFaction.id },
      select: { discordId: true },
    });
    const tags = members
      .map((m) => (m.discordId ? `<@${m.discordId}>` : null))
      .filter(Boolean) as string[];
    mentions = tags.length ? tags.join(" ") : "_(aucun membre à mentionner)_";
  }

  // Thème visuel de la région ciblée
  const theme = getFactionTheme(targetKey);

  const embed = new EmbedBuilder()
    .setTitle("⚔️ Défi inter-factions")
    .setDescription(
      `**Défi :** ${attackerKey} ▶ ${targetKey}\n` +
      `**Format :** ${format}\n` +
      (note ? `**Message :** ${note}\n\n` : `\n`) +
      `**Joueurs défiés :**\n${mentions}`
    )
    .setColor(theme.color)
    .setImage(theme.bannerUrl ?? null)
    .setFooter({ text: `Demandé par ${modal.user.username}` });

  // Envoi dans le salon des duels
  const channelId = (env as any).DUELS_CHANNEL_ID as string;
  const duelsCh = await modal.client.channels.fetch(channelId).catch(() => null);
  if (duelsCh && (duelsCh as GuildTextBasedChannel).isTextBased?.()) {
    await (duelsCh as GuildTextBasedChannel).send({ embeds: [embed] }).catch(() => {});
  }

  duelTmp.delete(modal.user.id);
  return modal.reply({ content: "✅ Duel publié dans le salon dédié.", ephemeral: true });
}
