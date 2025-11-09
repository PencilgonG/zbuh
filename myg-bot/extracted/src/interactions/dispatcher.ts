import type { ChatInputCommandInteraction } from "discord.js";
import { handleProfilSet } from "../slash/profil/set";
import { handleProfilView } from "../slash/profil/view";
import { handleLobbyCreate } from "../slash/lobby/create";
import { handleLeaderboard } from "../slash/leaderboard";

// ⬇️ on importe les handlers des nouvelles commandes
import { execute as handleShop } from "../bot/commands/shop";
import { execute as handleAdminDev } from "../bot/commands/admin-dev";

export async function handleSlash(interaction: ChatInputCommandInteraction) {
  const name = interaction.commandName;

  if (name === "profil") {
    const sub = interaction.options.getSubcommand();
    if (sub === "set") return handleProfilSet(interaction);
    if (sub === "view") return handleProfilView(interaction);
  }

  if (name === "lobby") {
    return handleLobbyCreate(interaction);
  }

  if (name === "leaderboard") {
    return handleLeaderboard(interaction);
  }

  if (name === "shop") {
    return handleShop(interaction);
  }

  if (name === "admin-dev") {
    return handleAdminDev(interaction);
  }

  await interaction.reply({ content: "Commande inconnue.", ephemeral: true });
}
