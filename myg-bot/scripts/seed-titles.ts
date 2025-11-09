// scripts/seed-titles.ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// === Prix de base (modifiable) ===
const PRICE_COMMON = 30;
const PRICE_RARE = 50;
const PRICE_EPIC = 75;

// === Liste cible ===
type WantedTitle = { name: string; rarity: "COMMON" | "RARE" | "EPIC"; price: number };

const WANTED: WantedTitle[] = [
  // ----- communs -----
  { name: "top gap", rarity: "COMMON", price: PRICE_COMMON },
  { name: "Jgl gap", rarity: "COMMON", price: PRICE_COMMON },
  { name: "mid gap", rarity: "COMMON", price: PRICE_COMMON },
  { name: "adc gap", rarity: "COMMON", price: PRICE_COMMON },
  { name: "supp gap", rarity: "COMMON", price: PRICE_COMMON },
  { name: "sbire", rarity: "COMMON", price: PRICE_COMMON },
  { name: "ff 15", rarity: "COMMON", price: PRICE_COMMON },
  { name: "never ff", rarity: "COMMON", price: PRICE_COMMON },
  { name: "golem", rarity: "COMMON", price: PRICE_COMMON },
  { name: "splitpusher", rarity: "COMMON", price: PRICE_COMMON },

  // ----- rares -----
  { name: "camille incident", rarity: "RARE", price: PRICE_RARE },
  { name: "225 at 15", rarity: "RARE", price: PRICE_RARE },
  { name: "Meta slave", rarity: "RARE", price: PRICE_RARE },
  { name: "Off meta chad", rarity: "RARE", price: PRICE_RARE },
  { name: "ghost cleanse", rarity: "RARE", price: PRICE_RARE },
  { name: "Perma roam", rarity: "RARE", price: PRICE_RARE },
  { name: "Report supp", rarity: "RARE", price: PRICE_RARE },
  { name: "Report jgl", rarity: "RARE", price: PRICE_RARE },
  { name: "Ez", rarity: "RARE", price: PRICE_RARE },

  // ----- épiques -----
  { name: "2r2t villain", rarity: "EPIC", price: PRICE_EPIC },
  { name: "Looser Q", rarity: "EPIC", price: PRICE_EPIC },
  { name: "Voleur d'lp", rarity: "EPIC", price: PRICE_EPIC },
  { name: "Perma invade", rarity: "EPIC", price: PRICE_EPIC },
  { name: "0/10 powerpspike", rarity: "EPIC", price: PRICE_EPIC },
  { name: "500$ ahri gooner", rarity: "EPIC", price: PRICE_EPIC },
];

async function main() {
  console.log("Seeding titles…");

  // 1) Upsert chaque titre (match par nom insensible à la casse)
  for (const t of WANTED) {
    // On cherche s'il existe déjà (case-insensitive)
    const existing = await prisma.title.findFirst({
      where: { name: { equals: t.name, mode: "insensitive" } },
    });

    if (existing) {
      await prisma.title.update({
        where: { id: existing.id },
        data: {
          name: t.name,         // normalise la casse telle que définie dans WANTED
          rarity: t.rarity,     // "COMMON" | "RARE" | "EPIC"
          price: t.price,
          // NOTE: on NE touche pas à factionLockId ici pour ne pas casser tes locks éventuels
        },
      });
      console.log(`  ↻ update: ${t.name}`);
    } else {
      await prisma.title.create({
        data: {
          name: t.name,
          rarity: t.rarity,
          price: t.price,
        },
      });
      console.log(`  ✓ create: ${t.name}`);
    }
  }

  // 2) Supprimer les titres qui ne sont plus dans la liste
  const wantedNamesLower = new Set(WANTED.map((w) => w.name.toLowerCase()));
  const all = await prisma.title.findMany({ select: { id: true, name: true } });

  const toDelete = all.filter((x) => !wantedNamesLower.has(x.name.toLowerCase()));
  if (toDelete.length) {
    await prisma.userTitle.deleteMany({
      where: { titleId: { in: toDelete.map((x) => x.id) } },
    }); // nettoie les liaisons possédées avant de retirer les titres
    await prisma.title.deleteMany({ where: { id: { in: toDelete.map((x) => x.id) } } });
    console.log(`  ✗ removed: ${toDelete.map((x) => x.name).join(", ")}`);
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
