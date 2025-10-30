import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} from "discord.js";
import { teamBuilderEmbed } from "../../utils/embeds.js";
import {
  CoreRole,
  TB_FINALIZE,
  TB_FORMAT,
  TB_NAME,
  TB_NEXT,
  TB_PREV,
  TB_SELECT_PLAYER,
  TB_SELECT_ROLE,
  TB_SELECT_TEAM,
  TB_SET_CAP,
} from "../../utils/constants.js";
import type { LobbyState } from "../../utils/lobby.js";

export function renderTeamBuilder(state: LobbyState) {
  const embeds = [teamBuilderEmbed(state)];

  // selects
  const selectTeam = new StringSelectMenuBuilder()
    .setCustomId(TB_SELECT_TEAM)
    .setPlaceholder("Choisir équipe")
    .addOptions(
      state.teams.map((t) => ({
        label: `Équipe ${t.number}`,
        value: String(t.number),
      }))
    );

  const roles: CoreRole[] = ["Top", "Jungle", "Mid", "ADC", "Support"];
  const selectRole = new StringSelectMenuBuilder()
    .setCustomId(TB_SELECT_ROLE)
    .setPlaceholder("Choisir rôle")
    .addOptions(roles.map((r) => ({ label: r, value: r })));

  const selectPlayer = new StringSelectMenuBuilder()
    .setCustomId(TB_SELECT_PLAYER)
    .setPlaceholder("Choisir joueur (pool)")
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      (state.pool.length ? state.pool : ["_"]).map((u) =>
        typeof u === "string"
          ? {
              label: u.startsWith("0") ? `fake-${u.slice(-3)}` : u,
              value: u,
              description: "sélectionne pour assigner",
            }
          : { label: "_", value: "_" }
      )
    );

  const rowSel1 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    selectTeam
  );
  const rowSel2 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    selectRole
  );
  const rowSel3 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    selectPlayer
  );

  // buttons
  const rowNav = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(TB_PREV)
      .setLabel("⏮ Précédent")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(TB_NEXT)
      .setLabel("Suivant ⏭")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(TB_SET_CAP)
      .setLabel("⭐ Capitaine")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(TB_NAME)
      .setLabel("✏️ Nom")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(TB_FORMAT)
      .setLabel("🏁 Format")
      .setStyle(ButtonStyle.Primary)
  );

  const rowFinal = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(TB_FINALIZE)
      .setLabel("✅ Finaliser")
      .setStyle(ButtonStyle.Success)
  );

  const components = [rowSel1, rowSel2, rowSel3, rowNav, rowFinal];
  return { embeds, components };
}
