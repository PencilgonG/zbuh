// src/bot/commands/faction.ts
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  GuildMember,
  ButtonInteraction,
  StringSelectMenuInteraction,
} from "discord.js";
import { prisma } from "../../prismat";
import {
  costForNextLevel,
  getFactionTheme,
  isMaxFactionLevel,
  type FactionKey,
} from "../../utils/factions";
import { env } from "../../env";

/* =========================
 * Mapping nom → clé
 * ========================= */
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

/* =========================
 * Rôles de région (env casté pour clés optionnelles)
 * ========================= */
const E: any = env;

export const REGION_ROLE_IDS: Record<FactionKey, string | undefined> = {
  DEMACIA: E.ROLE_DEMACIA_ID,
  NOXUS: E.ROLE_NOXUS_ID,
  IONIA: E.ROLE_IONIA_ID,
  FRELJORD: E.ROLE_FRELJORD_ID,
  PILTOVER: E.ROLE_PILTOVER_ID,
  SHURIMA: E.ROLE_SHURIMA_ID,
  ZAUN: E.ROLE_ZAUN_ID,
};

export async function clearRegionRoles(
  interaction: ChatInputCommandInteraction,
  userId: string,
) {
  const guild = interaction.guild;
  if (!guild) return;
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return;

  const allRegionIds = Object.values(REGION_ROLE_IDS).filter(Boolean) as string[];
  if (!allRegionIds.length) return;

  const toRemove = allRegionIds.filter((rid) => member.roles.cache.has(rid));
  if (toRemove.length) {
    await member.roles.remove(toRemove).catch(() => {});
  }
}

export async function syncRegionRole(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  userId: string,
  key: FactionKey,
) {
  const guild = interaction.guild;
  if (!guild) return;
  const member = await guild.members.fetch(userId).catch(() => null);
  if (!member) return;

  const allRegionIds = Object.values(REGION_ROLE_IDS).filter(Boolean) as string[];
  const targetRole = REGION_ROLE_IDS[key];

  if (allRegionIds.length) {
    const toRemove = allRegionIds.filter((rid) => member.roles.cache.has(rid));
    if (toRemove.length) await member.roles.remove(toRemove).catch(() => {});
  }
  if (targetRole) {
    await member.roles.add(targetRole).catch(() => {});
  }
}

/* =========================
 * Leader d’une faction
 * ========================= */
async function getFactionLeaderId(factionId: number): Promise<string | null> {
  const members = await prisma.userProfile.findMany({
    where: { factionId },
    select: { discordId: true },
  });
  const ids = members.map((m) => m.discordId);
  if (ids.length === 0) return null;

  const top = await prisma.pointsLedger.groupBy({
    by: ["discordId"],
    where: { discordId: { in: ids } },
    _sum: { points: true },
    orderBy: { _sum: { points: "desc" } },
    take: 1,
  });
  return top.length > 0 ? top[0].discordId : null;
}

/* =========================
 * Command builder
 * ========================= */
export const data = new SlashCommandBuilder()
  .setName("faction")
  .setDescription("Commandes liées aux factions")
  // /faction join via sélecteur (plus d'option 'name')
  .addSubcommand((sc) => sc.setName("join").setDescription("Rejoindre une faction"))
  .addSubcommand((sc) => sc.setName("status").setDescription("Voir le statut complet de ta faction"))
  .addSubcommand((sc) => sc.setName("gifts").setDescription("Voir la liste des récompenses par niveaux"))
  .addSubcommand((sc) => sc.setName("list").setDescription("Lister les factions disponibles"))
  .addSubcommand((sc) =>
    sc
      .setName("transfer")
      .setDescription("Transférer un joueur dans TA faction (leader/respo)")
      .addUserOption((o) =>
        o.setName("cible").setDescription("Joueur à transférer").setRequired(true),
      ),
  )
  .addSubcommand((sc) =>
    sc
      .setName("ticket")
      .setDescription("Utiliser un ticket Champion (leader uniquement)")
      .addStringOption((o) => o.setName("champion").setDescription("Champion").setRequired(true)),
  )
  .addSubcommand((sc) =>
    sc.setName("duel").setDescription("Utiliser un ticket de duel (leader uniquement) — créer une annonce"),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
  .setDMPermission(true);

/* =========================
 * Router
 * ========================= */
export async function execute(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand();
  if (sub === "join") return handleJoin(interaction);
  if (sub === "status") return handleStatus(interaction);
  if (sub === "gifts") return handleGifts(interaction);
  if (sub === "list") return handleList(interaction);
  if (sub === "transfer") return handleTransfer(interaction);
  if (sub === "ticket") return handleTicketChampion(interaction);
  if (sub === "duel") return handleTicketDuel(interaction);
  return interaction.reply({ content: "Commande inconnue.", ephemeral: true });
}

/* ======================================================
 * /faction join — UI (sélecteur + bouton)
 * et handlers robustes pour éviter l’échec d’interaction
 * ====================================================== */
const joinTmp = new Map<string, { region?: FactionKey }>();

async function handleJoin(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  // Refus si déjà dans une faction
  const me = await prisma.userProfile.findUnique({
    where: { discordId: interaction.user.id },
    include: { faction: true },
  });
  if (me?.faction) {
    return interaction.editReply({
      content:
        "🚫 Tu es **déjà** dans une faction. Les changements se font via un **transfert** (/faction transfer).",
    });
  }

  const regions = Object.keys(NAME_TO_KEY) as (keyof typeof NAME_TO_KEY)[];
  const regionOptions = regions.map((r) => ({ label: r, value: r }));

  const row1 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("JOIN:SELECT_REGION")
      .setPlaceholder("Choisir une région…")
      .addOptions(regionOptions),
  );
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("JOIN:SUBMIT").setLabel("Valider").setStyle(ButtonStyle.Success),
  );

  const embed = new EmbedBuilder()
    .setTitle("🏳️ Rejoindre une faction")
    .setDescription(
      "Sélectionne **une région** puis clique **Valider**.\n" +
        "⚠️ Le changement ultérieur se fait via un **transfert**.",
    );

  return interaction.editReply({ embeds: [embed], components: [row1, row2] });
}

export async function handleJoinSelect(inter: StringSelectMenuInteraction) {
  if (inter.customId !== "JOIN:SELECT_REGION") return;
  try {
    const v = (inter.values?.[0] ?? "") as keyof typeof NAME_TO_KEY;
    if (!NAME_TO_KEY[v]) {
      if (inter.deferred || inter.replied) {
        await inter
          .followUp({ content: "❌ Région invalide.", ephemeral: true })
          .catch(() => {});
      } else {
        await inter.reply({ content: "❌ Région invalide.", ephemeral: true }).catch(() => {});
      }
      return;
    }
    joinTmp.set(inter.user.id, { region: v as FactionKey });

    // Accusé de réception garanti
    await inter.deferUpdate().catch(async () => {
      if (inter.deferred || inter.replied) {
        await inter.followUp({ content: "✅ Région sélectionnée.", ephemeral: true }).catch(() => {});
      } else {
        await inter.reply({ content: "✅ Région sélectionnée.", ephemeral: true }).catch(() => {});
      }
    });
  } catch (e) {
    console.error("handleJoinSelect error:", e);
    if (inter.deferred || inter.replied) {
      await inter.followUp({ content: "❌ Erreur lors de la sélection.", ephemeral: true }).catch(() => {});
    } else {
      await inter.reply({ content: "❌ Erreur lors de la sélection.", ephemeral: true }).catch(() => {});
    }
  }
}

export async function handleJoinSubmit(btn: ButtonInteraction) {
  if (btn.customId !== "JOIN:SUBMIT") return;
  try {
    const saved = joinTmp.get(btn.user.id);
    if (!saved?.region) {
      return btn.reply({ content: "❌ Choisis une région d’abord.", ephemeral: true });
    }

    // Résolution faction par nom = clé choisie
    const faction = await prisma.faction.findFirst({
      where: { name: { equals: saved.region, mode: "insensitive" } },
    });
    if (!faction) {
      return btn.reply({ content: "❌ Faction introuvable.", ephemeral: true });
    }

    // Refus si déjà dans une faction
    const me = await prisma.userProfile.findUnique({ where: { discordId: btn.user.id } });
    if (me?.factionId) {
      return btn.reply({
        content: "🚫 Tu es **déjà** dans une faction. Utilise un **transfert**.",
        ephemeral: true,
      });
    }

    if (!me) {
      await prisma.userProfile.create({ data: { discordId: btn.user.id, factionId: faction.id } });
    } else {
      await prisma.userProfile.update({ where: { discordId: btn.user.id }, data: { factionId: faction.id } });
    }

    // Rôle Discord de région
    const key = saved.region;
    await syncRegionRole(btn, btn.user.id, key);

    joinTmp.delete(btn.user.id);
    return btn.reply({ content: `✅ Tu as rejoint **${faction.name}**.`, ephemeral: true });
  } catch (e) {
    console.error("handleJoinSubmit error:", e);
    if (btn.deferred || btn.replied) {
      await btn.followUp({ content: "❌ Erreur lors de la validation.", ephemeral: true }).catch(() => {});
    } else {
      await btn.reply({ content: "❌ Erreur lors de la validation.", ephemeral: true }).catch(() => {});
    }
  }
}

/* =========================
 * /faction status
 * ========================= */
async function handleStatus(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: false });
  const userId = interaction.user.id;

  const profile = await prisma.userProfile.findUnique({
    where: { discordId: userId },
    include: { faction: true },
  });

  if (!profile) return interaction.editReply({ content: "❌ Tu n’as pas encore de profil." });
  if (!profile.faction) return interaction.editReply({ content: "ℹ️ Tu n’es dans **aucune faction**." });

  const f = profile.faction;
  const key = inferKeyFromName(f.name) ?? "DEMACIA";
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
  const isMax = isMaxFactionLevel(level);

  let progDesc = "";
  if (isMax) {
    progDesc = `**Niveau :** 30 (MAX)\n**Progression :** —\n**Coût palier :** —`;
  } else {
    const pct = nextCost ? Math.min(100, Math.floor((progress / nextCost) * 100)) : 0;
    const barLen = 20;
    const filled = Math.round((pct / 100) * barLen);
    const bar = "█".repeat(filled) + "░".repeat(Math.max(0, barLen - filled));
    progDesc = `**Niveau :** ${level}\n**Progression :** ${bar} ${pct}%\n**Coût palier :** ${nextCost} pts`;
  }

  const avgPerMember =
    membersCount > 0 ? Math.round(((f.totalPoints ?? 0) / membersCount) * 100) / 100 : 0;

  const discount = state?.discountPct ?? 0;
  const championTickets = state?.championTickets ?? 0;
  const duelTickets = state?.duelTickets ?? 0;
  const championReserved = (state as any)?.championReserved ?? null;

  const inventoryText = `• Coffre I ×${unopenedChests}`;
  const bonusParts = [
    `• Réduc boutique : ${discount}%`,
    `• Tickets Champion : ${championTickets}`,
    `• Tickets Duel : ${duelTickets}`,
  ];
  if (championReserved) bonusParts.push(`• Champion acquis : ${championReserved}`);
  const bonusText = bonusParts.join("\n");

  const embed = new EmbedBuilder()
    .setTitle(`Myg ${theme.name}`)
    .setDescription(progDesc)
    .setColor(theme.color)
    .setImage(theme.bannerUrl ?? null)
    .addFields(
      { name: "Points totaux", value: `**${f.totalPoints ?? 0}**`, inline: true },
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
      .setLabel(isMax ? "MAX" : "Donate")
      .setStyle(isMax ? ButtonStyle.Secondary : ButtonStyle.Success)
      .setDisabled(isMax),
  );

  await interaction.editReply({ embeds: [embed], components: [row] });
}

/* =========================
 * /faction gifts
 * ========================= */
async function handleGifts(interaction: ChatInputCommandInteraction) {
  const lines: string[] = [];

  for (let L = 1; L <= 30; L++) {
    if (L >= 1 && L <= 3) lines.push(`**L${L}** — Coffre de faction I (×1 par membre)`);
    else if (L >= 4 && L <= 5) lines.push(`**L${L}** — Réduction boutique +1%`);
    else if (L >= 6 && L <= 9) lines.push(`**L${L}** — Coffre de faction I (×1 par membre)`);
    else if (L === 10) lines.push(`**L${L}** — Réservation de champion régional (×1)`);
    else if (L >= 11 && L <= 13) lines.push(`**L${L}** — Réduction boutique +1%`);
    else if (L === 14) lines.push(`**L${L}** — Jeton de titre (rare) (×1 par membre)`);
    else if (L === 15) lines.push(`**L${L}** — Ticket de duel (×1)`);
    else if (L >= 16 && L <= 19) lines.push(`**L${L}** — Coffre de faction I (×2 par membre)`);
    else if (L === 20) lines.push(`**L${L}** — Réservation de champion régional (×1)`);
    else if (L >= 21 && L <= 22) lines.push(`**L${L}** — Coffre de faction I (×2 par membre)`);
    else if (L === 23) lines.push(`**L${L}** — Réduction boutique +1%`);
    else if (L === 24) lines.push(`**L${L}** — Jeton de titre (épique) (×1 par membre)`);
    else if (L === 25) lines.push(`**L${L}** — Ticket de duel (×1)`);
    else if (L === 26) lines.push(`**L${L}** — Jeton de titre (épique) (×1 par membre)`);
    else if (L >= 27 && L <= 28) lines.push(`**L${L}** — Réduction boutique +1%`);
    else if (L === 29) lines.push(`**L${L}** — Coffre de faction I (×3 par membre)`);
    else if (L === 30) lines.push(`**L${L}** — Réservation de champion régional (×1)`);
  }

  const embed = new EmbedBuilder()
    .setTitle("🎁 Récompenses de niveaux")
    .setDescription(lines.join("\n"))
    .setFooter({ text: "Cap niveau 30" });

  return interaction.reply({ embeds: [embed], ephemeral: true });
}

/* =========================
 * /faction list
 * ========================= */
async function handleList(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });
  const factions = await prisma.faction.findMany({
    orderBy: [{ totalPoints: "desc" }, { name: "asc" }],
  });
  if (factions.length === 0) return interaction.editReply({ content: "Aucune faction définie." });

  const lines = await Promise.all(
    factions.map(async (f, i) => {
      const count = await prisma.userProfile.count({ where: { factionId: f.id } });
      return `**#${i + 1} — ${f.name}** — ${count} membres — ${f.totalPoints ?? 0} pts`;
    }),
  );

  const embed = new EmbedBuilder()
    .setTitle("📜 Factions")
    .setDescription(lines.join("\n"));
  return interaction.editReply({ embeds: [embed] });
}

/* =========================
 * /faction transfer
 * ========================= */
async function handleTransfer(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });
  const target = interaction.options.getUser("cible", true);

  if (target.id === interaction.user.id) {
    return interaction.editReply({ content: "❌ Tu ne peux pas te cibler toi-même." });
  }

  // Profil appelant + faction (destination)
  const me = await prisma.userProfile.findUnique({
    where: { discordId: interaction.user.id },
    include: { faction: true },
  });
  if (!me?.faction) return interaction.editReply({ content: "❌ Tu n’as pas de faction." });

  const myFaction = me.faction;

  // Autorisations : leader de ma faction OU rôle Respo serveur
  const leaderId = await getFactionLeaderId(myFaction.id);
  const isLeader = leaderId === interaction.user.id;
  const gm = interaction.member as GuildMember | null;
  const isRespo = !!gm?.roles.cache?.has?.(env.ROLE_RESPO_ID);

  if (!isLeader && !isRespo) {
    return interaction.editReply({
      content: "🚫 Seul le **leader** de ta faction ou un **responsable** peut transférer.",
    });
  }

  // Ancienne faction de la cible (info)
  const targetProfile = await prisma.userProfile.findUnique({
    where: { discordId: target.id },
    include: { faction: true },
  });

  // Met à jour la faction de la cible
  if (!targetProfile) {
    await prisma.userProfile.create({ data: { discordId: target.id, factionId: myFaction.id } });
  } else {
    await prisma.userProfile.update({
      where: { discordId: target.id },
      data: { factionId: myFaction.id },
    });
  }

  // Rôles : retirer anciens rôles région + attribuer le nouveau
  const newKey = inferKeyFromName(myFaction.name) ?? "DEMACIA";
  await syncRegionRole(interaction, target.id, newKey);

  const fromName = targetProfile?.faction?.name ?? "—";
  return interaction.editReply({
    content: `✅ **${target.username}** a été transféré de **${fromName}** vers **${myFaction.name}** (rôles mis à jour).`,
  });
}

/* =========================
 * /faction ticket (Champion)
 * ========================= */
async function handleTicketChampion(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });
  const me = await prisma.userProfile.findUnique({
    where: { discordId: interaction.user.id },
    include: { faction: true },
  });
  if (!me?.faction) return interaction.editReply({ content: "❌ Tu n’as pas de faction." });

  const f = me.faction;
  const state = await prisma.factionState.findUnique({ where: { factionId: f.id } });
  if (!state) return interaction.editReply({ content: "❌ Données de faction manquantes." });

  const leaderId = await getFactionLeaderId(f.id);
  if (leaderId !== interaction.user.id)
    return interaction.editReply({ content: "🚫 Seul le **leader** peut utiliser ce ticket." });

  if ((state.championTickets ?? 0) <= 0)
    return interaction.editReply({ content: "❌ Aucun **ticket Champion** disponible." });

  const champion = interaction.options.getString("champion", true);

  await prisma.factionState.update({
    where: { factionId: f.id },
    data: {
      championTickets: { decrement: 1 },
      championReserved: champion.toUpperCase(),
    } as any,
  });

  const theme = getFactionTheme(inferKeyFromName(f.name) ?? undefined);
  const embed = new EmbedBuilder()
    .setTitle("🎫 Ticket Champion utilisé")
    .setDescription(`✅ **${interaction.user.username}** a réservé **${champion}** pour **${theme.name}**.`)
    .setColor(theme.color)
    .setImage(theme.bannerUrl ?? null);

  return interaction.editReply({ embeds: [embed] });
}

/* =========================
 * /faction duel (sélecteurs & bouton – annonce postée ailleurs)
 * ========================= */
async function handleTicketDuel(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });
  const me = await prisma.userProfile.findUnique({
    where: { discordId: interaction.user.id },
    include: { faction: true },
  });
  if (!me?.faction) return interaction.editReply({ content: "❌ Tu n’as pas de faction." });

  const f = me.faction;
  const state = await prisma.factionState.findUnique({ where: { factionId: f.id } });
  if (!state) return interaction.editReply({ content: "❌ Données de faction manquantes." });

  const leaderId = await getFactionLeaderId(f.id);
  if (leaderId !== interaction.user.id)
    return interaction.editReply({ content: "🚫 Seul le **leader** peut utiliser ce ticket." });

  if ((state.duelTickets ?? 0) <= 0)
    return interaction.editReply({ content: "❌ Aucun **ticket de duel** disponible." });

  const regions = Object.keys(NAME_TO_KEY) as (keyof typeof NAME_TO_KEY)[];
  const regionOptions = regions.map((r) => ({ label: r, value: r }));
  const formatOptions = [
    { label: "1v1", value: "1v1" },
    { label: "Bo1", value: "BO1" },
    { label: "Bo3", value: "BO3" },
    { label: "Bo5", value: "BO5" },
  ];

  const row1 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("DUEL:SELECT:REGION")
      .setPlaceholder("Choisir la région…")
      .addOptions(regionOptions),
  );
  const row2 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("DUEL:SELECT:FORMAT")
      .setPlaceholder("Choisir le format…")
      .addOptions(formatOptions),
  );
  const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("DUEL:SUBMIT").setLabel("Valider").setStyle(ButtonStyle.Success),
  );

  const theme = getFactionTheme(inferKeyFromName(f.name) ?? undefined);
  const embed = new EmbedBuilder()
    .setTitle("⚔️ Ticket de duel")
    .setDescription(
      "Sélectionne **région** et **format**, puis clique **Valider**. Un message optionnel te sera demandé.",
    )
    .setColor(theme.color)
    .setImage(theme.bannerUrl ?? null);

  return interaction.editReply({ embeds: [embed], components: [row1, row2, row3] });
}
