import { REST, Routes } from "discord.js";
import { config } from "dotenv";
import { data as profileData } from "../bot/commands/profile/index.js";
import { data as lobbyData } from "../bot/commands/lobby/index.js";
config();
const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN!);
const commands = [profileData.toJSON(), lobbyData.toJSON()];
async function main() {
  try {
    const scopeIndex = process.argv.indexOf("--scope");
    const scope = scopeIndex !== -1 ? process.argv[scopeIndex + 1] : "guild";
    console.log(`🚀 Déploiement des commandes (${scope})...`);
    if (scope === "global") {
      await rest.put(
        Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!),
        { body: commands }
      );
      console.log("✅ Commandes globales enregistrées !");
    } else {
      await rest.put(
        Routes.applicationGuildCommands(
          process.env.DISCORD_CLIENT_ID!,
          process.env.DISCORD_GUILD_ID!
        ),
        { body: commands }
      );
      console.log("✅ Commandes de guilde enregistrées !");
    }
  } catch (err) {
    console.error("❌ Erreur lors du déploiement :", err);
  }
}
main();
