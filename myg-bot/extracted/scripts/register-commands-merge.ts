// scripts/register-commands-merge.ts
import "dotenv/config";
import {
  REST,
  Routes,
  SlashCommandBuilder,
  APIApplicationCommand,
} from "discord.js";

// ⚠️ Assure-toi que ces chemins correspondent bien à ton repo
import { data as shopData } from "../src/bot/commands/shop.js";
import { data as adminDevData } from "../src/bot/commands/admin-dev.js";

const token = process.env.DISCORD_TOKEN!;
const appId = process.env.DISCORD_CLIENT_ID!;
const guildId = process.env.DISCORD_GUILD_ID!;

function toJSON(d: any) {
  return d instanceof SlashCommandBuilder ? d.toJSON() : d;
}

async function main() {
  const rest = new REST({ version: "10" }).setToken(token);

  console.log("🔧 Merge-register guild commands");
  console.log("   AppId:", appId);
  console.log("   GuildId:", guildId);

  // 1) Récupère les commandes ACTUELLES
  const current = (await rest.get(
    Routes.applicationGuildCommands(appId, guildId),
  )) as APIApplicationCommand[];

  console.log(`📥 Trouvé ${current.length} commande(s) actuelle(s) dans la guilde:`);
  current.forEach((c) => console.log(` - ${c.name} (#${c.id})`));

  // 2) Map par nom pour merge propre
  const byName = new Map<string, any>();
  for (const cmd of current) byName.set(cmd.name, cmd);

  // 3) Remplace/insère nos commandes en utilisant les *vrais* builders
  const Shop = toJSON(shopData);
  const AdminDev = toJSON(adminDevData);
  byName.set(Shop.name, Shop);
  byName.set(AdminDev.name, AdminDev);

  // 4) (Debug) vérifie que title_id & shop_item_id ne sont pas requis
  const buy = Shop.options?.find((o: any) => o.name === "buy");
  const subTitle = buy?.options?.find((o: any) => o.name === "title");
  const subCons = buy?.options?.find((o: any) => o.name === "consumable");
  console.log("🔎 /shop -> title_id required?:", subTitle?.options?.[0]?.required);
  console.log("🔎 /shop -> shop_item_id required?:", subCons?.options?.[0]?.required);

  // 5) Push
  const merged = Array.from(byName.values());
  console.log(`🧩 Envoi du merge: ${merged.length} commande(s)`);
  const result = (await rest.put(
    Routes.applicationGuildCommands(appId, guildId),
    { body: merged },
  )) as any[];

  console.log(`✅ Upsert ok (${result.length})`);
  for (const c of result) console.log(` - ${c.name} (#${c.id})`);

  // 6) Vérification live
  const live = (await rest.get(
    Routes.applicationGuildCommands(appId, guildId),
  )) as any[];
  console.log(`🔎 Live maintenant: ${live.length}`);
  for (const c of live) console.log(`   · ${c.name} (#${c.id})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
