// src/team/schedule.ts
export type LobbyFormat = "BO1" | "BO3" | "BO5" | "RR1" | "RR2" | "RR3";

export interface TeamLike {
  id: string;
  name: string;
}

export interface ScheduledMatch {
  round: number;
  teamA: TeamLike;
  teamB: TeamLike;
}

/**
 * Planning:
 * - 2 teams (BO1/BO3/BO5): n rounds between the same two teams.
 * - 4 teams (RR1/RR2/RR3): classic round-robin rounds:
 *     Round 1: A-B, C-D
 *     Round 2: A-C, B-D
 *     Round 3: A-D, B-C
 *   RR1 = 1 round (2 matches), RR2 = 2 rounds (4 matches), RR3 = 3 rounds (6 matches).
 *   We only progress to the next round after both matches of the current round are validated
 *   (handled in flow.ts).
 */
export function generateSchedule(
  teams: TeamLike[],
  format: LobbyFormat
): ScheduledMatch[] {
  // 2 teams: BOx
  if (teams.length === 2) {
    const [teamA, teamB] = teams;
    const n = format === "BO5" ? 5 : format === "BO3" ? 3 : 1;
    return Array.from({ length: n }, (_, i) => ({
      round: i + 1,
      teamA,
      teamB,
    }));
  }

  // 4 teams: RR1/RR2/RR3 → 1/2/3 rounds of the round-robin pattern
  if (teams.length === 4) {
    const cycles = format === "RR3" ? 3 : format === "RR2" ? 2 : 1;

    // Index pairs per round (A=0, B=1, C=2, D=3)
    const idxPairs: [number, number][][] = [
      [
        [0, 1], // A-B
        [2, 3], // C-D
      ],
      [
        [0, 2], // A-C
        [1, 3], // B-D
      ],
      [
        [0, 3], // A-D
        [1, 2], // B-C
      ],
    ];

    const matches: ScheduledMatch[] = [];
    for (let r = 0; r < cycles; r++) {
      const pairs = idxPairs[r]; // r = 0..cycles-1
      const roundNumber = r + 1;
      matches.push(
        {
          round: roundNumber,
          teamA: teams[pairs[0][0]],
          teamB: teams[pairs[0][1]],
        },
        {
          round: roundNumber,
          teamA: teams[pairs[1][0]],
          teamB: teams[pairs[1][1]],
        }
      );
    }
    return matches;
  }

  throw new Error(`Unsupported team count/format: teams=${teams.length}, format=${format}`);
}
