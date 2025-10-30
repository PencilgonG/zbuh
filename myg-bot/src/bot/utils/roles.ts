import type { GuildMember } from "discord.js";
import { ROLE_RESPO_ID } from "./constants.js";

export function isRespo(m: GuildMember | null) {
  if (!m) return false;
  return m.roles.cache.has(ROLE_RESPO_ID);
}
