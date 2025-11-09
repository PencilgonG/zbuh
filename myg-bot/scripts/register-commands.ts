// scripts/register-commands.ts
import "dotenv/config";
import {
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  type RESTPostAPIApplicationCommandsJSONBody,
} from "discord.js";

// === env
const TOKEN = process.env.DISCORD_TOKEN!;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID!;
const GUILD_ID = process.env.DISCORD_GUILD_ID!;

const rest = new REST({ version: "10" }).setToken(TOKEN);

// --------- helpers dynamiques ---------
async function loadCmd(paths: string[]) {
  for (const p of paths) {
    try {
      const mod = await import(p);
      const data =
        (mod?.data?.toJSON ? mod.data.toJSON() : mod?.data) as
          | RESTPostAPIApplicationCommandsJSONBody
          | undefined;
      if (data?.name) {
        return { name: data.name, json: data, from: p };
      }
    } catch {
      // ignore and try next path
    }
  }
  return undefined;
}
function nameOf(c: RESTPostAPIApplicationCommandsJSONBody | undefined) {
  return c?.name ?? "(undefined)";
}

// ================= inline builders =================

// /profil
const profil = new SlashCommandBuilder()
  .setName("profil")
  .setDescription("Gestion du profil joueur")
  .addSubcommand((sub) =>
    sub
      .setName("set")
      .setDescription("Définir/mettre à jour ton profil")
      .addStringOption((o) => o.setName("pseudo_lol").setDescription("Pseudo LoL").setRequired(true))
      .addStringOption((o) =>
        o
          .setName("elo")
          .setDescription("Élo")
          .setRequired(true)
          .addChoices(
            { name: "Iron", value: "IRON" },
            { name: "Bronze", value: "BRONZE" },
            { name: "Silver", value: "SILVER" },
            { name: "Gold", value: "GOLD" },
            { name: "Platinum", value: "PLATINUM" },
            { name: "Emerald", value: "EMERALD" },
            { name: "Diamond", value: "DIAMOND" },
            { name: "Master", value: "MASTER" },
            { name: "Grandmaster", value: "GRANDMASTER" },
            { name: "Challenger", value: "CHALLENGER" },
          ),
      )
      .addStringOption((o) =>
        o
          .setName("main_role")
          .setDescription("Rôle principal")
          .setRequired(true)
          .addChoices(
            { name: "Top", value: "TOP" },
            { name: "Jgl", value: "JGL" },
            { name: "Mid", value: "MID" },
            { name: "Adc", value: "ADC" },
            { name: "Supp", value: "SUPP" },
          ),
      )
      .addStringOption((o) =>
        o
          .setName("secondary_role")
          .setDescription("Rôle secondaire")
          .setRequired(true)
          .addChoices(
            { name: "Top", value: "TOP" },
            { name: "Jgl", value: "JGL" },
            { name: "Mid", value: "MID" },
            { name: "Adc", value: "ADC" },
            { name: "Supp", value: "SUPP" },
            { name: "Sub (remplaçant)", value: "SUB" },
          ),
      )
      .addStringOption((o) => o.setName("opgg_url").setDescription("Lien OP.GG"))
      .addStringOption((o) => o.setName("dpm_url").setDescription("Lien DPM")),
  )
  .addSubcommand((sub) =>
    sub
      .setName("view")
      .setDescription("Afficher un profil")
      .addUserOption((o) => o.setName("user").setDescription("Utilisateur (optionnel)")),
  );

// /lobby
const lobby = new SlashCommandBuilder()
  .setName("lobby")
  .setDescription("Créer une salle d'attente")
  .addStringOption((o) => o.setName("nom").setDescription("Nom du lobby").setRequired(true))
  .addIntegerOption((o) =>
    o
      .setName("equipes")
      .setDescription("Nombre d'équipes")
      .setRequired(true)
      .addChoices({ name: "2 équipes", value: 2 }, { name: "4 équipes", value: 4 }),
  )
  .addStringOption((o) =>
    o
      .setName("mode")
      .setDescription("Mode de lobby")
      .setRequired(true)
      .addChoices(
        { name: "Normal", value: "NORMAL" },
        { name: "Surprise", value: "SURPRISE" },
        { name: "Battle Royale (utiliser /br create)", value: "BATTLE_ROYALE" },
      ),
  );

// /leaderboard
const leaderboard = new SlashCommandBuilder()
  .setName("leaderboard")
  .setDescription("Affiche le classement global des points MYG");

// /br create
const br = new SlashCommandBuilder()
  .setName("br")
  .setDescription("Mode Battle Royale")
  .addSubcommand((sub) =>
    sub
      .setName("create")
      .setDescription("Créer un lobby Battle Royale")
      .addStringOption((o) => o.setName("nom").setDescription("Nom du lobby BR").setRequired(true)),
  );

// /inventory
const inventory = new SlashCommandBuilder()
  .setName("inventory")
  .setDescription("Voir tes titres et objets (consommables)");

// /title
const title = new SlashCommandBuilder()
  .setName("title")
  .setDescription("Gestion des titres")
  .addSubcommand((sub) => sub.setName("use").setDescription("Choisir le titre à afficher"));

// ===== imports statiques (shop, admin, use, admin-factions) =====
import { data as shop } from "../src/bot/commands/shop";
import { data as adminDev } from "../src/bot/commands/admin-dev";
import { data as useCmd } from "../src/bot/commands/use";
import { data as admin } from "../src/bot/commands/admin";
import { data as adminFactions } from "../src/bot/commands/admin-factions";

(adminDev as any).setDefaultMemberPermissions?.(PermissionFlagsBits.ManageGuild);

// On charge /faction avec fallback sur 2 chemins possibles
const factionLoaded = await loadCmd([
  "../src/bot/commands/faction",
  "../src/bot/command/faction",
]);

if (!factionLoaded) {
  console.warn(
    "⚠️  ATTENTION: impossible de charger 'faction' (essayé commands/ et command/). Vérifie le chemin et l'export { data }.",
  );
} else {
  console.log(`✅ Faction chargé depuis: ${factionLoaded.from}`);
}

// ---- Construire la liste brute
const raw: (RESTPostAPIApplicationCommandsJSONBody | undefined)[] = [
  profil.toJSON(),
  lobby.toJSON(),
  leaderboard.toJSON(),
  br.toJSON(),
  inventory.toJSON(),
  title.toJSON(),
  shop?.toJSON?.() ?? shop,
  adminDev?.toJSON?.() ?? adminDev,
  factionLoaded?.json, // dynamique
  useCmd?.toJSON?.() ?? useCmd,
  admin?.toJSON?.() ?? admin,
  adminFactions?.toJSON?.() ?? adminFactions,
];

// Logs
console.log("🔎 Chargement des commandes:");
for (const c of raw) console.log(" -", nameOf(c));

// Dédupe par nom (on garde la dernière)
const byName = new Map<string, RESTPostAPIApplicationCommandsJSONBody>();
for (const c of raw) {
  if (!c) continue;
  byName.set(c.name, c);
}
const commands = Array.from(byName.values());

console.log("📦 Commands à enregistrer:", commands.map((c) => c.name).join(", "));

async function cleanGlobal() {
  console.log("🧹 Suppression des commandes globales…");
  const list = (await rest.get(Routes.applicationCommands(CLIENT_ID))) as any[];
  if (!list.length) {
    console.log("✅ Aucune commande globale à supprimer.");
    return;
  }
  for (const cmd of list) {
    await rest.delete(Routes.applicationCommand(CLIENT_ID, cmd.id));
    console.log(`❌ Supprimé global: ${cmd.name}`);
  }
  console.log("✅ Global clean terminé.");
}

async function main() {
  // Option facultative: --clean-global pour purger les globales
  if (process.argv.includes("--clean-global")) {
    await cleanGlobal();
  }

  // 🔒 On enregistre UNIQUEMENT en guilde (plus de global par défaut)
  await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
  console.log(`✅ Commandes guild enregistrées (${commands.length})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
