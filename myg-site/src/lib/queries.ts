import { sql } from "./db";

/** Helpers */
type RoleDb = "TOP" | "JGL" | "MID" | "ADC" | "SUPP" | "SUB";
type RoleUi = "TOP" | "JUNGLE" | "MID" | "ADC" | "SUPPORT";

function mapRoleToUi(r?: RoleDb | null): RoleUi | null {
  if (!r) return null;
  switch (r) {
    case "JGL": return "JUNGLE";
    case "SUPP": return "SUPPORT";
    case "TOP":
    case "MID":
    case "ADC": return r;
    case "SUB": return null; // on ne classe pas SUB dans les 5 lignes
  }
}

/**
 * PROFILES
 * Lit les profils dans "UserProfile".
 * Classe par rôle = mainRole, fallback secondaryRole.
 * Note: pas d'avatar en DB -> on enverra null (le front affiche un placeholder).
 */
export async function qProfiles() {
  if (!sql) return { items: [] };

  const rows = await sql/* sql */`
    SELECT
      "discordId",
      "summonerName",
      "elo",
      "mainRole",
      "secondaryRole",
      "opggUrl",
      "dpmUrl",
      "updatedAt"
    FROM "UserProfile"
    ORDER BY "updatedAt" DESC;
  `;

  const items = (rows as any[]).map((r) => {
    const role =
      mapRoleToUi(r.mainRole as RoleDb | null) ??
      mapRoleToUi(r.secondaryRole as RoleDb | null);

    return {
      id: String(r.discordId),
      discordId: String(r.discordId),
      discordTag: "", // non stocké en DB — laisser vide (ou à peupler plus tard)
      role,                           // TOP | JUNGLE | MID | ADC | SUPPORT | null
      summonerName: r.summonerName ?? "",
      region: "",                     // non présent dans le schéma (laisser vide)
      opggUrl: r.opggUrl ?? null,
      dpmUrl: r.dpmUrl ?? null,
      avatarUrl: null                 // non présent en DB (placeholder côté front)
    };
  }).filter(p => p.role !== null); // on enlève SUB / inconnus des 5 lignes

  // Trie final par rôle puis par nom d'invocateur
  items.sort((a, b) => {
    const order: Record<RoleUi, number> = { TOP: 0, JUNGLE: 1, MID: 2, ADC: 3, SUPPORT: 4 };
    const ra = a.role as RoleUi, rb = b.role as RoleUi;
    if (order[ra] !== order[rb]) return order[ra] - order[rb];
    return a.summonerName.localeCompare(b.summonerName);
  });

  return { items };
}

/**
 * LIVE MATCHES
 * "Match" avec state = RUNNING
 * On expose: id, startedAt (= createdAt), matchNumber (= round)
 */
export async function qLiveMatches() {
  if (!sql) return { items: [] };

  const rows = await sql/* sql */`
    SELECT "id", "createdAt", "round"
    FROM "Match"
    WHERE "state" = 'RUNNING'
    ORDER BY "createdAt" DESC
    LIMIT 20;
  `;

  const items = (rows as any[]).map(r => ({
    id: String(r.id),
    startedAt: r.createdAt as string,
    matchNumber: (r.round ?? null) as number | null
  }));

  return { items };
}

/**
 * RECENT MATCHES (FINISHED)
 * Joint "Team" (A/B) et reconstruit les 10 joueurs via "TeamMember" -> "LobbyParticipant".
 * winner = "A" | "B" | null selon winnerTeamId.
 */
export async function qRecentMatches(limit = 20) {
  if (!sql) return { items: [] };
  const lim = Math.min(Math.max(limit, 1), 50);

  const base = await sql/* sql */`
    SELECT
      m."id",
      m."createdAt",
      m."round",
      m."winnerTeamId",
      ta."id"   AS "teamAId",
      ta."name" AS "teamAName",
      tb."id"   AS "teamBId",
      tb."name" AS "teamBName"
    FROM "Match" m
    JOIN "Team" ta ON ta."id" = m."teamAId"
    JOIN "Team" tb ON tb."id" = m."teamBId"
    WHERE m."state" = 'FINISHED'
    ORDER BY m."createdAt" DESC
    LIMIT ${lim};
  `;

  const results: any[] = [];

  for (const r of base as any[]) {
    const [pa, pb] = await Promise.all([
      sql/* sql */`
        SELECT lp."discordId", lp."display", lp."role"
        FROM "TeamMember" tm
        JOIN "LobbyParticipant" lp ON lp."id" = tm."lobbyParticipantId"
        WHERE tm."teamId" = ${r.teamAId}
        ORDER BY lp."role" ASC, lp."display" ASC;
      `,
      sql/* sql */`
        SELECT lp."discordId", lp."display", lp."role"
        FROM "TeamMember" tm
        JOIN "LobbyParticipant" lp ON lp."id" = tm."lobbyParticipantId"
        WHERE tm."teamId" = ${r.teamBId}
        ORDER BY lp."role" ASC, lp."display" ASC;
      `
    ]);

    const winner: "A" | "B" | null =
      r.winnerTeamId == null ? null : (r.winnerTeamId === r.teamAId ? "A" : (r.winnerTeamId === r.teamBId ? "B" : null));

    results.push({
      id: String(r.id),
      createdAt: r.createdAt as string,
      matchNumber: (r.round ?? null) as number | null,
      winner,
      teamA: {
        id: String(r.teamAId),
        name: r.teamAName as string,
        // On renvoie les discordId; sur le front on pourra tenter un mapping vers les profils
        playerIds: (pa as any[]).map(x => x.discordId ? String(x.discordId) : String(x.display))
      },
      teamB: {
        id: String(r.teamBId),
        name: r.teamBName as string,
        playerIds: (pb as any[]).map(x => x.discordId ? String(x.discordId) : String(x.display))
      }
    });
  }

  return { items: results };
}
