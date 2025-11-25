// src/lib/templates.ts
import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * On lit les templates dans src/templates/... pour que ça marche
 * en dev (tsx) comme en prod (Docker).
 */
const TEMPLATE_ROOT = path.join(process.cwd(), "src", "templates");

/**
 * Template très simple basé sur {{PLACEHOLDER}}.
 * Pas de logique, juste des remplacements texte.
 */
export async function renderTemplate(
  relPath: string,
  data: Record<string, unknown>,
): Promise<string> {
  const filePath = path.join(TEMPLATE_ROOT, relPath);
  let raw = await readFile(filePath, "utf8");

  raw = raw.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key) => {
    const value = data[key];
    if (value === undefined || value === null) return "";
    return String(value);
  });

  return raw;
}
