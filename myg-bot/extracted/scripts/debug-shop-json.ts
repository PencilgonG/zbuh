// scripts/debug-shop-json.ts
import "dotenv/config";
import { REST, Routes, APIApplicationCommand } from "discord.js";

const appId = process.env.DISCORD_CLIENT_ID!;
const guildId = process.env.DISCORD_GUILD_ID!;
const token = process.env.DISCORD_TOKEN!;

async function main() {
  const rest = new REST({ version: "10" }).setToken(token);
  const cmds = (await rest.get(
    Routes.applicationGuildCommands(appId, guildId)
  )) as APIApplicationCommand[];
  const shop = cmds.find((c) => c.name === "shop");
  if (!shop) return console.log("Pas de /shop");
  console.dir(shop, { depth: 6 });
}

main().catch(console.error);
