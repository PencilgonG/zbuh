import type { ButtonInteraction, GuildMember } from "discord.js";
import {
  StringSelectMenuBuilder,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import {
  get,
  toggleJoin,
  buildPoolFromSlots,
  ensureTeams,
  setCaptain,
  rememberState, // mapping channelId -> lobbyMessageId
} from "../utils/lobby.js";
import {
  BTN_VALIDATE_ID,
  BTN_FAKE_ID,
  ROLES,
  RoleName,
  TB_PREV,
  TB_NEXT,
  TB_SET_CAP,
  TB_NAME,
  TB_FORMAT,
  TB_FINALIZE,
  TB_SET_CAP_TEAM,
  TB_NAME_TEAM,
} from "../utils/constants.js";
import { lobbyEmbed, lineupEmbed } from "../utils/embeds.js";
import { isRespo } from "../utils/roles.js";
import { renderTeamBuilder } from "../commands/lobby/team-builder.js";
import { config } from "dotenv";

config();
const LINEUP = process.env.LINEUP_CHANNEL_ID!;

function idToRole(customId: string): RoleName | null {
  const match = customId.split(":");
  if (match[0] !== "lobby" || match[1] !== "join") return null;
  const role = match[2] as RoleName;
  return ROLES.includes(role) ? role : null;
}

// ===== Waiting room buttons (v1)
export async function onButton(i: ButtonInteraction) {
  const state = get(i.message.id);

  // join/leave
  const role = idToRole(i.customId);
  if (role && state) {
    const res = toggleJoin(state, role, i.user.id);
    if (!res.ok)
      return i.reply({ content: `❌ ${res.reason}`, ephemeral: true });

    return i.update({
      embeds: [
        lobbyEmbed({
          name: state.name,
          mode: state.mode,
          teamCount: state.teamCount,
          slots: state.slots,
          caps: state.caps,
        }),
      ],
    });
  }

  // validate -> open team builder (respo only)
  if (i.customId === BTN_VALIDATE_ID && state) {
    const member = i.member as GuildMember | null;
    if (!isRespo(member))
      return i.reply({
        content: "❌ Réservé aux responsables.",
        ephemeral: true,
      });

    buildPoolFromSlots(state);
    ensureTeams(state, state.teamCount);

    // mémorise le mapping pour les réponses éphémères TB
    rememberState(i.channelId, state.messageId);

    const ui = renderTeamBuilder(state);
    return i.reply({ ...ui, ephemeral: true });
  }

  // fake -> fill (respo only)
  if (i.customId === BTN_FAKE_ID && state) {
    const member = i.member as GuildMember | null;
    if (!isRespo(member))
      return i.reply({
        content: "❌ Réservé aux responsables.",
        ephemeral: true,
      });

    const addFake = (n: number, role: RoleName) => {
      for (let k = 0; k < n; k++) {
        toggleJoin(
          state,
          role,
          `00000000000000${Math.floor(Math.random() * 1000)}`
        );
      }
    };
    (["Top", "Jungle", "Mid", "ADC", "Support", "Flex"] as RoleName[]).forEach(
      (r) => addFake(1, r)
    );
    addFake(3, "Sub");

    return i.update({
      embeds: [
        lobbyEmbed({
          name: state.name,
          mode: state.mode,
          teamCount: state.teamCount,
          slots: state.slots,
          caps: state.caps,
        }),
      ],
    });
  }

  if (!state) {
    return i.reply({ content: "Session lobby introuvable.", ephemeral: true });
  }
}

// ===== Team Builder buttons on ephemeral reply (v2)
export async function onTeamBuilderButton(
  i: ButtonInteraction,
  state?: ReturnType<typeof get>
) {
  if (!state) return;

  if (i.customId === TB_PREV) {
    state.page = Math.max(1, state.page - 1);
    return i.update(renderTeamBuilder(state));
  }
  if (i.customId === TB_NEXT) {
    const maxPage = Math.max(1, Math.ceil(state.teamCount / 2));
    state.page = Math.min(maxPage, state.page + 1);
    return i.update(renderTeamBuilder(state));
  }

  // ⭐ Capitaine → 1) Select équipe, puis select joueur (géré dans selects.ts)
  if (i.customId === TB_SET_CAP) {
    const teamSelect = new StringSelectMenuBuilder()
      .setCustomId(TB_SET_CAP_TEAM)
      .setPlaceholder("Choisir l'équipe pour le capitaine")
      .addOptions(
        state.teams.map((t) => ({
          label: `Équipe ${t.number} (${t.name})`,
          value: String(t.number),
        }))
      );
    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      teamSelect
    );
    return i.reply({ components: [row], ephemeral: true });
  }

  // ✏️ Nom
  if (i.customId === TB_NAME) {
    if (state.lastSelectedTeam) {
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
    const teamSelect = new StringSelectMenuBuilder()
      .setCustomId(TB_NAME_TEAM)
      .setPlaceholder("Choisir l'équipe à renommer")
      .addOptions(
        state.teams.map((t) => ({
          label: `Équipe ${t.number} (${t.name})`,
          value: String(t.number),
        }))
      );
    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      teamSelect
    );
    return i.reply({ components: [row], ephemeral: true });
  }

  // 🏁 Format (select)
  if (i.customId === TB_FORMAT) {
    const select = new StringSelectMenuBuilder()
      .setCustomId("tb:format:select")
      .setPlaceholder("Choisir un format")
      .addOptions(
        { label: "2 équipes — Bo1", value: "2t-bo1" },
        { label: "2 équipes — Bo3", value: "2t-bo3" },
        { label: "2 équipes — Bo5", value: "2t-bo5" },
        { label: "4 équipes — 1 game (RR)", value: "4t-1g" },
        { label: "4 équipes — 2 games (RR)", value: "4t-2g" },
        { label: "4 équipes — 3 games (RR)", value: "4t-3g" },
        { label: "6 équipes — 1 game (RR)", value: "6t-1g" },
        { label: "6 équipes — 2 games (RR)", value: "6t-2g" },
        { label: "6 équipes — 3 games (RR)", value: "6t-3g" }
      );
    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      select
    );
    return i.reply({ components: [row], ephemeral: true });
  }

  // ✅ Finaliser : vérifs + envoi Line-up + lancement V3
  if (i.customId === TB_FINALIZE) {
    for (const t of state.teams) {
      const missing = Object.values(t.slots).some((v) => !v);
      if (missing)
        return i.reply({
          content: `❌ Slots incomplets pour ${t.name}.`,
          ephemeral: true,
        });
      if (!t.captainId)
        return i.reply({
          content: `❌ Capitaine manquant pour ${t.name}.`,
          ephemeral: true,
        });
    }
    if (!state.format)
      return i.reply({ content: "❌ Choisis un format.", ephemeral: true });

    const guild = i.guild!;
    const matchChannelId = process.env.MATCH_CHANNEL_ID!;
    const lineUp = guild.channels.cache.get(LINEUP);
    if (!lineUp || !lineUp.isTextBased()) {
      return i.reply({
        content: "❌ Salon line-up introuvable.",
        ephemeral: true,
      });
    }

    // 🧾 Récap Line-up (comme avant)
    await lineUp.send({ embeds: [lineupEmbed(state)] });

    // V3: créer catégories + ouvrir Match 1
    await i.deferReply({ ephemeral: true });
    try {
      await (
        await import("../utils/lobby.js")
      ).finalizeLobbyAndOpenFirstMatch(state, guild, matchChannelId);
      await i.editReply({
        content:
          "✅ Line-up envoyée + Match 1 lancé dans le salon match. Catégories d'équipes créées.",
      });
    } catch (e) {
      await i.editReply({
        content: "❌ Erreur lors de l'initialisation des matchs.",
      });
      throw e;
    }
    return;
  }
}
