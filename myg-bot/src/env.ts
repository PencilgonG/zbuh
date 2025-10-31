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

export const env = Env.parse(process.env);
