export function tbTeamSelectId(lobbyId: string) {
  return `TB:TEAM:${lobbyId}`;
}

// encode teamId dans ROLE pour garder le contexte
export function tbRoleSelectId(lobbyId: string, teamId: string) {
  return `TB:ROLE:${lobbyId}:${teamId}`;
}

export function tbPlayerSelectId(lobbyId: string, role: string) {
  return `TB:PLAYER:${lobbyId}:${role}`;
}

// boutons principaux
export function tbCaptainButtonId(lobbyId: string) { return `TB:CAPTAIN:${lobbyId}`; }
export function tbNameButtonId(lobbyId: string) { return `TB:NAME:${lobbyId}`; }
export function tbFormatButtonId(lobbyId: string) { return `TB:FORMAT:${lobbyId}`; }
export function tbValidateButtonId(lobbyId: string) { return `TB:VALIDATE:${lobbyId}`; }

// selects auxiliaires
export function tbNameTeamSelectId(lobbyId: string) { return `TB:NAME:TEAMSEL:${lobbyId}`; }
export function tbCaptainTeamSelectId(lobbyId: string) { return `TB:CAP:TEAMSEL:${lobbyId}`; }
export function tbCaptainMemberSelectId(lobbyId: string, teamId: string) { return `TB:CAP:MEM:${lobbyId}:${teamId}`; }
export function tbFormatSelectId(lobbyId: string) { return `TB:FORMAT:SELECT:${lobbyId}`; }

export function parseTb(id: string):
  | { kind: "TEAM"; lobbyId: string }
  | { kind: "ROLE"; lobbyId: string; teamId: string }
  | { kind: "PLAYER"; lobbyId: string; role: string }
  | null {
  const p = id.split(":");
  if (p[0] !== "TB") return null;
  if (p[1] === "TEAM") return { kind: "TEAM", lobbyId: p[2] };
  if (p[1] === "ROLE") return { kind: "ROLE", lobbyId: p[2], teamId: p[3] };
  if (p[1] === "PLAYER") return { kind: "PLAYER", lobbyId: p[2], role: p[3] };
  return null;
}
