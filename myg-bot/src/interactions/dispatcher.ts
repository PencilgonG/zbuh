// src/interactions/dispatcher.ts
import type {
  ChatInputCommandInteraction,
  StringSelectMenuInteraction,
  ButtonInteraction,
  ModalSubmitInteraction,
  Interaction,
  GuildMember,
} from "discord.js";

// Profils
import { handleProfilSet } from "../slash/profil/set";
import { handleProfilView } from "../slash/profil/view";

// Lobbys (normal/surprise)
import { handleLobbyCreate } from "../slash/lobby/create";

// Classement
import { handleLeaderboard } from "../slash/leaderboard";

// Boutique / admin / factions / use (consommables existants)
import { execute as handleShop, handleShopSelect } from "../bot/commands/shop";
import { execute as handleAdminDev } from "../bot/commands/admin-dev";
import {
  execute as handleFaction,
  handleJoinSelect as handleFactionJoinSelect,
  handleJoinSubmit as handleFactionJoinSubmit,
} from "../bot/commands/faction";
import {
  execute as handleUse,
  handleUseSelect,
  handleUseTokenTitleSelect,
} from "../bot/commands/use";

// ✅ Admin (Respo only)
import { execute as handleAdmin } from "../bot/commands/admin";
import { execute as handleAdminFactions } from "../bot/commands/admin-factions";

// Battle Royale (commande séparée)
import { handleBrCreate } from "../battle/slash/create";

// Nouveaux: inventaire & titres
import { handleInventory } from "../slash/inventory";
import { handleTitleUse } from "../slash/title/use";

// ✅ Nouveau : debug command
import { execute as handleDebug } from "../slash/debug";

// Factions: modals/boutons (+ duel flow)
import {
  showFactionDonateModal,
  handleFactionDonateModal,
  handleDuelSelect,
  handleDuelSubmit,
  handleDuelMsgModal,
} from "./modals-faction";

import { env } from "../env";

/* ============ helpers rôle Respo ============ */
function hasRespoRole(interaction: ChatInputCommandInteraction): boolean {
  const roleId = env.ROLE_RESPO_ID;
  const member = interaction.member as GuildMember | null;
  if (!member || !member.roles) return false;
  return member.roles instanceof Array
    ? (member.roles as any[]).includes(roleId)
    : (member.roles as any).cache?.has?.(roleId) ?? false;
}

/* ================= Slash ================= */
export async function handleSlash(interaction: ChatInputCommandInteraction) {
  const name = interaction.commandName;

  if (name === "profil") {
    const sub = interaction.options.getSubcommand();
    if (sub === "set") return handleProfilSet(interaction);
    if (sub === "view") return handleProfilView(interaction);
  }

  if (name === "lobby") {
    if (!hasRespoRole(interaction)) {
      return interaction.reply({
        content: "⛔ Cette commande est réservée aux **responsables**.",
        ephemeral: true,
      });
    }
    return handleLobbyCreate(interaction);
  }

  if (name === "leaderboard") return handleLeaderboard(interaction);
  if (name === "shop") return handleShop(interaction);
  if (name === "use") return handleUse(interaction);
  if (name === "admin-dev") return handleAdminDev(interaction);
  if (name === "admin") return handleAdmin(interaction);
  if (name === "admin-factions") {
    if (!hasRespoRole(interaction)) {
      return interaction.reply({
        content: "⛔ Cette commande est réservée aux **responsables**.",
        ephemeral: true,
      });
    }
    return handleAdminFactions(interaction);
  }

  if (name === "faction") return handleFaction(interaction);

  if (name === "br") {
    const sub = interaction.options.getSubcommand();
    if (sub === "create") {
      if (!hasRespoRole(interaction)) {
        return interaction.reply({
          content: "⛔ Cette commande est réservée aux **responsables**.",
          ephemeral: true,
        });
      }
      return handleBrCreate(interaction);
    }
  }

  if (name === "inventory") return handleInventory(interaction);

  if (name === "title") {
    const sub = interaction.options.getSubcommand();
    if (sub === "use") return handleTitleUse(interaction);
  }

  // ✅ Nouveau : /debug
  if (name === "debug") return handleDebug(interaction);

  await interaction.reply({ content: "Commande inconnue.", ephemeral: true });
}

/* =============== Select menus =============== */
export async function handleSelect(interaction: StringSelectMenuInteraction) {
  // Shop selectors
  if (
    interaction.customId === "SHOP:TITLE" ||
    interaction.customId === "SHOP:CONS" ||
    interaction.customId === "SHOP:BUY:TITLE" ||
    interaction.customId === "SHOP:BUY:CONS"
  ) {
    return handleShopSelect(interaction);
  }

  // /use -> sélecteur d’objet
  if (interaction.customId === "USE:SELECT") {
    return handleUseSelect(interaction);
  }

  // Jeton titre commun -> sélection d’un titre
  if (interaction.customId === "USE:TOKEN_TITLE_COMMON_SELECT") {
    return handleUseTokenTitleSelect(interaction);
  }

  // Inventaire -> sélection d’objet (redirige vers le handler de /use)
  if (interaction.customId === "INV:USE") {
    return handleUseSelect(interaction);
  }

  // Duel — sélecteurs région/format
  if (interaction.customId.startsWith("DUEL:SELECT:")) {
    return handleDuelSelect(interaction);
  }

  // ✅ Faction join — sélecteur de région
  if (interaction.customId === "FACTION:JOIN:SELECT") {
    return handleFactionJoinSelect(interaction);
  }

  return interaction.reply({ content: "Sélecteur inconnu.", ephemeral: true });
}

/* ================= Buttons ================= */
export async function handleButton(interaction: ButtonInteraction) {
  const id = interaction.customId;

  if (id === "FACTION:DONATE") return showFactionDonateModal(interaction);

  if (id === "FACTION:GIFTS") {
    return interaction.reply({
      content: "📦 Les paliers sont visibles via `/faction gifts`.",
      ephemeral: true,
    });
  }

  if (id === "FACTION:LEADERBOARD") {
    return interaction.reply({
      content: "🏆 Bientôt: classement des factions. Utilise `/faction list`.",
      ephemeral: true,
    });
  }

  // Duel — validation
  if (id === "DUEL:SUBMIT") {
    return handleDuelSubmit(interaction);
  }

  // ✅ Faction join — validation
  if (id === "FACTION:JOIN:SUBMIT") {
    return handleFactionJoinSubmit(interaction);
  }

  return interaction.reply({ content: "Bouton inconnu.", ephemeral: true });
}

/* ================= Modals ================= */
export async function handleModal(interaction: ModalSubmitInteraction) {
  if (interaction.customId === "FACTION:DONATE:SUBMIT") {
    return handleFactionDonateModal(interaction);
  }
  if (interaction.customId === "DUEL:MSG:SUBMIT") {
    return handleDuelMsgModal(interaction);
  }
  return interaction.reply({ content: "Modal inconnu.", ephemeral: true });
}

/* ============== Dispatcher global ============== */
export async function dispatch(interaction: Interaction) {
  try {
    if (interaction.isChatInputCommand()) return handleSlash(interaction);
    if (interaction.isStringSelectMenu()) return handleSelect(interaction);
    if (interaction.isButton()) return handleButton(interaction);
    if (interaction.isModalSubmit()) return handleModal(interaction);
  } catch (err) {
    console.error("Dispatcher error:", err);
    if (interaction.isRepliable()) {
      try {
        await interaction.reply({ content: "❌ Erreur interne.", ephemeral: true });
      } catch {}
    }
  }
}
