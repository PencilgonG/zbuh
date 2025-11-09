// src/env.ts
import "dotenv/config";
import { z } from "zod";

const Env = z.object({
  DISCORD_TOKEN: z.string().min(1),
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_GUILD_ID: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  ROLE_RESPO_ID: z.string().min(1),
  MATCH_CHANNEL_ID: z.string().min(1),
  LINEUP_CHANNEL_ID: z.string().min(1),
  RESULTS_CHANNEL_ID: z.string().min(1),
  VOTE_CHANNEL_ID: z.string().min(1),
  LOGO_URL: z.string().url(),
  BANNER_URL: z.string().url(),
});

type EnvType = z.infer<typeof Env>;

// on étend le type avec l'alias legacy RESULT_CHANNEL_ID
export const env = Env.parse(process.env) as EnvType & { RESULT_CHANNEL_ID: string };

// alias getter pour compat (code existant qui lit RESULT_CHANNEL_ID)
Object.defineProperty(env, "RESULT_CHANNEL_ID", {
  get() {
    return env.RESULTS_CHANNEL_ID;
  },
});
