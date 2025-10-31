type TeamLike = { id: string; name: string };
type Pairing = { teamA: TeamLike; teamB: TeamLike; round: number };

// mode: "BO1" | "BO3" | "BO5" | "RR1" | "RR2" | "RR3"
export function generateSchedule(teams: TeamLike[], mode: string): Pairing[] {
  if (teams.length === 2) {
    const [A, B] = teams;
    if (mode === "BO5") {
      return [
        { teamA: A, teamB: B, round: 1 },
        { teamA: A, teamB: B, round: 2 },
        { teamA: A, teamB: B, round: 3 },
        { teamA: A, teamB: B, round: 4 },
        { teamA: A, teamB: B, round: 5 },
      ];
    }
    if (mode === "BO3") {
      return [
        { teamA: A, teamB: B, round: 1 },
        { teamA: A, teamB: B, round: 2 },
        { teamA: A, teamB: B, round: 3 },
      ];
    }
    // BO1 par défaut
    return [{ teamA: A, teamB: B, round: 1 }];
  }

  if (teams.length === 4) {
    const T = teams;
    if (mode === "RR2") {
      return [
        { teamA: T[0], teamB: T[1], round: 1 },
        { teamA: T[2], teamB: T[3], round: 1 },
        { teamA: T[0], teamB: T[2], round: 2 },
        { teamA: T[1], teamB: T[3], round: 2 },
      ];
    }
    if (mode === "RR3") {
      return [
        { teamA: T[0], teamB: T[1], round: 1 },
        { teamA: T[2], teamB: T[3], round: 1 },
        { teamA: T[0], teamB: T[2], round: 2 },
        { teamA: T[1], teamB: T[3], round: 2 },
        { teamA: T[0], teamB: T[3], round: 3 },
        { teamA: T[1], teamB: T[2], round: 3 },
      ];
    }
    // RR1
    return [
      { teamA: T[0], teamB: T[1], round: 1 },
      { teamA: T[2], teamB: T[3], round: 1 },
    ];
  }

  return [];
}
