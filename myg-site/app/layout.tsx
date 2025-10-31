import "./globals.css";
import Link from "next/link";

export const metadata = { title: "Myg Inhouse", description: "Site des inhouses MYG" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen text-gray-200 bg-myg-bg">
        <header className="sticky top-0 z-40 bg-black/50 backdrop-blur border-b border-white/10">
          <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
            <Link href="/" className="font-bold tracking-wide text-yellow-400">MYG Inhouses</Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/profiles" className="hover:text-white">Profils</Link>
              <Link href="/matches" className="hover:text-white">Matchs</Link>
              <Link href="/guide" className="hover:text-white">Guide</Link>
              <Link href="/faq" className="hover:text-white">FAQ</Link>
              <Link href="/rules" className="hover:text-white">Rules</Link>
              <Link href="/schedule" className="hover:text-white">Dates</Link>
              <Link href="/shop" className="hover:text-white">Boutique</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
        <footer className="py-10 text-center text-xs text-white/40">© {new Date().getFullYear()} MYG</footer>
      </body>
    </html>
  );
}
