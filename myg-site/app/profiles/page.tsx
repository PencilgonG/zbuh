"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import clsx from "clsx";

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

export default function ProfilesPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfiles = async () => {
    setLoading(true);
    const res = await fetch("/api/profiles", { cache: "no-store" });
    const json = await res.json();
    setProfiles(json.items ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchProfiles(); }, []);

  const byRole = useMemo(() => {
    const map: Record<Role, Profile[]> = { TOP: [], JUNGLE: [], MID: [], ADC: [], SUPPORT: [] };
    profiles.forEach(p => { if (p.role) map[p.role].push(p); });
    return map;
  }, [profiles]);

  const avatarFor = (p: Profile) => {
    if (p.avatarUrl) return p.avatarUrl;
    if (p.discordId) return `/api/discord/avatar/${p.discordId}`;
    return "/avatar-fallback.png";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Profils</h1>
        <button
          onClick={fetchProfiles}
          className="rounded-lg bg-yellow-500/90 hover:bg-yellow-500 px-3 py-1.5 text-sm text-black font-semibold"
        >
          Rafraîchir
        </button>
      </div>

      {loading && <p className="text-white/60">Chargement…</p>}

      {!loading && (["TOP","JUNGLE","MID","ADC","SUPPORT"] as Role[]).map((role) => (
        <div key={role} className="mb-10">
          <div className="text-xs tracking-[0.3em] text-white/40 mb-2">{role}</div>
          <div className="flex flex-wrap gap-4">
            {byRole[role].map(p => (
              <button
                key={p.id}
                className="relative w-20 h-20 rounded-full overflow-hidden ring-2 ring-white/10 hover:ring-white/30"
                onClick={() => setSelected(p)}
              >
                <Image src={avatarFor(p)} alt={p.discordTag || p.summonerName} fill className="object-cover" />
              </button>
            ))}
            {byRole[role].length === 0 && <div className="text-white/30 text-sm">Aucun profil.</div>}
          </div>
        </div>
      ))}

      {/* Modal */}
      {selected && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60 backdrop-blur" onClick={() => setSelected(null)} />
          <div className="absolute inset-0 grid place-items-center p-4">
            <div className="relative max-w-3xl w-full rounded-2xl bg-myg-card border border-white/10 p-6 shadow-card">
              <button className="absolute top-3 right-3 text-white/50 hover:text-white" onClick={() => setSelected(null)}>✕</button>
              <div className="flex gap-6">
                <div className="relative w-28 h-28 rounded-xl overflow-hidden ring-2 ring-white/10">
                  <Image src={avatarFor(selected)} alt={selected.discordTag || selected.summonerName} fill className="object-cover" />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold">
                    {selected.summonerName || "Profil"} {selected.region ? `• ${selected.region}` : ""}
                  </h2>
                  <div className="mt-2 inline-flex items-center gap-2 text-xs">
                    {selected.role && (
                      <span className={clsx("px-2 py-0.5 rounded-full border", "border-white/15 text-white/70")}>
                        {selected.role}
                      </span>
                    )}
                    {selected.discordTag && <span className="text-white/40">@{selected.discordTag}</span>}
                  </div>

                  <div className="mt-5 flex gap-3">
                    {selected.opggUrl && (
                      <a className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15" href={selected.opggUrl} target="_blank" rel="noreferrer">
                        Ouvrir OP.GG
                      </a>
                    )}
                    {selected.dpmUrl && (
                      <a className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15" href={selected.dpmUrl} target="_blank" rel="noreferrer">
                        Ouvrir DPM
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
