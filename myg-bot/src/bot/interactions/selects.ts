import type { StringSelectMenuInteraction } from "discord.js";
import {
  TB_SELECT_TEAM,
  TB_SELECT_ROLE,
  TB_SELECT_PLAYER,
  TB_SET_CAP_TEAM,
  TB_SET_CAP_PLAYER,
  TB_NAME_TEAM,
} from "../utils/constants.js";
import { assignPlayer, setCaptain } from "../utils/lobby.js";
import { renderTeamBuilder } from "../commands/lobby/team-builder.js";

// registre: dernier lobby par salon
const lastByChannel = new Map<string, string>(); // channelId -> lobbyMessageId
export function rememberState(channelId: string, lobbyMessageId: string) {
  lastByChannel.set(channelId, lobbyMessageId);
}

import { get as getState } from "../utils/lobby.js";
export function getStateForChannel(channelId: string | null) {
  if (!channelId) return undefined;
  const msgId = lastByChannel.get(channelId);
  if (!msgId) return undefined;
  return getState(msgId);
}

import {
  StringSelectMenuBuilder,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

export async function onSelect(i: StringSelectMenuInteraction) {
  const state = getStateForChannel(i.channelId);
  if (!state)
    return i.reply({
      content: "Session Team Builder introuvable.",
      ephemeral: true,
    });

  // === selects standards (team/role/player depuis pool)
  if (i.customId === TB_SELECT_TEAM) {
    state.lastSelectedTeam = Number(i.values[0]);
    return i.update(renderTeamBuilder(state));
  }

  if (i.customId === TB_SELECT_ROLE) {
    state.lastSelectedRole = i.values[0] as any;
    return i.update(renderTeamBuilder(state));
  }

  if (i.customId === TB_SELECT_PLAYER) {
    const userId = i.values[0];
    state.lastSelectedPlayer = userId;
    const teamNo = state.lastSelectedTeam ?? 1;
    const role = state.lastSelectedRole ?? "Top";
    const res = assignPlayer(state, teamNo, role, userId);
    if (!res.ok)
      return i.reply({ content: `❌ ${res.reason}`, ephemeral: true });
    return i.update(renderTeamBuilder(state));
  }

  // === Flow CAPITAINE
  if (i.customId === TB_SET_CAP_TEAM) {
    const teamNo = Number(i.values[0]);
    state.lastSelectedTeam = teamNo;
    const team = state.teams.find((t) => t.number === teamNo);
    if (!team) return i.reply({ content: "Équipe inconnue.", ephemeral: true });

    const options = Object.entries(team.slots)
      .map(([role, uid]) => (uid ? { label: `${role}`, value: uid } : null))
      .filter(Boolean) as { label: string; value: string }[];

    if (options.length === 0) {
      return i.update({
        content: "Aucun joueur dans cette équipe.",
        components: [],
      });
    }

    const selectPlayer = new StringSelectMenuBuilder()
      .setCustomId(TB_SET_CAP_PLAYER)
      .setPlaceholder("Choisir le capitaine")
      .addOptions(options);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      selectPlayer
    );
    return i.update({ components: [row] });
  }

  if (i.customId === TB_SET_CAP_PLAYER) {
    const userId = i.values[0];
    const teamNo = state.lastSelectedTeam ?? 1;
    const res = setCaptain(state, teamNo, userId);
    if (!res.ok)
      return i.reply({ content: `❌ ${res.reason}`, ephemeral: true });

    return i.update(renderTeamBuilder(state));
  }

  // === Flow NOM — ouvrir DIRECTEMENT le modal après sélection d'équipe
  if (i.customId === TB_NAME_TEAM) {
    state.lastSelectedTeam = Number(i.values[0]);

    const modal = new ModalBuilder()
      .setCustomId("modal:tb:name")
      .setTitle("Nom de l'équipe");
    const input = new TextInputBuilder()
      .setCustomId("modal:tb:name:value")
      .setLabel("Nouveau nom")
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(40);
    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(input);
    modal.addComponents(row);
    return i.showModal(modal);
  }

  // format select
  if (i.customId === "tb:format:select") {
    state.format = i.values[0];
    return i.update(renderTeamBuilder(state));
  }
}
