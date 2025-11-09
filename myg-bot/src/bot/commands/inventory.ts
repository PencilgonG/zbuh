import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  StringSelectMenuBuilder,
  ActionRowBuilder,
  StringSelectMenuInteraction,
  EmbedBuilder,
} from "discord.js";
import { prisma } from "../../prismat";
import { ConsumableType } from "@prisma/client";

export const data = new SlashCommandBuilder()
  .setName("inventory")
  .setDescription("Inventaire joueur")
  .addSubcommand((sc) => sc.setName("use").setDescription("Utiliser un objet que tu possèdes"));

export async function execute(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand();
  if (sub === "use") {
    const stocks = await prisma.consumableStock.findMany({
      where: { userId: interaction.user.id, quantity: { gt: 0 } },
      orderBy: { type: "asc" },
    });
    if (!stocks.length) return interaction.reply({ content: "Ton inventaire est vide.", ephemeral: true });

    const opts = stocks.slice(0, 25).map((s) => ({
      label: `${s.type} ×${s.quantity}`,
      value: s.type,
    }));
    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder().setCustomId("INV:USE").setPlaceholder("Choisir un objet à utiliser…").addOptions(opts),
    );
    return interaction.reply({ components: [row], ephemeral: true });
  }
  return interaction.reply({ content: "Commande inconnue.", ephemeral: true });
}

export async function handleInventorySelect(inter: StringSelectMenuInteraction) {
  if (inter.customId !== "INV:USE") return;
  const type = inter.values[0] as ConsumableType;

  const stock = await prisma.consumableStock.findUnique({
    where: { userId_type: { userId: inter.user.id, type } },
  });
  if (!stock || stock.quantity <= 0) {
    return inter.reply({ content: "Objet indisponible.", ephemeral: true });
  }

  // MVP: seule action concrète — ouvrir un Coffre I (simple message et décrément)
  await prisma.consumableStock.update({
    where: { userId_type: { userId: inter.user.id, type } },
    data: { quantity: { decrement: 1 } },
  });

  const embed = new EmbedBuilder()
    .setTitle("🎒 Utilisation d’objet")
    .setDescription(`Tu as utilisé **${type}**. (MVP — effets avancés à venir)`);
  return inter.reply({ embeds: [embed], ephemeral: true });
}
