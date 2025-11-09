// src/bot/commands/admin-factions.ts
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  EmbedBuilder,
} from "discord.js";
import { prisma } from "../../prismat";

const FACTIONS = [
  "DEMACIA",
  "NOXUS",
  "IONIA",
  "FRELJORD",
  "PILTOVER",
  "SHURIMA",
  "ZAUN",
] as const;
type FactionName = (typeof FACTIONS)[number];

export const data = new SlashCommandBuilder()
  .setName("admin-factions")
  .setDescription("Administration des factions (reset points/bonus/inventaire)")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setDMPermission(false)
  .addSubcommand((sc) =>
    sc
      .setName("reset_all")
      .setDescription(
        "Réinitialiser TOUTES les factions (points, bonus, inventaire de faction, champions achetés)"
      ),
  )
  .addSubcommand((sc) =>
    sc
      .setName("reset_one")
      .setDescription(
        "Réinitialiser UNE faction (points, bonus, inventaire de faction, champions achetés)"
      )
      .addStringOption((opt) =>
        opt
          .setName("name")
          .setDescription("Nom de la faction")
          .setRequired(true)
          .addChoices(...FACTIONS.map((f) => ({ name: f, value: f }))),
      ),
  );

export async function execute(inter: ChatInputCommandInteraction) {
  const sub = inter.options.getSubcommand(true);

  await inter.deferReply({ ephemeral: true });

  try {
    if (sub === "reset_all") {
      const factions = await prisma.faction.findMany({ select: { id: true, name: true } });

      await prisma.$transaction(async (tx) => {
        for (const f of factions) {
          // Remise à zéro des points globaux de la faction
          await tx.faction.update({
            where: { id: f.id },
            data: { totalPoints: 0 },
          });

          // Purge de l'inventaire "coffres" côté faction
          await tx.factionChest.deleteMany({ where: { factionId: f.id } });

          // Réinitialisation des bonus/état + effacement des champions achetés
          await tx.factionState.upsert({
            where: { factionId: f.id },
            update: {
              level: 1,
              progress: 0,
              discountPct: 0,
              championTickets: 0,
              duelTickets: 0,
              ...( { championReserved: null } as any ),
            },
            create: {
              factionId: f.id,
              level: 1,
              progress: 0,
              discountPct: 0,
              championTickets: 0,
              duelTickets: 0,
              ...( { championReserved: null } as any ),
            },
          });
        }
      });

      const embed = new EmbedBuilder()
        .setTitle("✅ Reset factions (global)")
        .setDescription(
          "• Points remis à **0**\n" +
            "• **Inventaire de faction** vidé (coffres)\n" +
            "• **Bonus** réinitialisés (réduc 0%, tickets 0)\n" +
            "• **Champions achetés effacés**\n\n" +
            "Les inventaires **joueurs** ne sont pas touchés."
        )
        .setColor(0x2ecc71);

      return inter.editReply({ embeds: [embed] });
    }

    if (sub === "reset_one") {
      const name = inter.options.getString("name", true) as FactionName;

      const faction = await prisma.faction.findFirst({
        where: { name },
        select: { id: true, name: true },
      });
      if (!faction) {
        return inter.editReply({ content: `❌ Faction **${name}** introuvable.` });
      }

      await prisma.$transaction(async (tx) => {
        await tx.faction.update({
          where: { id: faction.id },
          data: { totalPoints: 0 },
        });

        await tx.factionChest.deleteMany({ where: { factionId: faction.id } });

        await tx.factionState.upsert({
          where: { factionId: faction.id },
          update: {
            level: 1,
            progress: 0,
            discountPct: 0,
            championTickets: 0,
            duelTickets: 0,
            ...( { championReserved: null } as any ),
          },
          create: {
            factionId: faction.id,
            level: 1,
            progress: 0,
            discountPct: 0,
            championTickets: 0,
            duelTickets: 0,
            ...( { championReserved: null } as any ),
          },
        });
      });

      const embed = new EmbedBuilder()
        .setTitle("✅ Reset faction (unitaire)")
        .setDescription(
          `**${faction.name}** a été réinitialisée :\n` +
            "• Points = **0**\n" +
            "• Inventaire de faction vidé\n" +
            "• Bonus remis à zéro\n" +
            "• **Champions achetés effacés**"
        )
        .setColor(0x2ecc71);

      return inter.editReply({ embeds: [embed] });
    }

    return inter.editReply({ content: "Sous-commande inconnue." });
  } catch (err) {
    console.error(err);
    return inter.editReply({ content: "❌ Erreur pendant le reset. Regarde les logs." });
  }
}
