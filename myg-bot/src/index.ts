// src/index.ts
import "dotenv/config";
import {
  Client,
  Events,
  GatewayIntentBits,
  Partials,
  Interaction,
} from "discord.js";

import { handleAny } from "./bot/interactions/dispatcher.js";
import { prisma } from "./db.js";

// --- Client Discord ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, // requis pour les slash + interactions
  ],
  partials: [Partials.Channel],
});

// --- Ready (nouveau nom: clientReady) ---
client.once(Events.ClientReady, async (c) => {
  console.info(`✅ Connecté en tant que ${c.user.tag}`);

  // Prisma connect
  try {
    await prisma.$connect();
    console.info("✅ Connecté à Neon DB via Prisma");
  } catch (e) {
    console.error("❌ Prisma connection error:", e);
  }
});

// --- Interactions (slash / boutons / selects / modals) ---
client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  try {
    await handleAny(interaction);
  } catch (e) {
    console.error("❌ Erreur interaction:", e);
    // Evite "Unknown interaction" si l'interaction a déjà été acquittée
    try {
      if ("deferred" in interaction && (interaction as any).deferred) {
        await (interaction as any).followUp({
          content: "⚠️ Erreur interne.",
          ephemeral: true,
        });
      } else if ("replied" in interaction && (interaction as any).replied) {
        await (interaction as any).followUp({
          content: "⚠️ Erreur interne.",
          ephemeral: true,
        });
      } else if ("reply" in interaction) {
        await (interaction as any).reply({
          content: "⚠️ Erreur interne.",
          ephemeral: true,
        });
      }
    } catch {
      // Interaction expirée -> on ignore pour éviter un crash
    }
  }
});

// --- Sécurité process ---
process.on("unhandledRejection", (reason) => {
  console.error("UnhandledRejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("UncaughtException:", err);
});

// --- Login ---
const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error("❌ DISCORD_TOKEN manquant dans .env");
  process.exit(1);
}
client.login(token);
