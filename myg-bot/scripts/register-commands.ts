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
      .addStringOption((o) =>
        o.setName("pseudo_lol").setDescription("Pseudo LoL").setRequired(true),
      )
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
      .addStringOption((o) =>
        o.setName("opgg_url").setDescription("Lien OP.GG"),
      )
      .addStringOption((o) =>
        o.setName("dpm_url").setDescription("Lien DPM"),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("view")
      .setDescription("Afficher un profil")
      .addUserOption((o) =>
        o.setName("user").setDescription("Utilisateur (optionnel)"),
      ),
  );

// /lobby
const lobby = new SlashCommandBuilder()
  .setName("lobby")
  .setDescription("Créer une salle d'attente")
  .addStringOption((o) =>
    o.setName("nom").setDescription("Nom du lobby").setRequired(true),
  )
  .addIntegerOption((o) =>
    o
      .setName("equipes")
      .setDescription("Nombre d'équipes")
      .setRequired(true)
      .addChoices(
        { name: "2 équipes", value: 2 },
        { name: "4 équipes", value: 4 },
      ),
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
      .addStringOption((o) =>
        o.setName("nom").setDescription("Nom du lobby BR").setRequired(true),
      ),
  );

// /inventory
const inventory = new SlashCommandBuilder()
  .setName("inventory")
  .setDescription("Voir tes titres et objets (consommables)");

// /title
const title = new SlashCommandBuilder()
  .setName("title")
  .setDescription("Gestion des titres")
  .addSubcommand((sub) =>
    sub.setName("use").setDescription("Choisir le titre à afficher"),
  );

// ===== imports statiques (shop, admin, use, admin-factions, debug) =====
import { data as shop } from "../src/bot/commands/shop";
import { data as adminDev } from "../src/bot/commands/admin-dev";
import { data as useCmd } from "../src/bot/commands/use";
import { data as admin } from "../src/bot/commands/admin";
import { data as adminFactions } from "../src/bot/commands/admin-factions";
import { data as debug } from "../src/bot/commands/debugFactionReport";

(adminDev as any).setDefaultMemberPermissions?.(
  PermissionFlagsBits.ManageGuild,
);
// admin-factions définit déjà ses permissions dans son builder ; pas besoin de forcer ici

async function main() {
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
    factionLoaded?.json, // <-- dynamiquement chargé
    useCmd?.toJSON?.() ?? useCmd,
    admin?.toJSON?.() ?? admin,
    adminFactions?.toJSON?.() ?? adminFactions,
    debug?.toJSON?.() ?? debug, // ✅ /debug
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

  console.log(
    "📦 Commands à enregistrer:",
    commands.map((c) => c.name).join(", "),
  );

  const rest = new REST({ version: "10" }).setToken(TOKEN);

  const scopeIndex = process.argv.findIndex((v) => v === "--scope");
  const scopeFlag =
    scopeIndex !== -1 ? (process.argv[scopeIndex + 1] ?? "guild") : "guild";

  if (scopeFlag === "global") {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log(`✅ Commandes globales enregistrées (${commands.length})`);
  } else {
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
      body: commands,
    });
    console.log(`✅ Commandes guild enregistrées (${commands.length})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
