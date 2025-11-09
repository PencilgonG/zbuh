// src/bot/handlers/faction-transfer.ts
import { ButtonInteraction } from "discord.js";
import { acceptTransfer, declineTransfer } from "../../services/faction/transfer";

export async function handleFactionTransferButtons(inter: ButtonInteraction) {
  const id = inter.customId;
  if (!id.startsWith("FAC:TRANSF:")) return;

  await inter.deferReply({ ephemeral: true });
  const [, , action, offerId] = id.split(":");

  try {
    if (action === "ACC") {
      await acceptTransfer(offerId, inter.user.id);
      await inter.editReply("✅ Transfert accepté. Bienvenue dans ta nouvelle faction !");
    } else if (action === "DEC") {
      await declineTransfer(offerId, inter.user.id);
      await inter.editReply("❎ Transfert refusé.");
    } else {
      await inter.editReply("❌ Action inconnue.");
    }
  } catch (e: any) {
    await inter.editReply(`❌ ${e?.message ?? "Action impossible."}`);
  }
}
