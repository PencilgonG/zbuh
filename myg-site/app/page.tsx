import Image from "next/image";
import Link from "next/link";
import LiveMatches from "@/components/LiveMatches";
import TwitchWidget from "@/components/TwitchWidget";

export default function Home() {
  return (
    <div className="space-y-10">
      {/* Bannière / Hero (le style final viendra à la fin) */}
      <section className="relative h-[45vh] rounded-2xl overflow-hidden shadow-card">
        <Image src="/banner.webp" alt="MYG Banner" fill className="object-cover opacity-70" priority />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/40 to-black/80" />
        <div className="absolute bottom-6 left-6">
          <h1 className="text-4xl font-extrabold text-yellow-400 drop-shadow">MYG Inhouses</h1>
          <p className="text-white/70">Bienvenue — widgets & outils ci-dessous</p>
        </div>
      </section>

      {/* Widgets grid */}
      <section className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Widget title="Matchs en direct" href="/matches">
          <LiveMatches />
        </Widget>

        <Widget title="Twitch" href="/#twitch">
          <TwitchWidget channel="PencilgonG" />
        </Widget>

        <Widget title="Profils" href="/profiles">
          <p className="text-white/60">Parcourir les profils par rôle, bulles cliquables → carte.</p>
        </Widget>

        <Widget title="Guide d’utilisation" href="/guide">
          <p className="text-white/60">Tout pour bien utiliser le bot & le site.</p>
        </Widget>

        <Widget title="FAQ" href="/faq">
          <p className="text-white/60">Réponses rapides aux questions fréquentes.</p>
        </Widget>

        <Widget title="Rules" href="/rules">
          <p className="text-white/60">Règles des inhouses & fair-play.</p>
        </Widget>

        <Widget title="Dates d’inhouses" href="/schedule">
          <p className="text-white/60">Prochaines sessions — (édition protégée role Respo) </p>
        </Widget>

        <Widget title="Boutique" href="/shop">
          <p className="text-white/60">Rôles & idées autour des points (à venir).</p>
        </Widget>
      </section>
    </div>
  );
}

function Widget({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="block rounded-2xl bg-myg-card/80 border border-white/10 hover:border-white/20 p-5 shadow-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">{title}</h3>
        <span className="text-xs text-white/40">ouvrir →</span>
      </div>
      <div className="text-sm">{children}</div>
    </Link>
  );
}
