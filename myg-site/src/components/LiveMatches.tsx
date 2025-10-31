"use client";
import { useEffect, useState } from "react";

type Live = { id: string; startedAt: string; matchNumber: number | null };

export default function LiveMatches() {
  const [items, setItems] = useState<Live[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/matches/live", { cache: "no-store" });
        const json = await res.json();
        setItems(json.items ?? []);
      } catch {
        setItems([]);
      }
    };
    load();
    const i = setInterval(load, 5000);
    return () => clearInterval(i);
  }, []);

  if (items.length === 0) {
    return <p className="text-white/60 text-sm">Aucun match en cours.</p>;
  }

  return (
    <ul className="text-sm space-y-1">
      {items.map(m => (
        <li key={m.id} className="text-white/80">
          #{m.matchNumber ?? 1} • {new Date(m.startedAt).toLocaleTimeString()}
        </li>
      ))}
    </ul>
  );
}
