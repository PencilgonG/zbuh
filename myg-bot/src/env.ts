import "dotenv/config";
import { z } from "zod";

const Env = z.object({
  DISCORD_TOKEN: z.string().min(1),
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_GUILD_ID: z.string().min(1),
  DATABASE_URL: z.string().min(1),

  // Rôles & canaux principaux
  ROLE_RESPO_ID: z.string().min(1),
  MATCH_CHANNEL_ID: z.string().min(1),
  LINEUP_CHANNEL_ID: z.string().min(1),
  RESULTS_CHANNEL_ID: z.string().min(1),
  VOTE_CHANNEL_ID: z.string().min(1),

  // ➕ Rôles par région & salon des duels
  ROLE_DEMACIA_ID: z.string().min(1),
  ROLE_NOXUS_ID: z.string().min(1),
  ROLE_IONIA_ID: z.string().min(1),
  ROLE_FRELJORD_ID: z.string().min(1),
  ROLE_PILTOVER_ID: z.string().min(1),
  ROLE_SHURIMA_ID: z.string().min(1),
  ROLE_ZAUN_ID: z.string().min(1),
  DUELS_CHANNEL_ID: z.string().min(1),

  // requis historiquement par mygEmbedBase
  LOGO_URL: z
    .string()
    .url()
    .default("https://i.imgur.com/5jeFZRK.png"),
  BANNER_URL: z
    .string()
    .url()
    .default("https://i.imgur.com/HfRoVgQ.png"),

  // bannières par faction (optionnelles)
  BANNER_DEMACIA: z.string().url().optional(),
  BANNER_FRELJORD: z.string().url().optional(),
  BANNER_NOXUS: z.string().url().optional(),
  BANNER_IONIA: z.string().url().optional(),
  BANNER_PILTOVER: z.string().url().optional(),
  BANNER_SHURIMA: z.string().url().optional(),
  BANNER_ZAUN: z.string().url().optional(),

  // ➕ Nouvel env : User IDs admin
  // Format : "123,456,789"
  ADMIN_USER_IDS: z.string().optional(),
});

type EnvType = z.infer<typeof Env>;

// on étend le type avec l'alias legacy RESULT_CHANNEL_ID
export const env = Env.parse(process.env) as EnvType & {
  RESULT_CHANNEL_ID: string;
};

Object.defineProperty(env, "RESULT_CHANNEL_ID", {
  get() {
    return env.RESULTS_CHANNEL_ID;
  },
});
