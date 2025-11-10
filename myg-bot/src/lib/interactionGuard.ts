// src/lib/interactionGuard.ts
const seen = new Map<string, number>(); // interaction.id -> timestamp

export function alreadyHandled(interactionId: string, ttlMs = 60_000) {
  const now = Date.now();
  // purge simple
  for (const [id, t] of seen) if (now - t > ttlMs) seen.delete(id);
  if (seen.has(interactionId)) return true;
  seen.set(interactionId, now);
  return false;
}
