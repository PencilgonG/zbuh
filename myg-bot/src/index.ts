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
import { handleSlash } from "./interactions/dispatcher";
import { handleLobbyButton } from "./lobby/buttons";
import { handleTeamSelectMenu, handleTeamModal } from "./team/menus";
import { handleTeamButton } from "./team/buttons";
import { handleMatchButton } from "./match/buttons";
import { handleResultButton } from "./results/buttons";
import { handleMvpSelect, handleMvpLock } from "./vote/handlers";

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", () => {
  log.info({ user: client.user?.tag }, "Bot prêt ✅");
});

client.on("interactionCreate", async (interaction: Interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      return await handleSlash(interaction);
    }

    if (interaction.isButton()) {
      const btn = interaction as ButtonInteraction;
      const id = btn.customId;

      // Priorité par préfixes
      if (id.startsWith("RESULT:")) return await handleResultButton(btn);
      if (id.startsWith("MATCH:")) return await handleMatchButton(btn);
      if (id.startsWith("TB:")) return await handleTeamButton(btn);

      // 🔒 MVP/VOTE — boutons (ex: VOTE:LOCK:<lobbyId>)
      if (id.startsWith("VOTE:LOCK:") || id.startsWith("MVP:LOCK:")) {
        return await handleMvpLock(btn);
      }

      // Fallback: boutons de lobby
      return await handleLobbyButton(btn);
    }

    if (interaction.isStringSelectMenu()) {
      const sel = interaction as StringSelectMenuInteraction;
      const id = sel.customId;

      // MVP — sélecteurs (ex: VOTE:MVP:<lobbyId>:<teamId>)
      if (id.startsWith("VOTE:MVP:") || id.startsWith("MVP:")) {
        return await handleMvpSelect(sel);
      }

      // Team Builder
      return await handleTeamSelectMenu(sel);
    }

    if (interaction.isModalSubmit()) {
      return await handleTeamModal(interaction as ModalSubmitInteraction);
    }
  } catch (err) {
    log.error({ err }, "Erreur interaction");
    if (interaction.isRepliable()) {
      const msg = "❌ Une erreur est survenue. Réessaie.";
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: msg, ephemeral: true });
      } else {
        await interaction.reply({ content: msg, ephemeral: true });
      }
    }
  }
});

client.login(env.DISCORD_TOKEN);
