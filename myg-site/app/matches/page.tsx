"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

type Live = { id: string; startedAt: string; matchNumber: number | null };
type Recent = {
  id: string; createdAt: string; matchNumber: number | null;
  teamA: { name: string; playerIds: string[] };
  teamB: { name: string; playerIds: string[] };
  winner: "A" | "B" | null;
};

type Role = "TOP" | "JUNGLE" | "MID" | "ADC" | "SUPPORT";
type Profile = {
  id: string;
  discordId: string;
  discordTag: string;
  role: Role | null;
  summonerName: string;
  region: string;
  opggUrl?: string | null;
  dpmUrl?: string | null;
  avatarUrl?: string | null;
};

export default function MatchesPage() {
  const [live, setLive] = useState<Live[]>([]);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [modal, setModal] = useState<Recent | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const load = async () => {
    const [a, b, p] = await Promise.all([
      fetch("/api/matches/live", { cache: "no-store" }).then(r => r.json()),
      fetch("/api/matches/recent?limit=20", { cache: "no-store" }).then(r => r.json()),
      fetch("/api/profiles", { cache: "no-store" }).then(r => r.json())
    ]);
    setLive(a.items ?? []);
    setRecent(b.items ?? []);
    setProfiles(p.items ?? []);
  };

  useEffect(() => { load(); }, []);

  // index par discordId
  const idx = useMemo(() => {
    const m = new Map<string, Profile>();
    for (const pr of profiles) m.set(pr.discordId, pr);
    return m;
  }, [profiles]);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Matchs</h1>

      <section className="rounded-2xl bg-myg-card border border-white/10 p-4">
        <h2 className="font-semibold mb-3">En direct</h2>
        {live.length === 0 ? (
          <p className="text-white/50 text-sm">Aucun match en cours.</p>
        ) : (
          <ul className="space-y-2">
            {live.map(m => (
              <li key={m.id} className="text-sm text-white/80">
                {new Date(m.startedAt).toLocaleString()} • #{m.matchNumber ?? 1}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl bg-myg-card border border-white/10 p-4">
        <h2 className="font-semibold mb-3">20 derniers matchs</h2>
        <ul className="divide-y divide-white/10">
          {recent.map(m => (
            <li key={m.id} className="py-3 flex items-center justify-between">
              <div className="text-sm">
                <div className="text-white/80">{new Date(m.createdAt).toLocaleString()} • #{m.matchNumber ?? 1}</div>
                <div className="text-white/60">{m.teamA.name} vs {m.teamB.name} — vainqueur: {m.winner ?? "?"}</div>
              </div>
              <button className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/15" onClick={() => setModal(m)}>
                Voir les 10 profils
              </button>
            </li>
          ))}
          {recent.length === 0 && <li className="py-2 text-sm text-white/50">Aucun match.</li>}
        </ul>
      </section>

      {modal && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60 backdrop-blur" onClick={() => setModal(null)} />
          <div className="absolute inset-0 grid place-items-center p-4">
            <div className="relative max-w-3xl w-full rounded-2xl bg-myg-card border border-white/10 p-6 shadow-card">
              <button className="absolute top-3 right-3 text-white/50 hover:text-white" onClick={() => setModal(null)}>✕</button>
              <h3 className="text-xl font-bold mb-4">Compositions</h3>
              <div className="grid grid-cols-2 gap-6">
                <TeamBlock title={modal.teamA.name} ids={modal.teamA.playerIds} idx={idx} />
                <TeamBlock title={modal.teamB.name} ids={modal.teamB.playerIds} idx={idx} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function avatarFromProfile(p?: Profile) {
  if (!p) return "/avatar-fallback.png";
  if (p.avatarUrl) return p.avatarUrl;
  if (p.discordId) return `/api/discord/avatar/${p.discordId}`;
  return "/avatar-fallback.png";
}

function displayFromProfile(p?: Profile) {
  return p?.summonerName || p?.discordTag || "Joueur";
}

function TeamBlock({ title, ids, idx }: { title: string; ids: string[]; idx: Map<string, Profile> }) {
  return (
    <div>
      <div className="text-sm text-white/70 mb-2">{title}</div>
      <div className="flex flex-wrap gap-3">
        {ids.map((id) => {
          const p = idx.get(id);
          return (
            <div key={id} className="flex items-center gap-2">
              <div className="relative w-10 h-10 rounded-full overflow-hidden ring-2 ring-white/10">
                <Image src={avatarFromProfile(p)} alt={displayFromProfile(p)} fill className="object-cover" />
              </div>
              <div className="text-xs text-white/80">{displayFromProfile(p)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
