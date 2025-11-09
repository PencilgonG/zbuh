// src/index.ts
import {
  Client,
  GatewayIntentBits,
  Interaction,
  ButtonInteraction,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
} from "discord.js";
import { env } from "./env";
import { log } from "./log";

// Slash
import { handleSlash } from "./interactions/dispatcher";

// Lobby / Team / Match / Results / MVP / BR
import { handleLobbyButton } from "./lobby/buttons";
import { handleTeamSelectMenu, handleTeamModal } from "./team/menus";
import { handleTeamButton } from "./team/buttons";
import { handleMatchButton } from "./match/buttons";
import { handleResultButton } from "./results/buttons";
import { handleMvpSelect, handleMvpLock } from "./vote/handlers";
import { handleBattleButton } from "./battle/buttons";

// Shop
import { handleShopSelect } from "./bot/commands/shop";
import { shopAutocomplete } from "./bot/autocomplete/shop";

// Use (inventaire)
import { handleUseSelect } from "./bot/commands/use";

// Faction (boutons génériques + donate modal)
import { handleFactionButtons } from "./interactions/buttons-faction";
import {
  handleFactionDonateModal,
  // Duel flow
  handleDuelSelect,
  handleDuelSubmit,
  handleDuelMsgModal,
} from "./interactions/modals-faction";

// Faction JOIN (nouveau flux select + bouton)
import {
  handleJoinSelect,
  handleJoinSubmit,
} from "./bot/commands/faction";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    // requis pour add/remove des rôles de région
    GatewayIntentBits.GuildMembers,
  ],
});

client.once("ready", () => {
  log.info({ user: client.user?.tag }, "Bot prêt ✅");
});

client.on("interactionCreate", async (interaction: Interaction) => {
  try {
    // ===== Slash =====
    if (interaction.isChatInputCommand()) {
      return await handleSlash(interaction);
    }

    // ===== Autocomplete =====
    if (interaction.isAutocomplete()) {
      return await shopAutocomplete(interaction);
    }

    // ===== Buttons =====
    if (interaction.isButton()) {
      const btn = interaction as ButtonInteraction;
      const id = btn.customId;

      // Battle Royale / Match / Results / Team Builder / MVP lock
      if (id.startsWith("BR:")) return await handleBattleButton(btn);
      if (id.startsWith("RESULT:")) return await handleResultButton(btn);
      if (id.startsWith("MATCH:")) return await handleMatchButton(btn);
      if (id.startsWith("TB:")) return await handleTeamButton(btn);
      if (id.startsWith("VOTE:LOCK:") || id.startsWith("MVP:LOCK:")) return await handleMvpLock(btn);

      // Faction (générique: donate/gifts/leaderboard)
      if (id.startsWith("FACTION:") || id.startsWith("FGIFTS:")) {
        return await handleFactionButtons(btn);
      }

      // ✅ Duel (validation)
      if (id === "DUEL:SUBMIT") {
        return await handleDuelSubmit(btn);
      }

      // ✅ Join faction (validation)
      if (id === "JOIN:SUBMIT") {
        return await handleJoinSubmit(btn);
      }

      // Sinon: boutons de lobby (join/quit/test/validate)
      return await handleLobbyButton(btn);
    }

    // ===== Select menus =====
    if (interaction.isStringSelectMenu()) {
      const sel = interaction as StringSelectMenuInteraction;
      const id = sel.customId;

      // Shop selects
      if (id.startsWith("SHOP:")) return await handleShopSelect(sel);

      // MVP select
      if (id.startsWith("VOTE:MVP:") || id.startsWith("MVP:")) {
        return await handleMvpSelect(sel);
      }

      // ✅ Use (inventaire) select
      if (id === "USE:SELECT") return await handleUseSelect(sel);

      // ✅ Duel selects (région / format)
      if (id.startsWith("DUEL:SELECT:")) {
        return await handleDuelSelect(sel);
      }

      // ✅ Join faction select (région)
      if (id === "JOIN:SELECT_REGION") {
        return await handleJoinSelect(sel);
      }

      // Team Builder selects (fallback)
      return await handleTeamSelectMenu(sel);
    }

    // ===== Modals =====
    if (interaction.isModalSubmit()) {
      const modal = interaction as ModalSubmitInteraction;

      // Faction: donate
      if (modal.customId === "FACTION:DONATE:SUBMIT") {
        return await handleFactionDonateModal(modal);
      }

      // ✅ Duel: message optionnel
      if (modal.customId === "DUEL:MSG:SUBMIT") {
        return await handleDuelMsgModal(modal);
      }

      // Team Builder modals
      return await handleTeamModal(modal);
    }
  } catch (err) {
    log.error({ err }, "Erreur interaction");
    if (interaction.isRepliable()) {
      const msg = "❌ Une erreur est survenue. Réessaie.";
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: msg, ephemeral: true }).catch(() => {});
      } else {
        await interaction.reply({ content: msg, ephemeral: true }).catch(() => {});
      }
    }
  }
});

client.login(env.DISCORD_TOKEN);
