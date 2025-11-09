// src/slash/inventory.ts
import { ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { prisma } from "../prismat";
import { mygEmbedBase } from "../utils/embeds";

// Optionnel : jolis libellés pour les enums de consommables
const CONSUMABLE_LABEL: Record<string, string> = {
  BAN_PLUS_ONE: "Ban +1 (armable)",
  DOUBLE_IMPOSTOR_VOTE: "Vote imposteur ×2",
  DOUBLE_POINTS_TOKEN: "Jeton points doubles (armable)",
  FACTION_TRANSFER: "Transfert de faction",
  FACTION_CHEST_I: "Coffre de faction I",
  TITLE_TOKEN_COMMON: "Jeton de titre (commun)",
  TITLE_TOKEN_RARE: "Jeton de titre (rare)",
  TITLE_TOKEN_EPIC: "Jeton de titre (épique)",
};

export async function handleInventory(interaction: ChatInputCommandInteraction) {
  const discordId = interaction.user.id;

  // Récupère le profil + relations utiles
  const profile = await prisma.userProfile.findUnique({
    where: { discordId },
    include: {
      titles: { include: { title: true } }, // UserTitle[] avec .title
      consumables: true,                    // ConsumableStock[]
      faction: true,                        // Faction | null
      activeTitle: true,                    // Title | null
    },
  });

  if (!profile) {
    await interaction.reply({
      content: "Tu n'as pas encore de profil. Utilise `/profil set` pour en créer un.",
      ephemeral: true,
    });
    return;
  }

  // Titres possédés
  const ownedTitles = profile.titles ?? [];
  const active = profile.activeTitle?.name ?? "—";
  const titlesText =
    ownedTitles.length > 0
      ? ownedTitles
          .map((t) => {
            const name = t.title?.name ?? "Titre inconnu";
            return profile.activeTitleId === t.titleId ? `• **${name}** *(actif)*` : `• ${name}`;
          })
          .join("\n")
      : "_Aucun titre possédé_";

  // Consommables
  const consumables = profile.consumables ?? [];
  const consumablesText =
    consumables.length > 0
      ? consumables
          .map((c) => {
            const label = CONSUMABLE_LABEL[c.type] ?? c.type;
            return `• ${label} ×${c.quantity}`;
          })
          .join("\n")
      : "_Aucun consommable_";

  // Faction
  const factionName = profile.faction?.name ?? "—";

  // Embed
  const embed = new EmbedBuilder(
    mygEmbedBase({
      title: `Inventaire — ${interaction.user.username}`,
      description:
        "Résumé de tes titres et consommables. Utilise ensuite `/title use` (à venir) pour **activer** un titre.",
      fields: [
        { name: "Faction", value: factionName, inline: true },
        { name: "Titre actif", value: active, inline: true },
        { name: "\u200B", value: "\u200B", inline: true },

        { name: "🎖️ Titres possédés", value: titlesText, inline: false },
        { name: "🧪 Consommables", value: consumablesText, inline: false },
      ],
    }),
  );

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
