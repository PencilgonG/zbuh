import { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from "discord.js";
import { mygEmbedBase } from "../utils/embeds";
import { matchValidateId } from "./ids";

export function buildMatchEmbed(opts: {
  lobbyName: string;
  teamAName: string;
  teamBName: string;
  specUrl?: string | null;
}) {
  const { lobbyName, teamAName, teamBName, specUrl } = opts;

  const embed = new EmbedBuilder(
    mygEmbedBase({
      title: `Match — ${teamAName} vs ${teamBName}`,
      description: specUrl ? `🔭 **Spectateur**: ${specUrl}` : "_Lien spectateur en cours..._",
      footer: { text: lobbyName },
    })
  );

  return embed;
}

export function buildValidateRow(matchId: string) {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(matchValidateId(matchId))
      .setStyle(ButtonStyle.Success)
      .setLabel("✅ Valider le match")
  );
  return row;
}
