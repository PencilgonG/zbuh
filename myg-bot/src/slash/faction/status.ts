// src/slash/faction/status.ts
import { ChatInputCommandInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { prisma } from "../../prismat";
import { getFactionTheme, costForNextLevel, isMaxFactionLevel } from "../../utils/factions";
import { mygEmbedBase } from "../../utils/embeds";

export async function handleFactionStatus(interaction: ChatInputCommandInteraction) {
  // Récup profil + faction
  const profile = await prisma.userProfile.findUnique({
    where: { discordId: interaction.user.id },
    include: { faction: true },
  });

  if (!profile?.factionId) {
    const embed = new EmbedBuilder(
      mygEmbedBase({
        title: "Faction — Aucune faction",
        description: "Tu n’as pas encore rejoint de faction. Utilise `/faction join` pour en choisir une.",
      })
    );
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  const faction = await prisma.faction.findUnique({
    where: { id: profile.factionId },
  });

  if (!faction) {
    const embed = new EmbedBuilder(
      mygEmbedBase({
        title: "Faction — Introuvable",
        description: "Erreur: faction inexistante.",
      })
    );
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  const theme = getFactionTheme((profile.faction as any)?.key ?? null);

  // État de progression (depuis factionState si présent)
  const state = await prisma.factionState.findUnique({ where: { factionId: faction.id } }).catch(() => null);
  const level = state?.level ?? (faction as any).level ?? 1;
  const progress = state?.progress ?? (faction as any).progress ?? 0;
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

    desc =
      `**Niveau actuel :** ${level}\n` +
      `**Progression :** ${bar} ${pct}%\n` +
      `**Coût palier :** ${nextCost} pts`;
  }

  // Membres (par pseudo)
  const members = await prisma.userProfile.findMany({
    where: { factionId: faction.id },
    select: { summonerName: true, discordId: true },
    orderBy: { summonerName: "asc" },
  });
  const membersText =
    members.length > 0
      ? members.map(m => `• ${m.summonerName ?? `<@${m.discordId}>`}`).join("\n").slice(0, 1024) // cap champ embed
      : "_Aucun membre_";

  // Champions acquis : supporte table factionChampion si elle existe ; sinon fallback championReserved
  let championsText = "_Aucun_";
  try {
    const anyPrisma: any = prisma as any;
    if (anyPrisma.factionChampion?.findMany) {
      const champs = await anyPrisma.factionChampion.findMany({
        where: { factionId: faction.id },
        orderBy: { acquiredAt: "asc" },
      });
      championsText = champs.length ? champs.map((c: any) => `• ${c.name ?? c.key ?? "Champion"}`).join("\n").slice(0, 1024) : "_Aucun_";
    } else {
      const reserved = state?.championReserved ?? (faction as any)?.championReserved ?? null;
      championsText = reserved ? `• ${reserved}` : "_Aucun_";
    }
  } catch {
    const reserved = state?.championReserved ?? (faction as any)?.championReserved ?? null;
    championsText = reserved ? `• ${reserved}` : "_Aucun_";
  }

  const embed = new EmbedBuilder(
    mygEmbedBase({
      title: `Faction — ${faction.name ?? theme.name}`,
      description: desc,
      color: theme.color,
      ...(theme.bannerUrl ? { image: { url: theme.bannerUrl } } : {}),
      footer: { text: `ID: ${faction.id}` },
      fields: [
        { name: "👥 Membres", value: membersText, inline: false },
        { name: "🏆 Champions acquis", value: championsText, inline: false },
      ],
    })
  );

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("FACTION:GIFTS")
      .setLabel("Gifts")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("FACTION:LEADERBOARD")
      .setLabel("Leaderboard")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("FACTION:DONATE")
      .setLabel(isMax ? "MAX" : "Donate")
      .setStyle(isMax ? ButtonStyle.Secondary : ButtonStyle.Success)
      .setDisabled(isMax)
  );

  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}
