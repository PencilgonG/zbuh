import "dotenv/config";
import { REST, Routes, SlashCommandBuilder } from "discord.js";
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const scopeFlag = process.argv.includes("--scope") ? process.argv.at(-1) : "guild";
// /profil
const profil = new SlashCommandBuilder()
    .setName("profil")
    .setDescription("Gestion du profil joueur")
    .addSubcommand(sub => sub
    .setName("set")
    .setDescription("Définir/mettre à jour ton profil")
    .addStringOption(o => o.setName("pseudo_lol").setDescription("Pseudo LoL").setRequired(true))
    .addStringOption(o => o
    .setName("elo")
    .setDescription("Élo")
    .setRequired(true)
    .addChoices({ name: "Iron", value: "IRON" }, { name: "Bronze", value: "BRONZE" }, { name: "Silver", value: "SILVER" }, { name: "Gold", value: "GOLD" }, { name: "Platinum", value: "PLATINUM" }, { name: "Emerald", value: "EMERALD" }, { name: "Diamond", value: "DIAMOND" }, { name: "Master", value: "MASTER" }, { name: "Grandmaster", value: "GRANDMASTER" }, { name: "Challenger", value: "CHALLENGER" }))
    .addStringOption(o => o
    .setName("main_role")
    .setDescription("Rôle principal")
    .setRequired(true)
    .addChoices({ name: "Top", value: "TOP" }, { name: "Jgl", value: "JGL" }, { name: "Mid", value: "MID" }, { name: "Adc", value: "ADC" }, { name: "Supp", value: "SUPP" }))
    .addStringOption(o => o
    .setName("secondary_role")
    .setDescription("Rôle secondaire")
    .setRequired(true)
    .addChoices({ name: "Top", value: "TOP" }, { name: "Jgl", value: "JGL" }, { name: "Mid", value: "MID" }, { name: "Adc", value: "ADC" }, { name: "Supp", value: "SUPP" }, { name: "Sub (remplaçant)", value: "SUB" }))
    .addStringOption(o => o.setName("opgg_url").setDescription("Lien OP.GG"))
    .addStringOption(o => o.setName("dpm_url").setDescription("Lien DPM")))
    .addSubcommand(sub => sub
    .setName("view")
    .setDescription("Afficher un profil")
    .addUserOption(o => o.setName("user").setDescription("Utilisateur (optionnel)")))
    .toJSON();
// /lobby
const lobby = new SlashCommandBuilder()
    .setName("lobby")
    .setDescription("Créer une salle d'attente")
    .addStringOption(o => o.setName("nom").setDescription("Nom du lobby").setRequired(true))
    .addIntegerOption(o => o
    .setName("equipes")
    .setDescription("Nombre d'équipes")
    .setRequired(true)
    .addChoices({ name: "2 équipes", value: 2 }, { name: "4 équipes", value: 4 }))
    .toJSON();
// /leaderboard
const leaderboard = new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Affiche le classement global des points MYG")
    .toJSON();
const commands = [profil, lobby, leaderboard];
async function main() {
    const rest = new REST({ version: "10" }).setToken(TOKEN);
    if (scopeFlag === "global") {
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log("✅ Commandes globales enregistrées");
    }
    else {
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
        console.log("✅ Commandes guild enregistrées");
    }
}
main().catch(err => {
    console.error(err);
    process.exit(1);
});
