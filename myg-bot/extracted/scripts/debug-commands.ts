// scripts/debug-commands.ts
import "dotenv/config";
import { REST, Routes } from "discord.js";

const token = process.env.DISCORD_TOKEN!;
const appId = process.env.DISCORD_CLIENT_ID!;
const guildId = process.env.DISCORD_GUILD_ID!;

async function main() {
  const rest = new REST({ version: "10" }).setToken(token);

  console.log("🔎 AppId:", appId, " GuildId:", guildId);

  const [globalCmds, guildCmds] = await Promise.all([
    rest.get(Routes.applicationCommands(appId)) as any[],
    rest.get(Routes.applicationGuildCommands(appId, guildId)) as any[],
  ]);

  console.log(`🌐 Global commands (${globalCmds.length}):`);
  for (const c of globalCmds) console.log(` - ${c.name} (#${c.id})`);

  console.log(`🏠 Guild commands (${guildCmds.length}):`);
  for (const c of guildCmds) console.log(` - ${c.name} (#${c.id})`);

  console.log("✅ Fini.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
