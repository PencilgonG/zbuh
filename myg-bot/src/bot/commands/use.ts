// src/bot/commands/use.ts
import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type StringSelectMenuInteraction,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
} from "discord.js";
import { prisma } from "../../prismat";
import { log } from "../../log";
import { ConsumableType, QuotaType } from "@prisma/client";
import { checkAndIncrementQuota } from "../../lib/shop";

// ========================
// Slash builder
// ========================
export const data = new SlashCommandBuilder()
  .setName("use")
  .setDescription("Utiliser un objet de ton inventaire (consommable)")
  .addSubcommand((sc) =>
    sc.setName("object").setDescription("Sélectionner un consommable à utiliser via un menu"),
  );

// ========================
// Helpers
// ========================

/** Types réellement utilisables via /use object. */
const USABLE_TYPES: ConsumableType[] = [
  "BAN_PLUS_ONE",
  "DOUBLE_IMPOSTOR_VOTE",
  "DOUBLE_POINTS_TOKEN",
  "FACTION_TRANSFER",
  "FACTION_CHEST_I",
  "TITLE_TOKEN_COMMON",
  "TITLE_TOKEN_RARE",
  "TITLE_TOKEN_EPIC",
];

/** Libellés jolis pour l’UI. */
const LABELS: Record<ConsumableType, string> = {
  BAN_PLUS_ONE: "Ban +1",
  DOUBLE_IMPOSTOR_VOTE: "Vote imposteur x2",
  DOUBLE_POINTS_TOKEN: "Jeton points doubles",
  FACTION_TRANSFER: "Transfert de faction",
  FACTION_CHEST_I: "Coffre de faction I",
  TITLE_TOKEN_COMMON: "Jeton de titre (commun)",
  TITLE_TOKEN_RARE: "Jeton de titre (rare)",
  TITLE_TOKEN_EPIC: "Jeton de titre (épique)",
};

/** Msg "propre" (pas de champs internes Discord). */
type SimpleMsg = { content?: string; embeds?: EmbedBuilder[]; components?: any[] };

/** Réponse sûre pour slash ET select. */
async function respond(
  inter: ChatInputCommandInteraction | StringSelectMenuInteraction,
  payload: string | SimpleMsg,
) {
  const opts: SimpleMsg = typeof payload === "string" ? { content: payload } : payload;

  if ("isStringSelectMenu" in inter && inter.isStringSelectMenu()) {
    try {
      return await inter.update({ ...(opts as any), components: opts.components ?? [] });
    } catch {
      if (inter.deferred || inter.replied) return inter.followUp({ ...(opts as any), ephemeral: true });
      return inter.reply({ ...(opts as any), ephemeral: true });
    }
  }

  if (inter.deferred || inter.replied) return inter.followUp({ ...(opts as any), ephemeral: true });
  return inter.reply({ ...(opts as any), ephemeral: true });
}

/** Raretés disponibles (on évite d'importer un enum Prisma qui n'existe pas partout). */
type TitleRarityStr = "COMMON" | "RARE" | "EPIC";

async function giveRandomTitleOfRarity(
  inter: ChatInputCommandInteraction | StringSelectMenuInteraction,
  userId: string,
  rarity: TitleRarityStr,
) {
  // tous les titres de la rareté
  const [titles, owned] = await Promise.all([
    prisma.title.findMany({ where: { rarity }, orderBy: { name: "asc" } as any }),
    prisma.userTitle.findMany({ where: { userId }, select: { titleId: true } }),
  ]);
  const ownedSet = new Set(owned.map((o) => o.titleId));
  const available = titles.filter((t) => !ownedSet.has(t.id));

  if (!available.length) {
    return respond(inter, { content: `ℹ️ Tu possèdes déjà **tous** les titres ${rarity.toLowerCase()}s.` });
  }

  const pick = available[Math.floor(Math.random() * available.length)];
  await prisma.$transaction(async (tx) => {
    await tx.userTitle.create({ data: { userId, titleId: pick.id } });
    // consommer le bon jeton selon la rareté
    const tokenType: ConsumableType =
      rarity === "EPIC" ? "TITLE_TOKEN_EPIC" : rarity === "RARE" ? "TITLE_TOKEN_RARE" : "TITLE_TOKEN_COMMON";
    const stock = await tx.consumableStock.findUnique({
      where: { userId_type: { userId, type: tokenType } },
    });
    if (!stock || stock.quantity <= 0) throw new Error("Plus de jeton correspondant.");
    await tx.consumableStock.update({
      where: { userId_type: { userId, type: tokenType } },
      data: { quantity: { decrement: 1 } },
    });
  });

  return respond(inter, { content: `✅ Tu as obtenu le **titre** : *${pick.name}*.` });
}

/** Envoie un sélecteur avec les items utilisables présents dans l’inventaire. */
async function showUseSelector(inter: ChatInputCommandInteraction) {
  const userId = inter.user.id;

  const stocks = await prisma.consumableStock.findMany({
    where: { userId, quantity: { gt: 0 }, type: { in: USABLE_TYPES } },
    orderBy: { type: "asc" },
  });

  if (stocks.length === 0) {
    return inter.reply({
      content: "Tu n’as **aucun objet utilisable** dans ton inventaire.",
      ephemeral: true,
    });
  }

  const options = stocks.slice(0, 25).map((s) => ({
    label: `${LABELS[s.type]} — x${s.quantity}`,
    value: s.type,
  }));

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("USE:SELECT")
      .setPlaceholder("Choisir un objet à utiliser…")
      .addOptions(options),
  );

  await inter.reply({
    content: "Sélectionne l’objet à utiliser :",
    components: [row],
    ephemeral: true,
  });
}

/** Applique l’utilisation d’un consommable (depuis slash OU select). */
async function applyUse(
  inter: ChatInputCommandInteraction | StringSelectMenuInteraction,
  userId: string,
  type: ConsumableType,
) {
  const stock = await prisma.consumableStock.findUnique({
    where: { userId_type: { userId, type } },
  });
  if (!stock || stock.quantity <= 0) {
    return respond(inter, { content: "❌ Tu ne possèdes pas cet objet." });
  }

  switch (type) {
    case "BAN_PLUS_ONE": {
      // ✅ Limite d'UTILISATION : 3/sem
      const quota = await checkAndIncrementQuota(userId, QuotaType.BAN_PLUS_ONE_WEEKLY, 3);
      if (!quota.ok) {
        return respond(
          inter,
          { content: "⛔ Tu as atteint la **limite hebdomadaire (3)** d’utilisation de **Ban +1**." },
        );
      }

      await prisma.$transaction(async (tx) => {
        await tx.consumableStock.update({
          where: { userId_type: { userId, type } },
          data: { quantity: { decrement: 1 } },
        });
        await tx.pendingEffect.create({ data: { userId, type: "BAN_PLUS_ONE" } });
      });
      return respond(
        inter,
        { content: "✅ **Ban +1** armé ! Il sera appliqué dans ton prochain lobby **Normal** ou **Surprise**." },
      );
    }

    case "DOUBLE_IMPOSTOR_VOTE": {
      await prisma.$transaction(async (tx) => {
        await tx.consumableStock.update({
          where: { userId_type: { userId, type } },
          data: { quantity: { decrement: 1 } },
        });
        await tx.pendingEffect.create({ data: { userId, type: "DOUBLE_IMPOSTOR_VOTE" } });
      });
      return respond(
        inter,
        { content: "✅ **Vote imposteur x2** armé ! Il sera utilisé automatiquement lors du prochain panel imposteur." },
      );
    }

    case "DOUBLE_POINTS_TOKEN": {
      await prisma.$transaction(async (tx) => {
        await tx.consumableStock.update({
          where: { userId_type: { userId, type } },
          data: { quantity: { decrement: 1 } },
        });
        await tx.pendingEffect.create({ data: { userId, type: "DOUBLE_POINTS_TOKEN" } });
      });
      return respond(inter, { content: "✅ **Jeton points doubles** armé pour ta prochaine inhouse !" });
    }

    case "FACTION_TRANSFER": {
      // ✅ Limite d'UTILISATION : 1/mois
      const quota = await checkAndIncrementQuota(userId, QuotaType.FACTION_TRANSFER_MONTHLY, 1);
      if (!quota.ok) {
        return respond(
          inter,
          { content: "⛔ Tu as atteint la **limite mensuelle (1)** d’utilisation de **Transfert de faction**." },
        );
      }
      return respond(
        inter,
        { content: "⚠️ **Transfert de faction** : la procédure est en préparation. Garde l’objet pour l’instant." },
      );
    }

    case "FACTION_CHEST_I": {
      const pool: ConsumableType[] = ["DOUBLE_POINTS_TOKEN", "BAN_PLUS_ONE", "TITLE_TOKEN_COMMON"];
      const reward = pool[Math.floor(Math.random() * pool.length)];

      await prisma.$transaction(async (tx) => {
        await tx.consumableStock.update({
          where: { userId_type: { userId, type: "FACTION_CHEST_I" } },
          data: { quantity: { decrement: 1 } },
        });
        await tx.consumableStock.upsert({
          where: { userId_type: { userId, type: reward } },
          update: { quantity: { increment: 1 } },
          create: { userId, type: reward, quantity: 1 },
        });
      });

      const embed = new EmbedBuilder()
        .setTitle("🎁 Coffre de faction I")
        .setDescription(`Tu as reçu : **${LABELS[reward]}** !`)
        .setColor(0x00b894);

      return respond(inter, { embeds: [embed] });
    }

    // === Jetons de titre : RNG pour les 3 raretés ===
    case "TITLE_TOKEN_COMMON":
      return giveRandomTitleOfRarity(inter, userId, "COMMON");

    case "TITLE_TOKEN_RARE":
      return giveRandomTitleOfRarity(inter, userId, "RARE");

    case "TITLE_TOKEN_EPIC":
      return giveRandomTitleOfRarity(inter, userId, "EPIC");

    default:
      return respond(inter, { content: "ℹ️ Cet objet n’est pas utilisable directement ici." });
  }
}

// ========================
// Handlers exportés
// ========================
export async function execute(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand();
  if (sub !== "object") return interaction.reply({ content: "Sous-commande inconnue.", ephemeral: true });
  return showUseSelector(interaction);
}

export async function handleUseSelect(interaction: StringSelectMenuInteraction) {
  const userId = interaction.user.id;
  const raw = interaction.values?.[0];
  if (!raw) return interaction.update({ content: "Aucun objet sélectionné.", components: [] });

  const type = raw as ConsumableType;
  if (!USABLE_TYPES.includes(type)) {
    return interaction.update({ content: "Cet objet n’est pas utilisable via ce menu.", components: [] });
  }

  try {
    await applyUse(interaction, userId, type);
    log.info({ userId, type }, "use:select");
  } catch (e) {
    log.error({ err: e, userId, type }, "use:select error");
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: "❌ Erreur lors de l’utilisation.", ephemeral: true });
    } else {
      await interaction.update({ content: "❌ Erreur lors de l’utilisation.", components: [] });
    }
  }
}

/** (Compat rétro) — plus utilisé avec le RNG, on informe juste l’utilisateur. */
export async function handleUseTokenTitleSelect(inter: StringSelectMenuInteraction) {
  return inter.update({
    content: "ℹ️ Ce sélecteur n’est plus utilisé : les jetons de titre donnent désormais un **titre aléatoire**.",
    components: [],
  });
}
