// src/bot/menus/faction.ts
import {
  StringSelectMenuInteraction,
} from "discord.js";
import { prisma } from "../../prismat";

export async function handleFactionSelect(inter: StringSelectMenuInteraction) {
  const id = inter.customId;
  if (id !== "FACTION:JOIN") return;

  await inter.deferUpdate();

  const factionId = Number(inter.values[0]);
  if (Number.isNaN(factionId)) {
    await inter.followUp({ content: "❌ Sélection invalide.", ephemeral: true });
    return;
  }

  const faction = await prisma.faction.findUnique({ where: { id: factionId } });
  if (!faction) {
    await inter.followUp({ content: "❌ Faction introuvable.", ephemeral: true });
    return;
  }

  const userId = inter.user.id;
  const profile = await prisma.userProfile.findUnique({ where: { discordId: userId } });

  if (!profile) {
    await prisma.userProfile.create({
      data: { discordId: userId, factionId },
    });
  } else {
    await prisma.userProfile.update({
      where: { discordId: userId },
      data: { factionId },
    });
  }

  // On “confirme” et on enlève les composants du message d’origine
  try {
    const content = `✅ Tu as rejoint **${faction.name}**.`;
    if ("edit" in inter.message) {
      await inter.message.edit({ content, components: [] as any });
    } else {
      await inter.followUp({ content, ephemeral: true });
    }
  } catch {
    await inter.followUp({
      content: `✅ Tu as rejoint **${faction.name}**.`,
      ephemeral: true,
    });
  }
}
