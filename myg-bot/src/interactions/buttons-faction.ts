import {
  ButtonInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import { prisma } from "../prismat";
import { mygEmbedBase } from "../utils/embeds";
import { costForNextLevel, getFactionTheme, isMaxFactionLevel } from "../utils/factions";
import { showFactionDonateModal } from "./modals-faction";

/**
 * FACTION:DONATE        -> ouvre le modal de don
 * FGIFTS:PAGE:1/2/3     -> pagination Gifts (L1–10 / L11–20 / L21–30)
 */
export async function handleFactionButtons(interaction: ButtonInteraction) {
  const id = interaction.customId;

  if (id === "FACTION:DONATE") {
    return showFactionDonateModal(interaction);
  }

  // --- Gifts pagination ---
  if (id.startsWith("FGIFTS:PAGE:")) {
    const pageStr = id.split(":")[2];
    const page = Math.max(1, Math.min(3, Number(pageStr) || 1));
    const start = (page - 1) * 10 + 1;
    const end = Math.min(30, start + 9);

    const lines: string[] = [];
    for (let L = start; L <= end; L++) {
      let rewards: string;
      if (L === 10 || L === 20 || L === 30) rewards = "Réservation de champion régional (1)";
      else if (L === 15 || L === 25) rewards = "Ticket de duel";
      else rewards = "Coffre de faction I (loot aléatoire)";
      lines.push(`**L${L}** — ${rewards}`);
    }

    const embed = new EmbedBuilder(
      mygEmbedBase({
        title: `Gifts — L${start} à L${end}`,
        description: lines.join("\n"),
        footer: { text: "Cap L30" },
      }),
    );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("FGIFTS:PAGE:1")
        .setLabel("L1–10")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 1),
      new ButtonBuilder()
        .setCustomId("FGIFTS:PAGE:2")
        .setLabel("L11–20")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 2),
      new ButtonBuilder()
        .setCustomId("FGIFTS:PAGE:3")
        .setLabel("L21–30")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(page === 3),
    );

    return interaction.update({ embeds: [embed], components: [row] });
  }

  return;
}

/** Utilitaire pour ré-afficher un /faction status (optionnel). */
export async function refreshFactionStatusForUser(interaction: ButtonInteraction | any) {
  const profile = await prisma.userProfile.findUnique({
    where: { discordId: interaction.user.id },
    include: { faction: true },
  });
  if (!profile?.factionId) return;

  const faction = await prisma.faction.findUnique({ where: { id: profile.factionId } });
  if (!faction) return;

  const state = await prisma.factionState.findUnique({ where: { factionId: faction.id } });
  const level = state?.level ?? 1;
  const progress = state?.progress ?? 0;
  const theme = getFactionTheme((profile.faction as any)?.key ?? null);
  const nextCost = costForNextLevel(level);
  const isMax = isMaxFactionLevel(level);

  let desc = "";
  if (isMax) {
    desc = `**Niveau 30 (MAX)**\nLa faction a atteint le niveau maximum.`;
  } else {
    const pct = nextCost ? Math.min(100, Math.floor((progress / nextCost) * 100)) : 0;
    const barLen = 20;
    const filled = Math.round((pct / 100) * barLen);
    const bar = "█".repeat(filled) + "░".repeat(Math.max(0, barLen - filled));
    desc = `**Niveau actuel :** ${level}\n**Progression :** ${bar} ${pct}%\n**Coût palier :** ${nextCost} pts`;
  }

  const embed = new EmbedBuilder(
    mygEmbedBase({
      title: `Faction — ${faction.name ?? theme.name}`,
      description: desc,
      color: theme.color,
      ...(theme.bannerUrl ? { image: { url: theme.bannerUrl } } : {}),
      footer: { text: `ID: ${faction.id}` },
    }),
  );

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("FACTION:GIFTS").setLabel("Gifts").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("FACTION:LEADERBOARD").setLabel("Leaderboard").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("FACTION:DONATE")
      .setLabel(isMax ? "MAX" : "Donate")
      .setStyle(isMax ? ButtonStyle.Secondary : ButtonStyle.Success)
      .setDisabled(isMax),
  );

  if ("update" in interaction) {
    await interaction.update({ embeds: [embed], components: [row] });
  } else {
    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  }
}
