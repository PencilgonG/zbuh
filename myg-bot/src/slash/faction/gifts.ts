import { ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { mygEmbedBase } from "../../utils/embeds";

/**
 * Affiche la table des paliers de 1..30 (cap).
 * Pagination par tranche de 10 niveaux : 1–10, 11–20, 21–30.
 * NB: Ici on se concentre sur le bornage à 30. Tu pourras brancher ta vraie table de rewards.
 */

type Gift = string; // description courte

const RANGE_SIZE = 10;
const MIN_LEVEL = 1;
const MAX_LEVEL = 30;

function rangePageBounds(page: number) {
  const start = (page - 1) * RANGE_SIZE + 1;
  const end = Math.min(MAX_LEVEL, start + RANGE_SIZE - 1);
  return { start, end };
}

// Exemple de mappage de paliers -> cadeaux (placeholder à adapter à ta table finale)
function giftsForLevel(L: number): Gift[] {
  // Paliers majeurs (10/20/30)
  if (L === 10 || L === 20 || L === 30) return ["Réservation de champion régional (1) — 'champion claim'"];

  // 15 et 25
  if (L === 15 || L === 25) return ["Ticket de duel"];

  // Sinon placeholders (à remplacer par ta vraie logique aléatoire/pooled)
  return ["Coffre de faction I (loot aléatoire)"];
}

export async function handleFactionGifts(interaction: ChatInputCommandInteraction) {
  const levelArg = interaction.options.getInteger("niveau", false);
  if (levelArg) {
    if (levelArg < MIN_LEVEL || levelArg > MAX_LEVEL) {
      return interaction.reply({ content: `Niveau invalide. Choisis entre ${MIN_LEVEL} et ${MAX_LEVEL}.`, ephemeral: true });
    }
    const gifts = giftsForLevel(levelArg);
    const embed = new EmbedBuilder(
      mygEmbedBase({
        title: `Gifts — Palier L${levelArg}`,
        description: gifts.length ? "• " + gifts.join("\n• ") : "—",
      })
    );
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // pagination par défaut sur L1–10
  const page = 1;
  const { start, end } = rangePageBounds(page);

  const lines: string[] = [];
  for (let L = start; L <= end; L++) {
    const gifts = giftsForLevel(L);
    lines.push(`**L${L}** — ${gifts.join(" / ")}`);
  }

  const embed = new EmbedBuilder(
    mygEmbedBase({
      title: `Gifts — L${start} à L${end}`,
      description: lines.join("\n"),
      footer: { text: "Utilise les boutons pour naviguer (cap L30)" },
    })
  );

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("FGIFTS:PAGE:1").setLabel("L1–10").setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId("FGIFTS:PAGE:2").setLabel("L11–20").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("FGIFTS:PAGE:3").setLabel("L21–30").setStyle(ButtonStyle.Secondary),
  );

  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}
