import {
  ChatInputCommandInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from "discord.js";
import { prisma } from "../../prismat";
import { isMaxFactionLevel } from "../../utils/factions";

/**
 * Ouvre un modal "Donate" si la faction n'est pas MAX (L30).
 * Garde-fous min/max et limites journalières à valider côté handle du submit (existant chez toi).
 */
export async function handleFactionDonate(interaction: ChatInputCommandInteraction) {
  const profile = await prisma.userProfile.findUnique({
    where: { discordId: interaction.user.id },
    include: { faction: true },
  });

  if (!profile?.factionId) {
    return interaction.reply({ content: "Tu n’as pas de faction.", ephemeral: true });
  }

  const faction = await prisma.faction.findUnique({ where: { id: profile.factionId } });
  const level = (faction as any)?.level ?? 1;

  if (isMaxFactionLevel(level)) {
    return interaction.reply({
      content: "La faction est **niveau 30 (MAX)** — les dons ne sont plus acceptés.",
      ephemeral: true,
    });
  }

  const modal = new ModalBuilder()
    .setCustomId("FACTION:DONATE:MODAL")
    .setTitle("Donner des Points MYG (1–20)");

  const amount = new TextInputBuilder()
    .setCustomId("amount")
    .setLabel("Montant à donner")
    .setPlaceholder("Entre 1 et 20")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const row = new ActionRowBuilder<TextInputBuilder>().addComponents(amount);
  modal.addComponents(row);

  await interaction.showModal(modal);
}
