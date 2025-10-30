import type { ButtonInteraction, Guild } from "discord.js";
import { buildFormatPlan, type FormatCode } from "./schedule.js";
import { createDraftLinks } from "./prodraft.js";
import { matchEmbed } from "./embeds.js";
import {
  createTeamCategory,
  deleteTeamCategory,
  type TeamChannelsRef,
} from "./channels.js";

export type LobbyMode = "1v1" | "2v2" | "3v3" | "4v4" | "5v5";
export type RoleName =
  | "Top"
  | "Jungle"
  | "Mid"
  | "ADC"
  | "Support"
  | "Flex"
  | "Sub";
export type CoreRole = "Top" | "Jungle" | "Mid" | "ADC" | "Support";

export interface Team {
  number: number;
  name: string;
  captainId?: string;
  slots: Record<CoreRole, string | null>;
}

export interface MatchItem {
  id: string;
  index: number; // 0-based
  blueTeam: number;
  redTeam: number;
  state: "pending" | "drafting" | "done";
  links?: { blue: string; red: string; spec: string; stream?: string };
  messageId?: string; // board message id
}

export interface LobbyState {
  guildId: string;
  channelId: string;
  messageId: string;
  name: string;
  mode: LobbyMode;
  teamCount: number;

  // waiting room
  slots: Record<RoleName, string[]>;
  caps: Record<RoleName, number | null>;

  // Team Builder
  teams: Team[];
  page: number;
  format?: string; // "2t-bo1"/"2t-bo3"/...
  pool: string[];
  lastSelectedTeam?: number;
  lastSelectedRole?: CoreRole;
  lastSelectedPlayer?: string;

  // V3
  channels?: Record<number, TeamChannelsRef>; // teamNo -> channels
  matches?: MatchItem[];
  currentMatchIndex?: number;
}

const store = new Map<string, LobbyState>(); // key = lobby messageId
const lastByChannel = new Map<string, string>(); // channelId -> lobbyMessageId

export function createState(
  partial: Omit<
    LobbyState,
    "messageId" | "slots" | "caps" | "teams" | "page" | "pool"
  > & {
    messageId?: string;
  }
): LobbyState {
  const capsBase: Record<RoleName, number | null> = {
    Top: partial.teamCount,
    Jungle: partial.teamCount,
    Mid: partial.teamCount,
    ADC: partial.teamCount,
    Support: partial.teamCount,
    Flex: partial.teamCount,
    Sub: null,
  };
  const st: LobbyState = {
    ...partial,
    messageId: partial.messageId ?? "",
    slots: {
      Top: [],
      Jungle: [],
      Mid: [],
      ADC: [],
      Support: [],
      Flex: [],
      Sub: [],
    },
    caps: capsBase,
    teams: [],
    page: 1,
    pool: [],
  };
  ensureTeams(st, partial.teamCount);
  if (st.messageId) store.set(st.messageId, st);
  return st;
}

export function setMessageId(oldMsgId: string, newMsgId: string) {
  const st = store.get(oldMsgId);
  if (st) {
    store.delete(oldMsgId);
    st.messageId = newMsgId;
    store.set(newMsgId, st);
  }
}
export function put(state: LobbyState) {
  store.set(state.messageId, state);
}
export function get(messageId: string) {
  return store.get(messageId);
}
export function rememberState(channelId: string, lobbyMessageId: string) {
  lastByChannel.set(channelId, lobbyMessageId);
}
export function findStateByChannel(channelId: string | null) {
  if (!channelId) return undefined;
  const msgId = lastByChannel.get(channelId);
  if (!msgId) return undefined;
  return get(msgId);
}

/* ---------- Waiting room helpers ---------- */

export function toggleJoin(
  state: LobbyState,
  role: RoleName,
  userId: string
): { ok: boolean; reason?: string } {
  const list = state.slots[role];
  const cap = state.caps[role];
  const idx = list.indexOf(userId);
  if (idx >= 0) {
    list.splice(idx, 1);
    return { ok: true };
  }
  if (cap !== null && list.length >= cap)
    return { ok: false, reason: "Cap atteint pour ce rôle." };
  list.push(userId);
  return { ok: true };
}

/* ---------- Team Builder helpers ---------- */

export function buildPoolFromSlots(state: LobbyState) {
  const all = new Set<string>();
  (Object.keys(state.slots) as RoleName[]).forEach((r) => {
    state.slots[r].forEach((u) => all.add(u));
  });
  state.pool = Array.from(all);
}

export function ensureTeams(state: LobbyState, teamCount: number) {
  const need = teamCount - state.teams.length;
  for (let i = 0; i < need; i++) {
    const n = state.teams.length + 1;
    state.teams.push({
      number: n,
      name: `Team ${n}`,
      slots: { Top: null, Jungle: null, Mid: null, ADC: null, Support: null },
    });
  }
  if (need < 0) state.teams = state.teams.slice(0, teamCount);
  const maxPage = Math.max(1, Math.ceil(teamCount / 2));
  if (state.page > maxPage) state.page = maxPage;
}

export function assignPlayer(
  state: LobbyState,
  teamNo: number,
  role: CoreRole,
  userId: string
) {
  ensureTeams(state, state.teamCount);
  const team = state.teams.find((t) => t.number === teamNo);
  if (!team) return { ok: false, reason: "Équipe inconnue." };

  state.teams.forEach((t) => {
    (Object.keys(t.slots) as CoreRole[]).forEach((r) => {
      if (t.slots[r] === userId) t.slots[r] = null;
    });
    if (t.captainId === userId) t.captainId = undefined;
  });

  const prev = team.slots[role];
  if (prev && !state.pool.includes(prev)) state.pool.push(prev);

  const idx = state.pool.indexOf(userId);
  if (idx >= 0) state.pool.splice(idx, 1);

  team.slots[role] = userId;
  return { ok: true };
}

export function setCaptain(state: LobbyState, teamNo: number, userId: string) {
  const team = state.teams.find((t) => t.number === teamNo);
  if (!team) return { ok: false, reason: "Équipe inconnue." };
  const isInTeam = (Object.values(team.slots) as (string | null)[]).includes(
    userId
  );
  if (!isInTeam)
    return { ok: false, reason: "Le capitaine doit être dans l'équipe." };
  team.captainId = userId;
  return { ok: true };
}

/* ---------- V3: matches & draft cycle ---------- */

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export async function finalizeLobbyAndOpenFirstMatch(
  state: LobbyState,
  guild: Guild,
  matchChannelId: string
) {
  // 1) créer catégories/salons par équipe
  state.channels = state.channels ?? {};
  for (const team of state.teams) {
    const ref = await createTeamCategory(guild, team.name);
    state.channels[team.number] = ref;

    // ping capitaine si présent
    if (team.captainId) {
      const text = guild.channels.cache.get(ref.textId);
      if (text?.isTextBased()) {
        try {
          await text.send(
            `👋 <@${team.captainId}> voici votre salon d'équipe.`
          );
        } catch {}
      }
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  // 2) plan de matchs (2 équipes : bo1/bo3/bo5)
  const fmt = (state.format ?? "2t-bo1") as FormatCode;
  const seq = buildFormatPlan(state.teamCount, fmt);

  // 3) matches[]
  state.matches = seq.map((p, idx) => ({
    id: uid(),
    index: idx,
    blueTeam: p.blueTeam,
    redTeam: p.redTeam,
    state: "pending",
  }));
  state.currentMatchIndex = 0;
  rememberState(matchChannelId, state.messageId);
  // 4) ouvrir le premier match
  await openMatch(state, guild, matchChannelId);
}

async function openMatch(
  state: LobbyState,
  guild: Guild,
  matchChannelId: string
) {
  if (!state.matches?.length) return;
  const i = state.currentMatchIndex ?? 0;
  const match = state.matches[i];
  if (!match) return;

  // Noms d'équipes
  const blueTeamObj = state.teams.find((t) => t.number === match.blueTeam)!;
  const redTeamObj = state.teams.find((t) => t.number === match.redTeam)!;

  // Tirage au sort : on permute 50/50 les côtés
  const swap = Math.random() < 0.5;
  const blueName = swap ? redTeamObj.name : blueTeamObj.name;
  const redName = swap ? blueTeamObj.name : redTeamObj.name;

  // Génère liens LoLProDraft (fonctionne comme dans ton ZIP)
  const links = createDraftLinks(blueName, redName);
  match.links = links;
  match.state = "drafting";

  // Envoi des liens privés dans chaque équipe
  const sendToTeam = async (
    teamNo: number,
    link: string,
    color: "Blue" | "Red"
  ) => {
    const ref = state.channels?.[teamNo];
    if (!ref) return;
    const ch = guild.channels.cache.get(ref.textId);
    if (!ch || !ch.isTextBased()) return;
    const captain = state.teams.find((t) => t.number === teamNo)?.captainId;
    const mention = captain ? `<@${captain}> ` : "";
    await ch.send(`${mention}🔗 **Lien ${color}** : ${link}`);
  };

  const blueTeamNo = swap ? match.redTeam : match.blueTeam;
  const redTeamNo = swap ? match.blueTeam : match.redTeam;

  await sendToTeam(blueTeamNo, links.blue, "Blue");
  await sendToTeam(redTeamNo, links.red, "Red");

  // Poste/Met à jour le board public avec ONLY spectate
  const board = guild.channels.cache.get(matchChannelId);
  if (board?.isTextBased()) {
    const msg = await board.send(matchEmbed(state, match));
    match.messageId = msg.id;

    rememberState(matchChannelId, state.messageId);
  }
}

export async function nextMatch(i: ButtonInteraction) {
  const state = findStateByChannel(i.channelId);
  if (!state || !state.matches)
    return { ok: false, message: "Lobby introuvable." };

  const idx = state.currentMatchIndex ?? 0;
  if (!state.matches[idx])
    return { ok: false, message: "Aucun match courant." };

  // close courant
  state.matches[idx].state = "done";

  // next
  const nxt = idx + 1;
  if (nxt >= state.matches.length) {
    await cleanupAllCategories(i.guild!, state);
    return { ok: true, message: "🏁 Série terminée. Catégories nettoyées." };
  }
  state.currentMatchIndex = nxt;

  // ouvrir match suivant
  await openMatch(state, i.guild!, process.env.MATCH_CHANNEL_ID!);
  return { ok: true, message: `➡️ Match ${nxt + 1} lancé.` };
}

export async function repostLinksForCurrent(i: ButtonInteraction) {
  const state = findStateByChannel(i.channelId);
  if (!state || !state.matches)
    return { ok: false, reason: "Lobby introuvable." };
  const idx = state.currentMatchIndex ?? 0;
  const m = state.matches[idx];
  if (!m) return { ok: false, reason: "Aucun match courant." };

  // on génère de nouveaux liens pour le même pairing
  const blueTeamObj = state.teams.find((t) => t.number === m.blueTeam)!;
  const redTeamObj = state.teams.find((t) => t.number === m.redTeam)!;
  const links = createDraftLinks(blueTeamObj.name, redTeamObj.name);
  m.links = links;

  // éditer le message si existant
  if (m.messageId) {
    const ch = i.guild!.channels.cache.get(process.env.MATCH_CHANNEL_ID!);
    if (ch?.isTextBased()) {
      try {
        const msg = await ch.messages.fetch(m.messageId);
        await msg.edit(matchEmbed(state, m));
      } catch {
        /* ignore */
      }
    }
  }
  return { ok: true };
}

export async function skipMatch(i: ButtonInteraction) {
  const state = findStateByChannel(i.channelId);
  if (!state || !state.matches)
    return { ok: false, message: "Lobby introuvable." };
  const idx = state.currentMatchIndex ?? 0;
  const m = state.matches[idx];
  if (!m) return { ok: false, message: "Aucun match courant." };

  m.state = "done";
  const nxt = idx + 1;
  if (nxt >= state.matches.length) {
    await cleanupAllCategories(i.guild!, state);
    return {
      ok: true,
      message: "⏭️ Skip du dernier match → série terminée, cleanup effectué.",
    };
  }
  state.currentMatchIndex = nxt;
  await openMatch(state, i.guild!, process.env.MATCH_CHANNEL_ID!);
  return {
    ok: true,
    message: `⏭️ Match ${idx + 1} ignoré → Match ${nxt + 1} lancé.`,
  };
}

async function cleanupAllCategories(guild: Guild, state: LobbyState) {
  if (!state.channels) return;
  const entries = Object.values(state.channels);
  for (const ref of entries) {
    await deleteTeamCategory(guild, ref);
    await new Promise((r) => setTimeout(r, 300));
  }
  state.channels = {};
}
