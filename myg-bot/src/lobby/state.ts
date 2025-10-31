import { prisma, } from "../prisma";

export function roleCap(teams: number, role: "TOP"|"JGL"|"MID"|"ADC"|"SUPP"|"SUB") {
  if (role === "SUB") return Number.MAX_SAFE_INTEGER;
  return teams === 4 ? 4 : 2;
}

export async function countByRole(lobbyId: string) {
  const rows = await prisma.lobbyParticipant.groupBy({
    by: ["role"],
    where: { lobbyId },
    _count: { _all: true },
  });
  const map = new Map<string, number>();
  for (const r of rows) map.set(r.role, r._count._all);
  return (role: string) => map.get(role) ?? 0;
}
