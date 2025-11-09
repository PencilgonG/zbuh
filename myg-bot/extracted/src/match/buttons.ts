import { ButtonInteraction, GuildMember } from "discord.js";
import { prisma } from "../prismat";
import { env } from "../env";
import { validateMatchAndMaybeCleanup } from "./flow";

function isRespoOrCreator(member: GuildMember | null, lobbyCreatorId: string): boolean {
  if (!member) return false;
  if (member.id === lobbyCreatorId) return true;
  return member.roles.cache?.has(env.ROLE_RESPO_ID) ?? false;
}

export async function handleMatchButton(inter: ButtonInteraction) {
  const id = inter.customId;
  if (!id.startsWith("MATCH:")) return;

  // MATCH:VALIDATE:<matchId>:<winnerTeamId>  (respo-only)
  if (id.startsWith("MATCH:VALIDATE:")) {
    await inter.deferUpdate();
    const [, , matchId, winnerTeamId] = id.split(":");

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: { lobby: true },
    });
    if (!match) return;

    const allowed = isRespoOrCreator(inter.member as GuildMember | null, match.lobby.createdBy);
    if (!allowed) {
      await inter.followUp({ content: "❌ Réservé aux responsables.", ephemeral: true });
      return;
    }

    // 👈 IMPORTANT: on passe bien le Guild, pas l'interaction
    if (!inter.guild) {
      await inter.followUp({ content: "⚠️ Contexte serveur introuvable.", ephemeral: true });
      return;
    }

    await validateMatchAndMaybeCleanup(inter.guild, matchId, winnerTeamId);
    return;
  }

  // autres actions MATCH:... ici si besoin
}
