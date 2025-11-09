import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
} from "discord.js";
import { prisma } from "../prismat";
import { mygEmbedBase } from "../utils/embeds";
import {
  tbTeamSelectId,
  tbRoleSelectId,
  tbPlayerSelectId,
  tbCaptainButtonId,
  tbNameButtonId,
  tbFormatButtonId,
  tbValidateButtonId,
} from "./ids";

export async function renderTeamBuilder(lobbyId: string, selectedTeamId?: string) {
  const lobby = await prisma.lobby.findUnique({
    where: { id: lobbyId },
    include: {
      participants: true,
      teamsList: { include: { members: { include: { participant: true } } } },
    },
  });
  if (!lobby) throw new Error("Lobby introuvable");

  // --- Map des titres actifs (discordId -> Title.name)
  const allDiscordIds = new Set<string>();
  for (const p of lobby.participants) if (p.discordId) allDiscordIds.add(p.discordId);
  for (const t of lobby.teamsList) {
    for (const m of t.members) if (m.participant.discordId) allDiscordIds.add(m.participant.discordId);
  }
  const ids = Array.from(allDiscordIds);
  const profiles =
    ids.length > 0
      ? await prisma.userProfile.findMany({
          where: { discordId: { in: ids } },
          include: { activeTitle: true },
        })
      : [];
  const titleById = new Map<string, string>();
  for (const prof of profiles) {
    if (prof.discordId && prof.activeTitle?.name) {
      titleById.set(prof.discordId, prof.activeTitle.name);
    }
  }

  const withTitle = (display: string, discordId: string | null) => {
    if (!discordId) return display;
    const t = titleById.get(discordId);
    return t ? `${display} [*${t}*]` : display;
  };

  const teams = lobby.teamsList;
  const activeTeamId = selectedTeamId ?? teams[0]?.id ?? "";

  const assignedIds = new Set(teams.flatMap((t) => t.members.map((m) => m.lobbyParticipantId)));

  const poolByRole = (role: string) =>
    lobby.participants
      .filter((p) => p.role === role && !assignedIds.has(p.id))
      .map((p) => withTitle(p.display, p.discordId ?? null));

  const fmtTeam = (t: (typeof teams)[number]) => {
    const get = (r: string) => {
      const m = t.members.find((m) => m.participant.role === r)?.participant;
      return m ? withTitle(m.display, m.discordId ?? null) : "—";
    };
    const capName = t.captainId
      ? t.members.find((m) => m.lobbyParticipantId === t.captainId)?.participant.display
      : undefined;
    return `**${t.name}**${capName ? ` (👑 ${capName})` : ""}\nTop: ${get("TOP")}\nJgl: ${get(
      "JGL",
    )}\nMid: ${get("MID")}\nAdc: ${get("ADC")}\nSupp: ${get("SUPP")}`;
  };

  const embed = new EmbedBuilder(
    mygEmbedBase({
      title: `Team Builder — ${lobby.name}`,
      fields: [
        { name: "Pool Top", value: listOrEmpty(poolByRole("TOP")), inline: true },
        { name: "Pool Jgl", value: listOrEmpty(poolByRole("JGL")), inline: true },
        { name: "Pool Mid", value: listOrEmpty(poolByRole("MID")), inline: true },
        { name: "Pool Adc", value: listOrEmpty(poolByRole("ADC")), inline: true },
        { name: "Pool Supp", value: listOrEmpty(poolByRole("SUPP")), inline: true },
        {
          name: "Subs",
          value:
            lobby.participants
              .filter((p) => p.role === "SUB" && !assignedIds.has(p.id))
              .map((p) => withTitle(p.display, p.discordId ?? null))
              .join("\n") || "_(vide)_",
          inline: true,
        },
        ...teams.map((t) => ({ name: "—", value: fmtTeam(t), inline: false })),
      ],
      footer: { text: "Sélectionne une équipe, un rôle, puis un joueur pour l’assigner." },
    }),
  );

  const teamMenu = new StringSelectMenuBuilder()
    .setCustomId(tbTeamSelectId(lobby.id))
    .setPlaceholder("Choisir une équipe")
    .addOptions(teams.map((t) => ({ label: t.name, value: t.id, default: t.id === activeTeamId })));

  const roleMenu = new StringSelectMenuBuilder()
    .setCustomId(tbRoleSelectId(lobby.id, activeTeamId))
    .setPlaceholder(`Choisir un rôle — équipe: ${teams.find((t) => t.id === activeTeamId)?.name ?? "?"}`)
    .addOptions(["TOP", "JGL", "MID", "ADC", "SUPP"].map((r) => ({ label: r, value: r })));

  const row1 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(teamMenu);
  const row2 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(roleMenu);

  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(tbNameButtonId(lobby.id)).setLabel("Renommer Team").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(tbCaptainButtonId(lobby.id)).setLabel("Choisir Capitaine").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(tbFormatButtonId(lobby.id)).setLabel("Format").setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(tbValidateButtonId(lobby.id)).setLabel("Valider équipes").setStyle(ButtonStyle.Success),
  );

  return { embed, components: [row1, row2, buttons] as const, activeTeamId };
}

function listOrEmpty(arr: string[]) {
  return arr.length ? arr.join("\n") : "_(vide)_";
}
