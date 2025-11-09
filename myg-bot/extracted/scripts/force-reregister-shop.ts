// scripts/force-reregister-shop.ts
import "dotenv/config";
import { REST, Routes, APIApplicationCommand } from "discord.js";

const appId = process.env.DISCORD_CLIENT_ID!;
const guildId = process.env.DISCORD_GUILD_ID!;
const token = process.env.DISCORD_TOKEN!;

async function main() {
  const rest = new REST({ version: "10" }).setToken(token);

  // 1) Lister les commandes de guilde
  const cmds = (await rest.get(
    Routes.applicationGuildCommands(appId, guildId)
  )) as APIApplicationCommand[];

  // 2) Trouver "shop"
  const shop = cmds.find((c) => c.name === "shop");
  if (!shop) {
    console.log("🔎 Pas de /shop enregistré (guilde). Rien à supprimer.");
  } else {
    console.log(`🗑️ Suppression /shop (#${shop.id})…`);
    await rest.delete(Routes.applicationGuildCommand(appId, guildId, shop.id));
    console.log("✅ Supprimé.");
  }

  // 3) Ré-enregistrer via ton script existant
  console.log("🧩 Ré-inscription (merge) des commandes…");
  const { default: run } = await import("./register-commands-merge.ts");
  // Si ton merge script n’exporte pas de default, on l’exécute juste en l’important.
  if (typeof run === "function") await run();
  console.log("✅ Fini.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
