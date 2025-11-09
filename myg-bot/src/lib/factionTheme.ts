// src/lib/factionTheme.ts
// Thème visuel par faction (couleur + bannière optionnelle).
// - Les URLs de bannières peuvent être fournies via les variables d'env suivantes :
//   BANNER_DEMACIA_URL, BANNER_FRELJORD_URL, BANNER_ZAUN_URL,
//   BANNER_NOXUS_URL, BANNER_PILTOVER_URL, BANNER_SHURIMA_URL, BANNER_IONIA_URL
// - Sinon, on ne met pas d'image et on laisse mygEmbedBase gérer le visuel par défaut.

export type FactionKey =
  | "DEMACIA"
  | "FRELJORD"
  | "ZAUN"
  | "NOXUS"
  | "PILTOVER"
  | "SHURIMA"
  | "IONIA";

type Theme = {
  color: number;       // Embed color (0xRRGGBB)
  bannerUrl?: string;  // Optional: image to set on embed
};

const envUrl = (name: string) => process.env[name]?.trim() || undefined;

const THEMES: Record<FactionKey, Theme> = {
  DEMACIA: {
    color: 0xd9b873,
    bannerUrl: envUrl("BANNER_DEMACIA_URL"),
  },
  FRELJORD: {
    color: 0x89c8ff,
    bannerUrl: envUrl("BANNER_FRELJORD_URL"),
  },
  ZAUN: {
    color: 0x59d36a,
    bannerUrl: envUrl("BANNER_ZAUN_URL"),
  },
  NOXUS: {
    color: 0xc2362b,
    bannerUrl: envUrl("BANNER_NOXUS_URL"),
  },
  PILTOVER: {
    color: 0xd0a66a,
    bannerUrl: envUrl("BANNER_PILTOVER_URL"),
  },
  SHURIMA: {
    color: 0xcaa55a,
    bannerUrl: envUrl("BANNER_SHURIMA_URL"),
  },
  IONIA: {
    color: 0xe2b7c9,
    bannerUrl: envUrl("BANNER_IONIA_URL"),
  },
};

export function getFactionTheme(faction?: string | null): Theme | null {
  if (!faction) return null;
  const key = faction.toUpperCase().replace(/\s+/g, "") as FactionKey;
  return (THEMES as any)[key] ?? null;
}

/**
 * Utilitaire pratique : applique (optionnellement) la couleur et la bannière
 * d'une faction sur un EmbedBuilder-like.
 *
 * Usage:
 *   const theme = getFactionTheme(profile.factionKey);
 *   applyFactionTheme(embed, theme);
 */
export function applyFactionTheme<T extends { setColor?: (c: number) => T; setImage?: (u: string) => T }>(
  embed: T,
  theme: Theme | null,
): T {
  if (!theme) return embed;
  if (theme.color && typeof embed.setColor === "function") embed.setColor(theme.color);
  if (theme.bannerUrl && typeof embed.setImage === "function") embed.setImage(theme.bannerUrl);
  return embed;
}
