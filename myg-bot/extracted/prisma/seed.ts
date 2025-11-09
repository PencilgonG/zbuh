// prisma/seed.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function upsertFactionByName(
  name: string,
  data: { colorHex: string; emblemUrl: string | null }
) {
  const existing = await prisma.faction.findFirst({ where: { name } });
  if (existing) {
    await prisma.faction.update({ where: { id: existing.id }, data });
    return existing.id;
  } else {
    const created = await prisma.faction.create({ data: { name, ...data } });
    return created.id;
  }
}

async function upsertTitleByName(name: string, data: {
  price: number;
  rarity?: string | null;
  tradeable?: boolean;
  factionLockId?: number | null;
  description?: string | null;
}) {
  const existing = await prisma.title.findFirst({ where: { name } });
  if (existing) {
    await prisma.title.update({ where: { id: existing.id }, data });
    return existing.id;
  } else {
    const created = await prisma.title.create({ data: { name, ...data } });
    return created.id;
  }
}

async function upsertShopItemByName(name: string, data: {
  description?: string | null;
  type: string;           // 👈 littéral string au lieu de ShopType
  price: number;
}) {
  const existing = await prisma.shopItem.findFirst({ where: { name } });
  if (existing) {
    await prisma.shopItem.update({ where: { id: existing.id }, data: { ...data, type: data.type as any } });
    return existing.id;
  } else {
    const created = await prisma.shopItem.create({ data: { name, ...data, type: data.type as any } });
    return created.id;
  }
}

async function main() {
  // === Factions (aura = colorHex) ===
  const factionsSeed = [
    { name: "Noxus",    colorHex: "#C62828", emblemUrl: null },
    { name: "Shurima",  colorHex: "#C4A000", emblemUrl: null },
    { name: "Ionia",    colorHex: "#AA00AA", emblemUrl: null },
    { name: "Freljord", colorHex: "#1E88E5", emblemUrl: null },
    { name: "Targon",   colorHex: "#6A1B9A", emblemUrl: null },
    { name: "Piltover", colorHex: "#F9A825", emblemUrl: null },
    { name: "Zaun",     colorHex: "#00897B", emblemUrl: null },
    { name: "Demacia",  colorHex: "#1976D2", emblemUrl: null },
  ];

  const factionByName: Record<string, number> = {};
  for (const f of factionsSeed) {
    const id = await upsertFactionByName(f.name, { colorHex: f.colorHex, emblemUrl: f.emblemUrl });
    factionByName[f.name] = id;
  }

  // === Titles (prix validés) ===
  const COMMON = 30;
  const RARE = 50;
  const LOCK = 75;

  const titlesSeed: Array<{
    name: string;
    price: number;
    rarity?: string;
    faction?: string;
  }> = [
    // communs
    { name: "FF 15",            price: COMMON, rarity: "COMMON" },
    { name: "Never FF",         price: COMMON, rarity: "COMMON" },
    { name: "Camille Incident", price: COMMON, rarity: "COMMON" },
    { name: "Golem",            price: COMMON, rarity: "COMMON" },
    { name: "Ghost Cleanse",    price: COMMON, rarity: "COMMON" },
    { name: "Smurf",            price: COMMON, rarity: "COMMON" },
    { name: "Ward Enjoyer",     price: COMMON, rarity: "COMMON" },
    { name: "Top Diff",         price: COMMON, rarity: "COMMON" },

    // rares
    { name: "Solo Diff",            price: RARE, rarity: "RARE" },
    { name: "MVP Collector",        price: RARE, rarity: "RARE" },
    { name: "Grand Stratège",       price: RARE, rarity: "RARE" },
    { name: "Rift Psychopathe",     price: RARE, rarity: "RARE" },
    { name: "Architecte du Chaos",  price: RARE, rarity: "RARE" },

    // locks faction
    { name: "Héraut de Noxus",       price: LOCK, rarity: "RARE", faction: "Noxus" },
    { name: "Enfant du Soleil",      price: LOCK, rarity: "RARE", faction: "Shurima" },
    { name: "Moine de l’Équilibre",  price: LOCK, rarity: "RARE", faction: "Ionia" },
    { name: "Chasseur des Glaces",   price: LOCK, rarity: "RARE", faction: "Freljord" },
    { name: "Messager Céleste",      price: LOCK, rarity: "RARE", faction: "Targon" }
  ];

  for (const t of titlesSeed) {
    await upsertTitleByName(t.name, {
      price: t.price,
      rarity: t.rarity ?? null,
      tradeable: false,
      factionLockId: t.faction ? factionByName[t.faction] : null,
      description: null
    });
  }

  // === Shop items (consommables) ===
  await upsertShopItemByName("Ban +1", {
    description: "Un ban supplémentaire utilisable en draft.",
    type: "CONSUMABLE",
    price: 5
  });

  await upsertShopItemByName("Vote Imposteur Double", {
    description: "Compte pour 2 votes imposteur (Among Us).",
    type: "CONSUMABLE",
    price: 5
  });

  await upsertShopItemByName("Transfert de Faction", {
    description: "Permet de racheter un joueur d’une autre faction (il doit accepter).",
    type: "CONSUMABLE",
    price: 150
  });

  console.log("✅ Seed terminé (factions, titres, shop).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
