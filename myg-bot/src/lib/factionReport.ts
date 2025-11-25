// src/lib/factionReport.ts
import { renderTemplate } from "./templates";
import { htmlToPngBuffer } from "./pdf";
import { env } from "../env";

interface FactionMember {
  name: string;
  role: string;
  points: number;
}

interface FactionReportData {
  name: string;
  level: number;
  progress: number;
  score: number;
  season: string;
  summary: string;
  members: FactionMember[];
  membersCount: number;
  winrate: string;
}

/**
 * Données factices Freljord pour le debug.
 * Plus tard, on branchera ça sur la vraie BDD.
 */
export function buildMockFreljordReport(): FactionReportData {
  const members: FactionMember[] = [
    { name: "Gin", role: "CAPTAIN", points: 420 },
    { name: "Evaann", role: "SHOTCALLER", points: 333 },
    { name: "Kiji", role: "CLUTCH", points: 270 },
    { name: "Guest 1", role: "MEMBER", points: 190 },
    { name: "Guest 2", role: "MEMBER", points: 165 },
  ];

  return {
    name: "Freljord",
    level: 3,
    progress: 64,
    score: 1375,
    season: "1",
    summary:
      "Freljord progresse tranquillement mais sûrement. La faction mise sur la régularité, des drafts stables et une bonne ambiance en vocal. Votre force : la coordination en teamfight.",
    members,
    membersCount: members.length,
    winrate: "54%",
  };
}

/**
 * Construit le HTML à partir du template + données.
 */
export async function renderFactionReportHtml(
  data: FactionReportData,
): Promise<string> {
  const membersHtml = data.members
    .map(
      (m) => `
      <div class="member-row">
        <span>${m.name}</span>
        <span class="role">${m.role}</span>
        <span>${m.points} pts</span>
      </div>`,
    )
    .join("");

  const now = new Date();
  const generatedAt = now.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const html = await renderTemplate("factions/report.html", {
    name: data.name,
    level: data.level,
    progress: data.progress,
    score: data.score,
    season: data.season,
    summary: data.summary,
    membersCount: data.membersCount,
    winrate: data.winrate,
    membersHtml,
    bannerUrl: env.BANNER_FRELJORD ?? env.BANNER_URL,
    logoUrl: env.LOGO_URL,
    generatedAt,
  });

  return html;
}

/**
 * Helper utilisé par /debug faction-report :
 * renvoie directement le Buffer PNG prêt à envoyer sur Discord.
 */
export async function renderMockFreljordReportPng(): Promise<Buffer> {
  const data = buildMockFreljordReport();
  const html = await renderFactionReportHtml(data);
  return htmlToPngBuffer(html);
}
