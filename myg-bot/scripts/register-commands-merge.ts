// scripts/register-commands-merge.ts
import "dotenv/config";
import {
  REST,
  Routes,
  SlashCommandBuilder,
  APIApplicationCommand,
  PermissionFlagsBits,
  type RESTPostAPIApplicationCommandsJSONBody,
} from "discord.js";

// ⚠️ Garde les chemins ci-dessous alignés avec ton repo (tsx supporte les imports TS)
import { data as shopData } from "../src/bot/commands/shop";
import { data as adminDevData } from "../src/bot/commands/admin-dev";
import { data as factionData } from "../src/bot/commands/faction";
import { data as useData } from "../src/bot/commands/use";

const TOKEN = process.env.DISCORD_TOKEN!;
const APP_ID = process.env.DISCORD_CLIENT_ID!;
const GUILD_ID = process.env.DISCORD_GUILD_ID!;

function toJSON(d: any): RESTPostAPIApplicationCommandsJSONBody {
  // certains exports peuvent déjà être des JSON bodies
  if (!d) throw new Error("Builder manquant dans l'un des imports.");
  return d instanceof SlashCommandBuilder ? d.toJSON() : d;
}

async function main() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);

  console.log("🔧 Merge-register des commandes (scope: guild)");
  console.log("   AppId:", APP_ID);
  console.log("   GuildId:", GUILD_ID);

  // 1) Récupère les commandes ACTUELLES de la guilde
  const current = (await rest.get(
    Routes.applicationGuildCommands(APP_ID, GUILD_ID),
  )) as APIApplicationCommand[];

  console.log(`📥 Trouvé ${current.length} commande(s) actuelle(s) :`);
  current.forEach((c) => console.log(` - ${c.name} (#${c.id})`));

  // 2) Map par nom pour merge propre
  //    On repart des commandes live afin de préserver celles non gérées ici.
  const byName = new Map<string, any>();
  for (const cmd of current) byName.set(cmd.name, cmd);

  // 3) Prépare nos builders (avec permissions quand pertinent)
  //    NB: setDefaultMemberPermissions ne casse rien si déjà défini côté fichier.
  try {
    (adminDevData as any)?.setDefaultMemberPermissions?.(PermissionFlagsBits.ManageGuild);
  } catch {}

  const Shop = toJSON(shopData);
  const AdminDev = toJSON(adminDevData);
  const Faction = toJSON(factionData);
  const Use = toJSON(useData);

  // 4) Remplace / Insère
  byName.set(Shop.name, Shop);
  byName.set(AdminDev.name, AdminDev);
  byName.set(Faction.name, Faction);
  byName.set(Use.name, Use);

  // (Facultatif) petits checks de debug
  console.log("🔎 Vérifs rapides :");
  console.log(" - /shop présent ?", byName.has("shop"));
  console.log(" - /admin-dev présent ?", byName.has("admin-dev"));
  console.log(" - /faction présent ?", byName.has("faction"));
  console.log(" - /use présent ?", byName.has("use"));

  // 5) Push merge → guild
  const merged = Array.from(byName.values());
  console.log(`🧩 Envoi du merge: ${merged.length} commande(s)`);
  const result = (await rest.put(
    Routes.applicationGuildCommands(APP_ID, GUILD_ID),
    { body: merged },
  )) as any[];

  console.log(`✅ Upsert OK (${result.length})`);
  for (const c of result) console.log(` - ${c.name} (#${c.id})`);

  // 6) Vérification live
  const live = (await rest.get(
    Routes.applicationGuildCommands(APP_ID, GUILD_ID),
  )) as any[];
  console.log(`🔎 Live maintenant: ${live.length}`);
  for (const c of live) console.log(`   · ${c.name} (#${c.id})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
