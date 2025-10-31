export type LobbyButtonKind = "JOIN" | "QUIT" | "TEST" | "VALIDATE";
export type JoinRole = "TOP" | "JGL" | "MID" | "ADC" | "SUPP" | "SUB";

export function lobbyJoinId(lobbyId: string, role: JoinRole) {
  return `LOBBY:JOIN:${role}:${lobbyId}`;
}
export function lobbyQuitId(lobbyId: string) {
  return `LOBBY:QUIT:${lobbyId}`;
}
export function lobbyTestId(lobbyId: string) {
  return `LOBBY:TEST:${lobbyId}`;
}
export function lobbyValidateId(lobbyId: string) {
  return `LOBBY:VALIDATE:${lobbyId}`;
}

export function parseLobbyCustomId(id: string):
  | { kind: "JOIN"; role: JoinRole; lobbyId: string }
  | { kind: "QUIT" | "TEST" | "VALIDATE"; lobbyId: string }
  | null {
  const parts = id.split(":");
  if (parts[0] !== "LOBBY") return null;
  if (parts[1] === "JOIN" && parts.length === 4) {
    const role = parts[2] as JoinRole;
    const lobbyId = parts[3];
    return { kind: "JOIN", role, lobbyId };
  }
  if (["QUIT","TEST","VALIDATE"].includes(parts[1]) && parts.length === 3) {
    return { kind: parts[1] as "QUIT"|"TEST"|"VALIDATE", lobbyId: parts[2] };
  }
  return null;
}
