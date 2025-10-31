import { NextResponse } from "next/server";

const token = process.env.DISCORD_TOKEN;

// cache mémoire simple (process-wide)
const cache = new Map<string, { url: string; ts: number }>();
const TTL = 1000 * 60 * 30; // 30 minutes

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const id = params.id;
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const now = Date.now();
  const hit = cache.get(id);
  if (hit && now - hit.ts < TTL) {
    return NextResponse.redirect(hit.url, 302);
  }

  if (!token) {
    // pas de token -> fallback avatar par défaut Discord
    const fallback = `https://cdn.discordapp.com/embed/avatars/0.png`;
    return NextResponse.redirect(fallback, 302);
  }

  // Doc: GET /users/{user.id}
  const res = await fetch(`https://discord.com/api/v10/users/${id}`, {
    headers: { Authorization: `Bot ${token}` }
  });

  if (!res.ok) {
    // rate limit ou user inconnu → fallback
    const fallback = `https://cdn.discordapp.com/embed/avatars/0.png`;
    return NextResponse.redirect(fallback, 302);
  }

  const user = await res.json();
  let url: string;

  if (user.avatar) {
    const ext = user.avatar.startsWith("a_") ? "gif" : "png";
    url = `https://cdn.discordapp.com/avatars/${id}/${user.avatar}.${ext}?size=256`;
  } else {
    const discrim = (parseInt(user.discriminator || "0", 10) || 0) % 5;
    url = `https://cdn.discordapp.com/embed/avatars/${discrim}.png`;
  }

  cache.set(id, { url, ts: now });
  return NextResponse.redirect(url, 302);
}
