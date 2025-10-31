import { ChatInputCommandInteraction, EmbedBuilder, TextChannel } from "discord.js";
import { prisma } from "../prisma";
import { env } from "../env";
import { mygEmbedBase } from "../utils/embeds";

export async function sendLineup(inter: ChatInputCommandInteraction | any, lobbyId: string) {
  const lobby = await prisma.lobby.findUnique({
    where: { id: lobbyId },
    include: {
      teamsList: { include: { members: { include: { participant: true } } } },
      participants: true,
    },
  });
  if (!lobby) return;

  const profiles = await prisma.userProfile.findMany({
    where: { discordId: { in: lobby.participants.map(p => p.discordId).filter((v): v is string => !!v) } },
  });
  const profById = new Map(profiles.map(p => [p.discordId, p]));

  const fmtTeam = (t: typeof lobby.teamsList[number]) => {
    const get = (r: string) => {
      const m = t.members.find(m => m.participant.role === r)?.participant;
      if (!m) return "—";
      const prof = m.discordId ? profById.get(m.discordId) : undefined;
      if (prof?.opggUrl) return `[${m.display}](${prof.opggUrl})`;
      return m.display;
    };
    const cap = t.captainId
      ? t.members.find(m => m.lobbyParticipantId === t.captainId)?.participant.display
      : undefined;
    return `**${t.name}**${cap ? ` (👑 ${cap})` : ""}\nTop: ${get("TOP")}\nJgl: ${get("JGL")}\nMid: ${get("MID")}\nAdc: ${get("ADC")}\nSupp: ${get("SUPP")}`;
  };

  const embed = new EmbedBuilder(
    mygEmbedBase({
      title: `Line-up — ${lobby.name}`,
      description: lobby.teamsList.map(fmtTeam).join("\n\n"),
      footer: { text: "Bonne chance & have fun !" },
    })
  );

  const ch = await inter.client.channels.fetch(env.LINEUP_CHANNEL_ID);
  const t = ch as TextChannel;
  await t.send({ embeds: [embed] });
}
