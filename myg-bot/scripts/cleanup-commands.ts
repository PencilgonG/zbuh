// scripts/cleanup-commands.ts
import "dotenv/config";
import { REST, Routes } from "discord.js";

const TOKEN = process.env.DISCORD_TOKEN!;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID!;
const GUILD_ID = process.env.DISCORD_GUILD_ID!;

const rest = new REST({ version: "10" }).setToken(TOKEN);

async function cleanGlobal() {
  const globals = (await rest.get(Routes.applicationCommands(CLIENT_ID))) as any[];
  console.log(`🌐 Global: ${globals.length} cmd(s)`);
  for (const c of globals) {
    await rest.delete(Routes.applicationCommand(CLIENT_ID, c.id));
    console.log(`  ❌ global: ${c.name}`);
  }
}

async function cleanGuild() {
  const guilds = (await rest.get(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
  )) as any[];
  console.log(`🛡️ Guild: ${guilds.length} cmd(s)`);
  for (const c of guilds) {
    await rest.delete(Routes.applicationGuildCommand(CLIENT_ID, GUILD_ID, c.id));
    console.log(`  ❌ guild: ${c.name}`);
  }
}

(async () => {
  await cleanGlobal();
  await cleanGuild();
  console.log("✅ Cleanup terminé.");
})();
