import { ButtonInteraction } from "discord.js";
import { acceptTransfer, declineTransfer } from "@/services/faction/transfer";

export async function handleFactionTransferButton(i: ButtonInteraction) {
  const [, , action, offerId] = i.customId.split(":");
  try {
    if (action === "ACC") {
      await acceptTransfer(offerId, i.user.id);
      await i.reply({ content: "✅ Transfert accepté !", ephemeral: true });
    } else if (action === "DEC") {
      await declineTransfer(offerId, i.user.id);
      await i.reply({ content: "❌ Offre refusée.", ephemeral: true });
    }
  } catch (e: any) {
    await i.reply({ content: `Erreur : ${e.message}`, ephemeral: true });
  }
}
