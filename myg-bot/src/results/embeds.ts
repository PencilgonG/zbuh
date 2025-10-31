import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { prisma } from "../prisma";
import { mygEmbedBase } from "../utils/embeds";
import { resultWinId, resultFinalizeId } from "./ids";

export async function buildResultsPanel(lobbyId: string) {
  const lobby = await prisma.lobby.findUnique({
    where: { id: lobbyId },
    include: { matches: { include: { teamA: true, teamB: true } } },
  });
  if (!lobby) throw new Error("Lobby introuvable");

  const embed = new EmbedBuilder(
    mygEmbedBase({
      title: `Résultats — ${lobby.name}`,
      description: `Cliquez pour définir les vainqueurs de chaque match.\nQuand tous sont définis, validez en bas.`,
    })
  );

  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (const m of lobby.matches.sort((a,b)=>a.round-b.round)) {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(resultWinId(m.id, m.teamAId)).setStyle(ButtonStyle.Primary).setLabel(`Victoire ${m.teamA.name}`),
      new ButtonBuilder().setCustomId(resultWinId(m.id, m.teamBId)).setStyle(ButtonStyle.Danger).setLabel(`Victoire ${m.teamB.name}`)
    );
    rows.push(row);
  }

  const finalize = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(resultFinalizeId(lobbyId)).setStyle(ButtonStyle.Success).setLabel("Valider les résultats")
  );
  rows.push(finalize);

  return { embed, components: rows };
}
