import { config } from "dotenv";
config();

export const ROLE_RESPO_ID = process.env.ROLE_RESPO_ID!;
export const LOGO_URL = process.env.LOGO_URL || "";
export const BANNER_URL = process.env.BANNER_URL || "";

export const ROLES = [
  "Top",
  "Jungle",
  "Mid",
  "ADC",
  "Support",
  "Flex",
  "Sub",
] as const;
export type RoleName = (typeof ROLES)[number];
export type CoreRole = "Top" | "Jungle" | "Mid" | "ADC" | "Support";

export const JOIN_IDS = {
  Top: "lobby:join:Top",
  Jungle: "lobby:join:Jungle",
  Mid: "lobby:join:Mid",
  ADC: "lobby:join:ADC",
  Support: "lobby:join:Support",
  Flex: "lobby:join:Flex",
  Sub: "lobby:join:Sub",
} as const;

// Team Builder selects & buttons
export const TB_SELECT_TEAM = "tb:select:team";
export const TB_SELECT_ROLE = "tb:select:role";
export const TB_SELECT_PLAYER = "tb:select:player";

export const TB_PREV = "tb:prev";
export const TB_NEXT = "tb:next";
export const TB_SET_CAP = "tb:setcap";
export const TB_NAME = "tb:name";
export const TB_FORMAT = "tb:format";
export const TB_FINALIZE = "tb:finalize";

// 👇 nouveaux IDs pour tes flows
export const TB_SET_CAP_TEAM = "tb:setcap:team";
export const TB_SET_CAP_PLAYER = "tb:setcap:player";
export const TB_NAME_TEAM = "tb:name:team";

export const BTN_VALIDATE_ID = "lobby:validate";
export const BTN_FAKE_ID = "lobby:fake";
// + à la fin de ton fichier existant
export const MATCH_VALIDATE = "match:validate";
export const MATCH_REPOST = "match:repost";
export const MATCH_SKIP = "match:skip";
