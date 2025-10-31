import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import { prisma } from "../prisma";
import { mygEmbedBase } from "../utils/embeds";
import { lobbyJoinId, lobbyQuitId, lobbyTestId, lobbyValidateId } from "./ids";

function fmtList(items: string[]) {
  return items.length ? items.join("\n") : "_(vide)_";
}

export async function renderLobbyMessage(lobbyId: string) {
  const lobby = await prisma.lobby.findUnique({
    where: { id: lobbyId },
    include: { participants: true },
  });
  if (!lobby) throw new Error("Lobby introuvable");

  const parts = lobby.participants;

  // Récupère les profils pour liens OP.GG
  const discordIds = parts.map(p => p.discordId).filter((v): v is string => !!v);
  const profiles = await prisma.userProfile.findMany({
    where: { discordId: { in: discordIds } },
  });
  const profileById = new Map(profiles.map(p => [p.discordId, p]));

  const byRole = (role: string) =>
    parts.filter(p => p.role === role).map(p => {
      if (p.discordId) {
        const prof = profileById.get(p.discordId);
        if (prof?.opggUrl) return `[${p.display}](${prof.opggUrl})`;
      }
      return p.display;
    });

  const embed = new EmbedBuilder(
    mygEmbedBase({
      title: `Salle d'attente — ${lobby.name} (${lobby.teams} équipes)`,
      fields: [
        { name: "Top",  value: fmtList(byRole("TOP")),  inline: true },
        { name: "Jgl",  value: fmtList(byRole("JGL")),  inline: true },
        { name: "Mid",  value: fmtList(byRole("MID")),  inline: true },
        { name: "Adc",  value: fmtList(byRole("ADC")),  inline: true },
        { name: "Supp", value: fmtList(byRole("SUPP")), inline: true },
        { name: "Sub",  value: fmtList(byRole("SUB")),  inline: true },
      ],
      footer: { text: `Statut: ${lobby.status} • Inscris via les boutons ci-dessous` },
    })
  );

  // Boutons
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(lobbyJoinId(lobby.id, "TOP")).setLabel("Top").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(lobbyJoinId(lobby.id, "JGL")).setLabel("Jgl").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(lobbyJoinId(lobby.id, "MID")).setLabel("Mid").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(lobbyJoinId(lobby.id, "ADC")).setLabel("Adc").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(lobbyJoinId(lobby.id, "SUPP")).setLabel("Supp").setStyle(ButtonStyle.Primary),
  );
  const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(lobbyJoinId(lobby.id, "SUB")).setLabel("Sub").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(lobbyQuitId(lobby.id)).setLabel("Quitter").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(lobbyTestId(lobby.id)).setLabel("Test").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(lobbyValidateId(lobby.id)).setLabel("Valider").setStyle(ButtonStyle.Success),
  );

  return { embed, rows: [row1, row2] as const };
}
