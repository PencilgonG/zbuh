import { ChannelType, ChatInputCommandInteraction, Guild, TextChannel } from "discord.js";
import { prisma } from "../prisma";

export async function createTeamCategories(inter: ChatInputCommandInteraction | any, lobbyId: string) {
  const lobby = await prisma.lobby.findUnique({
    where: { id: lobbyId },
    include: { teamsList: true },
  });
  if (!lobby) return;

  const guild = inter.guild as Guild | null;
  if (!guild) return;

  for (const team of lobby.teamsList) {
    const category = await guild.channels.create({
      name: `MYG — ${team.name}`,
      type: ChannelType.GuildCategory,
    });
    await guild.channels.create({
      name: `text-${team.name}`.toLowerCase().replace(/\s+/g, "-"),
      type: ChannelType.GuildText,
      parent: category.id,
    });
    await guild.channels.create({
      name: `voice-${team.name}`.toLowerCase().replace(/\s+/g, "-"),
      type: ChannelType.GuildVoice,
      parent: category.id,
    });
  }
}
