// src/lobby/start.ts
import { ChatInputCommandInteraction } from "discord.js";
import { prisma } from "../prismat";
import { startBattleRound } from "../battle/round";

export async function handleLobbyStart(
  interaction: ChatInputCommandInteraction,
  lobbyId: string,
) {
  await interaction.deferReply({ ephemeral: true });

  // On vérifie le lobby
  const lobby = await prisma.lobby.findUnique({ where: { id: lobbyId } });
  if (!lobby) return interaction.editReply("❌ Lobby introuvable.");

  if (lobby.mode === "BATTLE_ROYALE") {
    await startBattleRound({ guild: interaction.guild!, client: interaction.client } as any, lobbyId, 1);
    return interaction.editReply("🚀 Battle Royal démarré : Round 1 généré.");
  }

  // NORMAL / SURPRISE — flux habituel : Team Builder → TB:VALIDATE → startRound(...)
  return interaction.editReply("ℹ️ Pour ce mode, utilise le Team Builder et valide les équipes.");
}
