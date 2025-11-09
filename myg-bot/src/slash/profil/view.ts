// src/slash/profil/view.ts
import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  EmbedBuilder,
  inlineCode,
  User,
} from "discord.js";
import { prisma } from "../../prismat";
import { mygEmbedBase } from "../../utils/embeds";
import { env } from "../../env";
import { getFactionTheme, type FactionKey } from "../../utils/factions";

// -------- Helpers ------------------------------------------------------------

function normalizeFactionKey(name?: string | null): FactionKey | null {
  if (!name) return null;
  const n = name.trim().toUpperCase();
  const map: Record<string, FactionKey> = {
    DEMACIA: "DEMACIA",
    NOXUS: "NOXUS",
    IONIA: "IONIA",
    FRELJORD: "FRELJORD",
    PILTOVER: "PILTOVER",
    SHURIMA: "SHURIMA",
    ZAUN: "ZAUN",
  };
  return map[n] ?? null;
}

function labelize(s?: string | null) {
  if (!s) return "—";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

// Sans emoji, comme demandé
function roleLabel(role?: string | null) {
  switch (role) {
    case "TOP": return "TOP";
    case "JGL": return "JGL";
    case "MID": return "MID";
    case "ADC": return "ADC";
    case "SUPP": return "SUP";
    case "SUB": return "SUB";
    default: return "—";
  }
}

function linkOrDash(url?: string | null, label?: string) {
  if (!url) return "—";
  return label ? `[${label}](${url})` : url;
}

// -------- Slash --------------------------------------------------------------

export const data = new SlashCommandBuilder()
  .setName("profil")
  .setDescription("Profil joueur")
  .addSubcommand((sc) =>
    sc
      .setName("view")
      .setDescription("Voir un profil (le tien par défaut)")
      .addUserOption((o) =>
        o.setName("user").setDescription("Joueur dont tu veux voir le profil"),
      ),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand(true);
  if (sub === "view") return handleProfilView(interaction);
  return interaction.reply({ content: "Sous-commande inconnue.", ephemeral: true });
}

// -------- Handler ------------------------------------------------------------

export async function handleProfilView(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  // 🔹 Cible : l’option `user` si fournie, sinon l’auteur
  const target: User = interaction.options.getUser("user") ?? interaction.user;
  const targetId = target.id;

  // Profil + relations utiles
  const profile = await prisma.userProfile.findUnique({
    where: { discordId: targetId },
    include: {
      faction: true,
      activeTitle: true as any,
      titles: { include: { title: true } } as any,
      consumables: true as any,
    },
  });

  if (!profile) {
    return interaction.editReply({
      content:
        target.id === interaction.user.id
          ? "❌ Tu n’as pas encore de profil."
          : "❌ Ce joueur n’a pas encore de profil.",
    });
  }

  // Total points MYG (cible)
  const agg = await prisma.pointsLedger.aggregate({
    _sum: { points: true },
    where: { discordId: targetId },
  });
  const mygPoints = agg._sum.points ?? 0;

  // Thème (clé depuis faction.key ou nom)
  const factionKey =
    normalizeFactionKey((profile as any).faction?.key ?? profile.faction?.name ?? null);
  const theme = getFactionTheme(factionKey ?? undefined);

  // Avatar (cible)
  const avatar =
    target.displayAvatarURL({ extension: "png", size: 256 }) ??
    target.displayAvatarURL();

  // Actif + titres
  const activeTitle = (profile as any).activeTitle?.name ?? "—";
  const ownedTitles =
    Array.isArray((profile as any).titles) && (profile as any).titles.length
      ? (profile as any).titles.map((t: any) => t.title?.name).filter(Boolean)
      : [];
  const titlesBlock = ownedTitles.length ? "• " + ownedTitles.join("\n• ") : "—";

  // Consommables
  const consumables =
    Array.isArray((profile as any).consumables) && (profile as any).consumables.length
      ? (profile as any).consumables
      : [];
  const consumablesBlock = consumables.length
    ? consumables
        // compat ES2020 : pas de replaceAll
        .map((i: any) => `• ${String(i.type).replace(/_/g, " ")} ×${i.quantity}`)
        .join("\n")
    : "—";

  // Champs /profil set
  const summoner = profile.summonerName ?? "—";
  const elo = labelize(profile.elo as unknown as string);
  const main = roleLabel(profile.mainRole as unknown as string);
  const secondary = roleLabel(profile.secondaryRole as unknown as string);
  const opgg = linkOrDash(profile.opggUrl, "OP.GG");
  const dpm = linkOrDash(profile.dpmUrl, "DPM");

  // ---- Embed (couleur + bannière de région) --------------------------------
  const base = mygEmbedBase({
    title: `Myg ${theme.name}`,
    footer: { text: `ID: ${profile.discordId}` },
  });

  const embed = new EmbedBuilder(base)
    .setColor(theme.color)
    .setThumbnail(avatar)
    .addFields(
      { name: "Faction", value: profile.faction?.name ?? "—", inline: true },
      { name: "Titre actif", value: activeTitle, inline: true },
      { name: "\u200B", value: "\u200B", inline: true },

      { name: "Invocateur", value: summoner, inline: true },
      { name: "ELO", value: elo, inline: true },
      { name: "Points MYG", value: inlineCode(String(mygPoints)), inline: true },

      { name: "Rôle principal", value: main, inline: true },
      { name: "Second rôle", value: secondary, inline: true },
      { name: "\u200B", value: "\u200B", inline: true },

      { name: "OP.GG", value: opgg, inline: true },
      { name: "DPM", value: dpm, inline: true },
      { name: "\u200B", value: "\u200B", inline: true },
    )
    .addFields(
      { name: "Titres possédés", value: titlesBlock, inline: false },
      { name: "Consommables", value: consumablesBlock, inline: false },
    );

  const bannerUrl =
    (factionKey ? theme.bannerUrl : undefined) || env.BANNER_URL || "";
  if (bannerUrl) embed.setImage(bannerUrl);

  return interaction.editReply({ embeds: [embed] });
}
