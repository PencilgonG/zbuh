import {
  Client,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  TextChannel,
  APIActionRowComponent,
  APIMessageActionRowComponent,
} from "discord.js";
import { prisma } from "../prismat";
import { env } from "../env";
import { mygEmbedBase } from "../utils/embeds";
import { mvpSelectId, mvpLockId } from "./ids";

// Construit l'embed + les selects (optionnellement désactivés) + champs de tally
export async function buildMvpPanel(lobbyId: string, disable = false) {
  const lobby = await prisma.lobby.findUnique({
    where: { id: lobbyId },
    include: {
      teamsList: { include: { members: { include: { participant: true } } } },
    },
  });
  if (!lobby) throw new Error("Lobby introuvable");

  // Tally (votes par team)
  const votes = await prisma.mvpVote.findMany({ where: { lobbyId } });
  const byTeam = new Map<string, Map<string, number>>();
  for (const v of votes) {
    if (!byTeam.has(v.teamId)) byTeam.set(v.teamId, new Map());
    const t = byTeam.get(v.teamId)!;
    t.set(v.votedDiscordId, (t.get(v.votedDiscordId) ?? 0) + 1);
  }

  const embed = new EmbedBuilder(
    mygEmbedBase({
      title: `Vote MVP — ${lobby.name}`,
      description: `Votez pour **un joueur par équipe**.\nSeuls les participants peuvent voter.`,
    })
  );

  // Ajoute un champ par équipe avec le tally (trié)
  for (const team of lobby.teamsList) {
    const map = byTeam.get(team.id) ?? new Map<string, number>();
    const rows = [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([discordId, n]) =>
        discordId.startsWith("fake:")
          ? `• ${team.members.find(m => `fake:${m.participant.id}` === discordId)?.participant.display ?? "Fake"} — **${n}**`
          : `• <@${discordId}> — **${n}**`
      );
    embed.addFields({
      name: `MVP — ${team.name}`,
      value: rows.length ? rows.join("\n") : "_Aucun vote pour l’instant_",
    });
  }

  const rows: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[] = [];
  for (const team of lobby.teamsList) {
    const sel = new StringSelectMenuBuilder()
      .setCustomId(mvpSelectId(lobbyId, team.id))
      .setPlaceholder(`MVP — ${team.name}`)
      .setMinValues(1)
      .setMaxValues(1)
      .setDisabled(disable)
      .addOptions(
        team.members.map((m) => ({
          label: m.participant.display,
          value: m.participant.discordId ?? `fake:${m.participant.id}`,
        }))
      );
    rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(sel));
  }

  const lock = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(mvpLockId(lobbyId)).setStyle(ButtonStyle.Success).setLabel("Clore les votes").setDisabled(disable)
  );
  rows.push(lock);

  return { embed, components: rows };
}

// Cherche un message existant contenant un select customId "VOTE:MVP:<lobbyId>:..."
async function findExistingPanelMessage(ch: TextChannel, lobbyId: string) {
  const msgs = await ch.messages.fetch({ limit: 50 }).catch(() => null);
  if (!msgs) return null;
  for (const [, msg] of msgs) {
    if (msg.author.id !== ch.client.user?.id) continue;
    const rows = (msg.components ?? []) as unknown as APIActionRowComponent<APIMessageActionRowComponent>[];
    const found = rows.some((row) =>
      (row.components ?? []).some((c: any) => {
        const cid = c.custom_id ?? c.customId;
        return typeof cid === "string" && cid.startsWith(`VOTE:MVP:${lobbyId}:`);
      })
    );
    if (found) return msg;
  }
  return null;
}

// Upsert (édite si présent, sinon envoie)
export async function upsertMvpPanel(client: Client, lobbyId: string, disable = false) {
  const ch = (await client.channels.fetch(env.VOTE_CHANNEL_ID).catch(() => null)) as TextChannel | null;
  if (!ch || !("isTextBased" in ch) || !ch.isTextBased()) return;

  const payload = await buildMvpPanel(lobbyId, disable);
  const existing = await findExistingPanelMessage(ch, lobbyId);

  if (existing) {
    await existing.edit({ embeds: [payload.embed], components: payload.components }).catch(() => {});
  } else {
    await ch.send({ embeds: [payload.embed], components: payload.components });
  }
}
