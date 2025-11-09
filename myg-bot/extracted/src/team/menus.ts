import {
  StringSelectMenuInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ModalSubmitInteraction,
  GuildMember,
} from "discord.js";
import { prisma } from "../prismat";
import { parseTb, tbPlayerSelectId, tbCaptainMemberSelectId } from "./ids";
import { renderTeamBuilder } from "./render";
import type { Role as DbRole } from "@prisma/client";

function isRespoOrCreator(member: GuildMember | null, lobbyCreatorId: string, respoRoleId: string): boolean {
  if (!member) return false;
  if (member.id === lobbyCreatorId) return true;
  return member.roles.cache?.has(respoRoleId) ?? false;
}

export async function handleTeamSelectMenu(inter: StringSelectMenuInteraction) {
  const id = inter.customId;

  // ====== flux TEAM / ROLE / PLAYER (composition) ======
  const parsed = parseTb(id);
  if (parsed) {
    if (parsed.kind === "TEAM") {
      await inter.deferUpdate();
      const lobby = await prisma.lobby.findUnique({ where: { id: parsed.lobbyId }, include: { teamsList: true } });
      if (!lobby) return;
      const gm = inter.member as GuildMember | null;
      if (!isRespoOrCreator(gm, lobby.createdBy, process.env.ROLE_RESPO_ID!)) return;

      const selectedTeamId = inter.values[0];
      const base = await renderTeamBuilder(lobby.id, selectedTeamId);
      if (inter.message) {
        await inter.message.edit({ embeds: [base.embed], components: base.components });
      }
      return;
    }

    if (parsed.kind === "ROLE") {
      await inter.deferUpdate();
      const lobby = await prisma.lobby.findUnique({
        where: { id: parsed.lobbyId },
        include: { teamsList: true, participants: true },
      });
      if (!lobby) return;
      const gm = inter.member as GuildMember | null;
      if (!isRespoOrCreator(gm, lobby.createdBy, process.env.ROLE_RESPO_ID!)) return;

      const teamId = parsed.teamId;
      const role = inter.values[0] as unknown as DbRole; // cast UI → enum Prisma

      const assignedIds = new Set(
        (await prisma.teamMember.findMany({ where: { team: { lobbyId: lobby.id } } })).map(
          (m) => m.lobbyParticipantId,
        ),
      );

      const pool = await prisma.lobbyParticipant.findMany({
        where: { lobbyId: lobby.id, role, NOT: { id: { in: Array.from(assignedIds) } } },
        orderBy: { display: "asc" },
        take: 25,
      });

      const { ActionRowBuilder: ARB, StringSelectMenuBuilder: SSMB } = await import("discord.js");
      const base = await renderTeamBuilder(lobby.id, teamId);

      const playerMenu = new (SSMB as any)()
        .setCustomId(tbPlayerSelectId(lobby.id, role as unknown as string))
        .setPlaceholder(`Choisir joueur (${role}) → ${lobby.teamsList.find((t) => t.id === teamId)?.name ?? "Team ?"}`)
        .addOptions(pool.map((p) => ({ label: p.display, value: `${teamId}:${p.id}` })));

      const rowPlayers = new (ARB as any)().addComponents(playerMenu);

      if (inter.message) {
        await inter.message.edit({
          embeds: [base.embed],
          components: [...base.components, rowPlayers],
        });
      }
      return;
    }

    if (parsed.kind === "PLAYER") {
      await inter.deferUpdate();
      const lobbyId = parsed.lobbyId;
      const [teamId, participantId] = inter.values[0].split(":");

      const lobby = await prisma.lobby.findUnique({
        where: { id: lobbyId },
        include: { teamsList: { include: { members: { include: { participant: true } } } } },
      });
      if (!lobby) return;
      const gm = inter.member as GuildMember | null;
      if (!isRespoOrCreator(gm, lobby.createdBy, process.env.ROLE_RESPO_ID!)) return;

      const already = await prisma.teamMember.findFirst({ where: { lobbyParticipantId: participantId } });
      if (already) return;

      const participant = await prisma.lobbyParticipant.findUnique({ where: { id: participantId } });
      if (!participant) return;
      if (participant.role === "SUB") return;

      const team = await prisma.team.findUnique({
        where: { id: teamId },
        include: { members: { include: { participant: true } } },
      });
      if (!team) return;

      const roleTaken = team.members.some((m) => m.participant.role === participant.role);
      if (roleTaken) return;

      await prisma.teamMember.create({ data: { teamId, lobbyParticipantId: participantId } });

      const base = await renderTeamBuilder(lobby.id, teamId);
      if (inter.message) {
        await inter.message.edit({ embeds: [base.embed], components: base.components });
      }
      return;
    }
  }

  // ====== flux NAME:TEAMSEL:<lobbyId> -> ouvre modal (PAS de defer) ======
  if (id.startsWith("TB:NAME:TEAMSEL:")) {
    const lobbyId = id.split(":")[3];
    const teamId = inter.values[0];

    const lobby = await prisma.lobby.findUnique({ where: { id: lobbyId } });
    if (!lobby) return;
    const gm = inter.member as GuildMember | null;
    if (!isRespoOrCreator(gm, lobby.createdBy, process.env.ROLE_RESPO_ID!)) return;

    const modal = new ModalBuilder().setCustomId(`TB:NAME:${lobbyId}:${teamId}`).setTitle("Renommer l'équipe");

    const input = new TextInputBuilder()
      .setCustomId("team-name")
      .setLabel("Nouveau nom")
      .setStyle(TextInputStyle.Short)
      .setMinLength(3)
      .setMaxLength(24)
      .setRequired(true);

    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(input);
    modal.addComponents(row);

    await inter.showModal(modal); // ✅ ouvrir direct
    return;
  }

  // ====== flux CAP:TEAMSEL:<lobbyId> -> propose membres ======
  if (id.startsWith("TB:CAP:TEAMSEL:")) {
    await inter.deferUpdate();
    const lobbyId = id.split(":")[3];
    const teamId = inter.values[0];

    const lobby = await prisma.lobby.findUnique({
      where: { id: lobbyId },
      include: { teamsList: { include: { members: { include: { participant: true } } } } },
    });
    if (!lobby) return;
    const gm = inter.member as GuildMember | null;
    if (!isRespoOrCreator(gm, lobby.createdBy, process.env.ROLE_RESPO_ID!)) return;

    const team = lobby.teamsList.find((t) => t.id === teamId);
    if (!team) return;

    const members = team.members.map((m) => ({ id: m.lobbyParticipantId, display: m.participant.display }));
    const { StringSelectMenuBuilder: SSMB, ActionRowBuilder: ARB } = await import("discord.js");
    const sel = new (SSMB as any)()
      .setCustomId(tbCaptainMemberSelectId(lobbyId, teamId))
      .setPlaceholder(`Choisir le capitaine — ${team.name}`)
      .addOptions(members.map((m) => ({ label: m.display, value: m.id })));
    const row = new (ARB as any)().addComponents(sel);

    const base = await renderTeamBuilder(lobbyId, teamId);
    if (inter.message) {
      await inter.message.edit({ embeds: [base.embed], components: [...base.components, row] });
    }
    return;
  }

  // ====== flux CAP:MEM:<lobbyId>:<teamId> -> set captain ======
  if (id.startsWith("TB:CAP:MEM:")) {
    await inter.deferUpdate();
    const parts = id.split(":");
    const lobbyId = parts[3];
    const teamId = parts[4];
    const captainParticipantId = inter.values[0];

    const lobby = await prisma.lobby.findUnique({ where: { id: lobbyId } });
    if (!lobby) return;
    const gm = inter.member as GuildMember | null;
    if (!isRespoOrCreator(gm, lobby.createdBy, process.env.ROLE_RESPO_ID!)) return;

    await prisma.team.update({ where: { id: teamId }, data: { captainId: captainParticipantId } });

    const base = await renderTeamBuilder(lobbyId, teamId);
    if (inter.message) {
      await inter.message.edit({ embeds: [base.embed], components: base.components });
    }
    return;
  }

  // ====== flux FORMAT:SELECT:<lobbyId> -> ✅ persiste le format choisi ======
  if (id.startsWith("TB:FORMAT:SELECT:")) {
    await inter.deferUpdate();
    const lobbyId = id.split(":")[3];
    const chosen = inter.values[0] as "BO1" | "BO3" | "BO5" | "RR1" | "RR2" | "RR3";

    const lobby = await prisma.lobby.findUnique({ where: { id: lobbyId } });
    if (!lobby) return;
    const gm = inter.member as GuildMember | null;
    if (!isRespoOrCreator(gm, lobby.createdBy, process.env.ROLE_RESPO_ID!)) return;

    await prisma.lobby.update({
      where: { id: lobbyId },
      data: { format: chosen as any },
    });

    const base = await renderTeamBuilder(lobbyId);
    if (inter.message) {
      await inter.message.edit({ embeds: [base.embed], components: base.components });
    }
    await inter.followUp({ content: `📝 Format enregistré: ${chosen}`, ephemeral: true });
    return;
  }
}

export async function handleTeamModal(inter: ModalSubmitInteraction) {
  if (!inter.customId.startsWith("TB:NAME:")) return;
  await inter.deferUpdate();
  const parts = inter.customId.split(":");
  const lobbyId = parts[2];
  const teamId = parts[3];

  const lobby = await prisma.lobby.findUnique({ where: { id: lobbyId } });
  if (!lobby) return;

  const gm = inter.member as GuildMember | null;
  if (!isRespoOrCreator(gm, lobby.createdBy, process.env.ROLE_RESPO_ID!)) return;

  const newName = inter.fields.getTextInputValue("team-name");
  if (!newName || newName.length < 3 || newName.length > 24) return;

  await prisma.team.update({ where: { id: teamId }, data: { name: newName } });

  const base = await renderTeamBuilder(lobbyId, teamId);
  if (inter.message) {
    await inter.message.edit({ embeds: [base.embed], components: base.components });
  }
}
