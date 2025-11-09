import type { Interaction } from "discord.js";

// /shop
import { handleShopSelect } from "../bot/commands/shop";
// /use object
import { handleUseSelect } from "../bot/commands/use";
// Duel (ticket) — sélecteurs REGION/FORMAT
import { handleDuelSelect } from "./modals-faction";

export async function handleComponent(interaction: Interaction) {
  if (!interaction.isStringSelectMenu()) return;

  const id = interaction.customId;

  // ==== /shop selects ====
  if (
    id === "SHOP:TITLE" ||
    id === "SHOP:BUY:TITLE" ||
    id === "SHOP:CONS" ||
    id === "SHOP:BUY:CONS"
  ) {
    return handleShopSelect(interaction);
  }

  // ==== /use object select ====
  if (id === "USE:SELECT") {
    return handleUseSelect(interaction);
  }

  // ==== Ticket de duel: REGION/FORMAT ====
  if (id.startsWith("DUEL:SELECT:")) {
    return handleDuelSelect(interaction);
  }

  // (Ajoute ici d'autres routes de select si besoin)
}
