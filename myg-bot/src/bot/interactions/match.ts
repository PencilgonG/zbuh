// src/bot/interactions/match.ts
import type { ButtonInteraction } from "discord.js";
import { isRespo } from "../utils/roles.js";
import { nextMatch, repostLinksForCurrent, skipMatch } from "../utils/lobby.js";

/**
 * Valide le match courant (respo), puis passe au suivant (ou termine).
 */
export async function onMatchValidate(i: ButtonInteraction) {
  const member = i.member && "roles" in i.member ? i.member : null;
  if (!isRespo(member as any)) {
    return i.reply({
      content: "❌ Réservé aux responsables.",
      ephemeral: true,
    });
  }

  const res = await nextMatch(i);
  return i.reply({ content: res.message, ephemeral: true });
}

/**
 * Reposte / régénère les liens de draft pour le match courant.
 */
export async function onMatchRepost(i: ButtonInteraction) {
  const res = await repostLinksForCurrent(i);
  if (!res.ok) return i.reply({ content: `❌ ${res.reason}`, ephemeral: true });
  return i.reply({ content: "🔁 Liens de draft repostés.", ephemeral: true });
}

/**
 * Skip le match courant (utile tests). Respo only.
 */
export async function onMatchSkip(i: ButtonInteraction) {
  const member = i.member && "roles" in i.member ? i.member : null;
  if (!isRespo(member as any)) {
    return i.reply({
      content: "❌ Réservé aux responsables.",
      ephemeral: true,
    });
  }
  const res = await skipMatch(i);
  return i.reply({ content: res.message, ephemeral: true });
}
