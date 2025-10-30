// src/bot/utils/schedule.ts

export type FormatCode = "2t-bo1" | "2t-bo3" | "2t-bo5"; // on implémente bo1/bo3 maintenant
export interface MatchPair {
  blueTeam: number;
  redTeam: number;
}

/**
 * Retourne la liste des paires de teams (numéros) à jouer dans l'ordre.
 * Pour 2 équipes : toujours Team1 vs Team2 ; Bo3 = 3 rounds.
 */
export function buildFormatPlan(
  teamCount: number,
  format: FormatCode
): MatchPair[] {
  if (teamCount !== 2) {
    // on étendra pour 4/6 équipes ensuite
    // pour l’instant, on fallback en un seul match entre Team1 et Team2
    return [{ blueTeam: 1, redTeam: 2 }];
  }

  const base = [{ blueTeam: 1, redTeam: 2 }];
  if (format === "2t-bo1") return base;
  if (format === "2t-bo3") return [...base, ...base, ...base];
  if (format === "2t-bo5") return [...base, ...base, ...base, ...base, ...base];
  return base;
}
