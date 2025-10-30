import type { ModalSubmitInteraction, ButtonInteraction } from "discord.js";
import { renderTeamBuilder } from "../commands/lobby/team-builder.js";
import { getStateForChannel } from "./selects.js";

export async function onModal(i: ModalSubmitInteraction) {
  if (i.customId !== "modal:tb:name") return;

  const state = getStateForChannel(i.channelId);
  if (!state)
    return i.reply({
      content: "Session Team Builder introuvable.",
      ephemeral: true,
    });

  const val = i.fields.getTextInputValue("modal:tb:name:value").trim();
  const teamNo = state.lastSelectedTeam ?? 1;
  const team = state.teams.find((t) => t.number === teamNo);
  if (!team) return i.reply({ content: "Équipe inconnue.", ephemeral: true });

  team.name = val || team.name;

  await i.deferReply({ ephemeral: true });
  return i.editReply(renderTeamBuilder(state));
}
