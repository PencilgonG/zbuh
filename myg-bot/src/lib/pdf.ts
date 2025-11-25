// src/lib/pdf.ts

/**
 * Options génériques pour un futur rendu de fiche de faction.
 * Pour l'instant, c'est un stub minimal qui renvoie une image vide.
 */
export interface FactionReportRenderOptions {
  factionName: string;
  seasonLabel?: string;
  // plus tard: stats, joueurs, etc.
}

/**
 * Stub: renvoie un PNG 1×1 transparent.
 * On branchera plus tard un vrai moteur HTML -> PNG.
 */
export async function renderFactionReportPng(
  _opts: FactionReportRenderOptions,
): Promise<Buffer> {
  // PNG 1x1 transparent en base64
  const base64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";
  return Buffer.from(base64, "base64");
}
