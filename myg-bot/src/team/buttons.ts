// src/team/buttons.ts
import {
  ButtonInteraction,
  StringSelectMenuBuilder,
  ActionRowBuilder,
  GuildMember,
} from "discord.js";
import { prisma } from "../prismat";
import { env } from "../env";
import { renderTeamBuilder } from "./render";
import {
  tbNameTeamSelectId,
  tbCaptainTeamSelectId,
  tbCaptainMemberSelectId,
  tbFormatSelectId,
} from "./ids";
import { generateSchedule } from "./schedule";
import { sendLineup } from "./lineup";
import { createTeamCategories } from "./channels";
import { startRound } from "../match/flow";
import { launchTeamBuilder } from "./builder";

function isRespoOrCreator(member: GuildMember | null, lobbyCreatorId: string): boolean {
  if (!member) return false;
  if (member.id === lobbyCreatorId) return true;
  return member.roles.cache?.has(env.ROLE_RESPO_ID) ?? false;
}

export async function handleTeamButton(inter: ButtonInteraction) {
  const id = inter.customId; // TB:...
  if (!id.startsWith("TB:")) return;

  // TB:OPEN:<lobbyId> — ouvrir Team Builder
  if (id.startsWith("TB:OPEN:")) {
    await inter.deferUpdate().catch(() => {});
    const lobbyId = id.split(":")[2];
    // Le builder attend un ChatInputCommandInteraction : on caste proprement,
    // la fonction n'utilise que guild/client/reply sur l'interaction.
    await launchTeamBuilder(lobbyId, inter as any);
    return;
  }

  // TB:NAME:<lobbyId>
  if (id.startsWith("TB:NAME:") && id.split(":").length === 3) {
    await inter.deferUpdate();
    const lobbyId = id.split(":")[2];

    const lobby = await prisma.lobby.findUnique({ where: { id: lobbyId }, include: { teamsList: true } });
    if (!lobby) return;
    const allowed = isRespoOrCreator(inter.member as GuildMember | null, lobby.createdBy);
    if (!allowed) {
      await inter.followUp({ content: "❌ Réservé aux responsables.", ephemeral: true });
      return;
    }

    const teamSel = new StringSelectMenuBuilder()
      .setCustomId(tbNameTeamSelectId(lobbyId))
      .setPlaceholder("Choisir l'équipe à renommer")
      .addOptions(lobby.teamsList.map(t => ({ label: t.name, value: t.id })));
    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(teamSel);

    const base = await renderTeamBuilder(lobbyId);
    await inter.message.edit({ embeds: [base.embed], components: [...base.components, row] });
    return;
  }

  // TB:CAPTAIN:<lobbyId>
  if (id.startsWith("TB:CAPTAIN:")) {
    await inter.deferUpdate();
    const lobbyId = id.split(":")[2];
    const lobby = await prisma.lobby.findUnique({
      where: { id: lobbyId },
      include: { teamsList: { include: { members: { include: { participant: true } } } } },
    });
    if (!lobby) return;
    const allowed = isRespoOrCreator(inter.member as GuildMember | null, lobby.createdBy);
    if (!allowed) {
      await inter.followUp({ content: "❌ Réservé aux responsables.", ephemeral: true });
      return;
    }

    const teamSel = new StringSelectMenuBuilder()
      .setCustomId(tbCaptainTeamSelectId(lobbyId))
      .setPlaceholder("Choisir une équipe pour définir le capitaine")
      .addOptions(lobby.teamsList.map(t => ({ label: t.name, value: t.id })));
    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(teamSel);

    const base = await renderTeamBuilder(lobbyId);
    await inter.message.edit({ embeds: [base.embed], components: [...base.components, row] });
    return;
  }

  // TB:FORMAT:<lobbyId>
  if (id.startsWith("TB:FORMAT:")) {
    await inter.deferUpdate();
    const lobbyId = id.split(":")[2];
    const lobby = await prisma.lobby.findUnique({ where: { id: lobbyId } });
    if (!lobby) return;
    const allowed = isRespoOrCreator(inter.member as GuildMember | null, lobby.createdBy);
    if (!allowed) {
      await inter.followUp({ content: "❌ Réservé aux responsables.", ephemeral: true });
      return;
    }

    const fmt = new StringSelectMenuBuilder().setCustomId(tbFormatSelectId(lobbyId)).setPlaceholder("Choisir le format");
    if (lobby.teams === 2) {
      fmt.addOptions(
        { label: "BO1", value: "BO1" },
        { label: "BO3", value: "BO3" },
        { label: "BO5", value: "BO5" },
      );
    } else {
      fmt.addOptions(
        { label: "Round Robin (1 match/équipe)", value: "RR1" },
        { label: "Round Robin (2 matchs/équipe)", value: "RR2" },
        { label: "Round Robin (3 matchs/équipe)", value: "RR3" },
      );
    }
    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(fmt);
    const base = await renderTeamBuilder(lobbyId);
    await inter.message.edit({ embeds: [base.embed], components: [...base.components, row] });
    return;
  }

  // TB:VALIDATE:<lobbyId> — inchangé
  if (id.startsWith("TB:VALIDATE:")) {
    await inter.deferUpdate();
    const lobbyId = id.split(":")[2];

    const lobby = await prisma.lobby.findUnique({
      where: { id: lobbyId },
      include: {
        teamsList: { include: { members: { include: { participant: true } } } },
        participants: true,
      },
    });
    if (!lobby) return;

    const allowed = isRespoOrCreator(inter.member as GuildMember | null, lobby.createdBy);
    if (!allowed) {
      await inter.followUp({ content: "❌ Réservé aux responsables.", ephemeral: true });
      return;
    }

    const roles = ["TOP", "JGL", "MID", "ADC", "SUPP"] as const;
    const incomplete = lobby.teamsList.find(t =>
      roles.some(r => !t.members.find(m => m.participant.role === r))
    );
    if (incomplete) {
      await inter.followUp({ content: `❌ ${incomplete.name} est incomplète. Remplis tous les rôles.`, ephemeral: true });
      return;
    }

    const already = await prisma.match.findFirst({ where: { lobbyId }, select: { id: true } });
    if (already) {
      await inter.followUp({ content: "⚠️ Des matchs existent déjà pour ce lobby.", ephemeral: true });
      return;
    }

    const fmt = (lobby.format as any) ?? (lobby.teams === 2 ? "BO1" : "RR1");
    const schedule = generateSchedule(
      lobby.teamsList.map(t => ({ id: t.id, name: t.name })), // TeamLike
      fmt
    );

    for (const m of schedule) {
      await prisma.match.create({
        data: {
          lobbyId,
          teamAId: m.teamA.id,
          teamBId: m.teamB.id,
          round: m.round,
          state: "PENDING",
        },
      });
    }

    await sendLineup(inter, lobbyId);
    await createTeamCategories(inter, lobbyId);

    if (inter.guild) {
      await startRound(inter.guild, lobbyId, 1);
    }

    const base = await renderTeamBuilder(lobbyId);
    await inter.message.edit({ embeds: [base.embed], components: base.components });
    await inter.followUp({ content: "✅ Équipes validées. Line-up envoyé, salons créés, **Round 1 lancé**.", ephemeral: true });
    return;
  }
}
