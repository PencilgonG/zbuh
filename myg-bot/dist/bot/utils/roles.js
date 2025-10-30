import { ROLE_RESPO_ID } from "./constants.js";
export function isRespo(m) {
    if (!m)
        return false;
    return m.roles.cache.has(ROLE_RESPO_ID);
}
