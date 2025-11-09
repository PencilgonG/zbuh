import { ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { prisma } from "../prismat";
import { mygEmbedBase } from "../utils/embeds";

export async function launchTeamBuilder(lobbyId: string, interaction: ChatInputCommandInteraction) {
  const lobby = await prisma.lobby.findUnique({
    where: { id: lobbyId },
    include: { participants: true }
  });
  if (!lobby) return interaction.followUp({ content: "Lobby introuvable.", ephemeral: true });

  // Créer les entités Team de base selon lobby.teams
  const createdTeams = await Promise.all(
    Array.from({ length: lobby.teams }, (_, i) =>
      prisma.team.create({ data: { lobbyId: lobby.id, name: `Team ${i + 1}` } })
    )
  );

  const embed = new EmbedBuilder(
    mygEmbedBase({
      title: `Team Builder — ${lobby.name}`,
      description: `Compose les équipes à partir des joueurs inscrits ci-dessous.\n**${lobby.teams} équipes** à créer.`,
      footer: { text: "Seul le rôle Respo peut modifier cette section." }
    })
  );

  const menuTeam = new StringSelectMenuBuilder()
    .setCustomId(`TB:TEAM:${lobby.id}`)
    .setPlaceholder("Choisir une équipe")
    .addOptions(createdTeams.map(t => ({ label: t.name, value: t.id })));

  const menuRole = new StringSelectMenuBuilder()
    .setCustomId(`TB:ROLE:${lobby.id}`)
    .setPlaceholder("Choisir un rôle")
    .addOptions(["TOP","JGL","MID","ADC","SUPP"].map(r => ({ label: r, value: r })));

  const btnName = new ButtonBuilder().setCustomId(`TB:NAME:${lobby.id}`).setLabel("Renommer").setStyle(ButtonStyle.Secondary);
  const btnCaptain = new ButtonBuilder().setCustomId(`TB:CAPTAIN:${lobby.id}`).setLabel("Capitaine").setStyle(ButtonStyle.Secondary);
  const btnFormat = new ButtonBuilder().setCustomId(`TB:FORMAT:${lobby.id}`).setLabel("Choisir format").setStyle(ButtonStyle.Primary);
  const btnValidate = new ButtonBuilder().setCustomId(`TB:VALIDATE:${lobby.id}`).setLabel("Valider équipes").setStyle(ButtonStyle.Success);

  const row1 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menuTeam);
  const row2 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menuRole);
  const row3 = new ActionRowBuilder<ButtonBuilder>().addComponents(btnName, btnCaptain, btnFormat, btnValidate);

  await interaction.followUp({
    embeds: [embed],
    components: [row1, row2, row3],
  });
}
