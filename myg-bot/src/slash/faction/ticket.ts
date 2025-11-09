import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";
import { prisma } from "../../prismat";

export const data = new SlashCommandBuilder()
  .setName("faction-ticket")
  .setDescription("Utiliser un ticket de faction (leader uniquement)")
  .addSubcommand((sc) =>
    sc
      .setName("champion")
      .setDescription("Utiliser un ticket de champion réservé"),
  )
  .addSubcommand((sc) =>
    sc
      .setName("duel")
      .setDescription("Utiliser un ticket de duel"),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand(true);
  const userId = interaction.user.id;

  const profile = await prisma.userProfile.findUnique({
    where: { discordId: userId },
    include: { faction: true },
  });
  if (!profile?.faction)
    return interaction.reply({ content: "❌ Tu n’as pas de faction.", ephemeral: true });

  const factionId = profile.faction.id;

  // Leader = plus de points dans la faction
  const top = await prisma.pointsLedger.groupBy({
    by: ["discordId"],
    _sum: { points: true },
    where: { discordId: { in: (await prisma.userProfile.findMany({ where: { factionId } })).map(m => m.discordId) } },
  });
  const leader = top.sort((a,b)=>(b._sum.points??0)-(a._sum.points??0))[0]?.discordId;
  if (leader !== userId)
    return interaction.reply({ content: "🚫 Seul le leader de faction peut utiliser ce ticket.", ephemeral: true });

  const state = await prisma.factionState.findUnique({ where: { factionId } });
  if (!state) return interaction.reply({ content: "Erreur interne.", ephemeral: true });

  if (sub === "champion") {
    if (state.championTickets <= 0)
      return interaction.reply({ content: "❌ Aucun ticket de champion disponible.", ephemeral: true });

    await prisma.factionState.update({
      where: { factionId },
      data: { championTickets: { decrement: 1 } },
    });
    return interaction.reply({
      content: `✅ Ticket de champion utilisé ! Tu peux maintenant réserver un **champion régional** pour ta faction.`,
      ephemeral: true,
    });
  }

  if (sub === "duel") {
    if (state.duelTickets <= 0)
      return interaction.reply({ content: "❌ Aucun ticket de duel disponible.", ephemeral: true });

    await prisma.factionState.update({
      where: { factionId },
      data: { duelTickets: { decrement: 1 } },
    });
    return interaction.reply({
      content: `⚔️ Ticket de duel utilisé ! Tu peux maintenant défier une autre faction.`,
      ephemeral: true,
    });
  }
}
