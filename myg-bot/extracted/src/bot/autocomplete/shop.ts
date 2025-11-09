// src/bot/autocomplete/shop.ts
import type { AutocompleteInteraction } from "discord.js";
import { prisma } from "../../prismat";

export async function shopAutocomplete(inter: AutocompleteInteraction) {
  if (inter.commandName !== "shop") return;

  const focused = inter.options.getFocused(true); // which option the user is typing into
  const query = String(focused.value ?? "").toLowerCase();

  if (focused.name === "title_id") {
    const titles = await prisma.title.findMany({
      orderBy: [{ price: "asc" }, { name: "asc" }],
      take: 25,
    });

    const choices = titles
      .filter((t) => (query ? t.name.toLowerCase().includes(query) : true))
      .map((t) => ({
        name: `${t.name} — ${t.price} pts${t.factionLockId ? " • lock faction" : ""}`,
        value: t.id,
      }));

    return inter.respond(choices);
  }

  if (focused.name === "shop_item_id") {
    const items = await prisma.shopItem.findMany({
      where: { type: "CONSUMABLE" },
      orderBy: [{ price: "asc" }, { name: "asc" }],
      take: 25,
    });

    const choices = items
      .filter((s) => (query ? s.name.toLowerCase().includes(query) : true))
      .map((s) => ({
        name: `${s.name} — ${s.price ?? "?"} pts`,
        value: s.id,
      }));

    return inter.respond(choices);
  }
}
