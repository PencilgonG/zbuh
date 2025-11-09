// src/bot/commands/shop.ts
import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type StringSelectMenuInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
} from "discord.js";
import { prisma } from "../../prismat";
import { chargePoints, checkAndIncrementQuota, addConsumable } from "../../lib/shop";
import {
  ConsumableType,
  QuotaType,
  ShopType,
  type Title as TitleModel,
  type ShopItem as ShopItemModel,
} from "@prisma/client";

export const data = new SlashCommandBuilder()
  .setName("shop")
  .setDescription("Boutique MYG : titres & consommables")
  .addSubcommand((sc) => sc.setName("list").setDescription("Voir les titres & consommables disponibles"))
  .addSubcommandGroup((sg) =>
    sg
      .setName("buy")
      .setDescription("Acheter un titre ou un consommable")
      .addSubcommand((sc) =>
        sc
          .setName("title")
          .setDescription("Acheter un titre (laisser vide pour un sélecteur)")
          .addIntegerOption((opt) =>
            opt
              .setName("title_id")
              .setDescription("ID du titre (ou laisse vide pour un sélecteur)")
              .setRequired(false)
              .setAutocomplete(true),
          ),
      )
      .addSubcommand((sc) =>
        sc
          .setName("consumable")
          .setDescription("Acheter un consommable (laisser vide pour un sélecteur)")
          .addIntegerOption((opt) =>
            opt
              .setName("shop_item_id")
              .setDescription("ID du ShopItem (ou laisse vide pour un sélecteur)")
              .setRequired(false)
              .setAutocomplete(true),
          ),
      ),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages);

const CONSUMABLE_RULES: Record<
  ConsumableType,
  { quota: QuotaType; cap: number; price: number; displayName: string }
> = {
  BAN_PLUS_ONE: { quota: "BAN_PLUS_ONE_WEEKLY", cap: 3, price: 5, displayName: "Ban +1" },
  DOUBLE_IMPOSTOR_VOTE: { quota: "DOUBLE_IMPOSTOR_VOTE_WEEKLY", cap: 3, price: 5, displayName: "Vote Imposteur Double" },
  FACTION_TRANSFER: { quota: "FACTION_TRANSFER_MONTHLY", cap: 1, price: 150, displayName: "Transfert de Faction" },
};

function mapConsumableTypeByName(name: string): ConsumableType | null {
  const n = name.toLowerCase();
  if (n.includes("ban") && n.includes("+1")) return "BAN_PLUS_ONE";
  if (n.includes("imposteur") || n.includes("double")) return "DOUBLE_IMPOSTOR_VOTE";
  if (n.includes("transfert")) return "FACTION_TRANSFER";
  return null;
}

export async function execute(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand(false) ?? null;
  const group = interaction.options.getSubcommandGroup(false) ?? null;
  const buyerId = interaction.user.id;

  // /shop list -> embed + 2 sélecteurs
  if (sub === "list" && !group) {
    const rows = await buildListSelectorsRows();
    const embed = new EmbedBuilder()
      .setTitle("🛒 Boutique MYG")
      .setDescription(
        "Choisis un **titre** ou un **consommable** dans les menus ci-dessous.\n" +
          "Tu peux aussi utiliser : `/shop buy title <id>` ou `/shop buy consumable <id>`.\n" +
          "Les achats confirment le succès et débitent tes points.",
      )
      .setFooter({
        text: "Prix : Titres communs 30, rares 50, locks 75 — Ban+1 5, Vote x2 5, Transfert 150",
      });
    return interaction.reply({ embeds: [embed], components: rows, ephemeral: true });
  }

  // /shop buy title [id] (si vide => sélecteur)
  if (group === "buy" && sub === "title") {
    const titleId = interaction.options.getInteger("title_id", false);
    if (titleId == null) {
      const rows = await buildTitleSelectorRow("SHOP:BUY:TITLE");
      if (!rows.length) return interaction.reply({ content: "Aucun titre disponible.", ephemeral: true });
      const embed = new EmbedBuilder().setTitle("🏷️ Choisir un titre").setDescription("Sélectionne un **titre** à acheter.");
      return interaction.reply({ embeds: [embed], components: rows, ephemeral: true });
    }
    return buyTitle(interaction, buyerId, titleId);
  }

  // /shop buy consumable [id] (si vide => sélecteur)
  if (group === "buy" && sub === "consumable") {
    const itemId = interaction.options.getInteger("shop_item_id", false);
    if (itemId == null) {
      const rows = await buildConsumableSelectorRow("SHOP:BUY:CONS");
      if (!rows.length) return interaction.reply({ content: "Aucun consommable disponible.", ephemeral: true });
      const embed = new EmbedBuilder().setTitle("🧪 Choisir un consommable").setDescription("Sélectionne un **consommable** à acheter.");
      return interaction.reply({ embeds: [embed], components: rows, ephemeral: true });
    }
    return buyConsumable(interaction, buyerId, itemId);
  }

  return interaction.reply({ content: "Commande inconnue. Utilise `/shop list`.", ephemeral: true });
}

export async function handleShopSelect(inter: StringSelectMenuInteraction) {
  const buyerId = inter.user.id;
  if (inter.customId === "SHOP:TITLE" || inter.customId === "SHOP:BUY:TITLE") {
    const titleId = Number(inter.values[0]);
    return buyTitle(inter, buyerId, titleId);
  }
  if (inter.customId === "SHOP:CONS" || inter.customId === "SHOP:BUY:CONS") {
    const itemId = Number(inter.values[0]);
    return buyConsumable(inter, buyerId, itemId);
  }
}

// ===== UI builders
async function buildListSelectorsRows() {
  const [titles, consumables] = await Promise.all([
    prisma.title.findMany({ orderBy: [{ price: "asc" }, { name: "asc" }] }),
    prisma.shopItem.findMany({ where: { type: "CONSUMABLE" }, orderBy: [{ price: "asc" }, { name: "asc" }] }),
  ]);

  const titleOptions = (titles as TitleModel[]).slice(0, 25).map((t) => {
    const rare = t.rarity ? ` • ${t.rarity}` : "";
    const lock = t.factionLockId ? " • lock faction" : "";
    return { label: `${t.name} — ${t.price} pts${rare}${lock}`, value: String(t.id) };
  });

  const consOptions = (consumables as ShopItemModel[]).slice(0, 25).map((s) => ({
    label: `${s.name} — ${s.price ?? "?"} pts`,
    value: String(s.id),
  }));

  const rows: any[] = [];
  if (titleOptions.length) {
    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder().setCustomId("SHOP:TITLE").setPlaceholder("Acheter un titre…").addOptions(titleOptions),
      ),
    );
  }
  if (consOptions.length) {
    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder().setCustomId("SHOP:CONS").setPlaceholder("Acheter un consommable…").addOptions(consOptions),
      ),
    );
  }
  return rows;
}

async function buildTitleSelectorRow(customId: string) {
  const titles = (await prisma.title.findMany({ orderBy: [{ price: "asc" }, { name: "asc" }] })) as TitleModel[];
  const opts = titles.slice(0, 25).map((t) => {
    const rare = t.rarity ? ` • ${t.rarity}` : "";
    const lock = t.factionLockId ? " • lock faction" : "";
    return { label: `${t.name} — ${t.price} pts${rare}${lock}`, value: String(t.id) };
  });
  return opts.length
    ? [
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder().setCustomId(customId).setPlaceholder("Choisir un titre…").addOptions(opts),
        ),
      ]
    : [];
}

async function buildConsumableSelectorRow(customId: string) {
  const items = (await prisma.shopItem.findMany({
    where: { type: ShopType.CONSUMABLE },
    orderBy: [{ price: "asc" }, { name: "asc" }],
  })) as ShopItemModel[];
  const opts = items.slice(0, 25).map((s) => ({ label: `${s.name} — ${s.price ?? "?"} pts`, value: String(s.id) }));
  return opts.length
    ? [
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder().setCustomId(customId).setPlaceholder("Choisir un consommable…").addOptions(opts),
        ),
      ]
    : [];
}

// ===== achats
async function buyTitle(
  inter: ChatInputCommandInteraction | StringSelectMenuInteraction,
  buyerId: string,
  titleId: number,
) {
  const title = await prisma.title.findUnique({ where: { id: titleId } });
  if (!title) return inter.reply({ content: "❌ Titre introuvable.", ephemeral: true });

  if (title.factionLockId) {
    const me = await prisma.userProfile.findUnique({ where: { discordId: buyerId }, select: { factionId: true } });
    if (!me?.factionId || me.factionId !== title.factionLockId) {
      return inter.reply({
        content: "⛔ Titre **verrouillé par faction**. Rejoins d'abord la faction correspondante.",
        ephemeral: true,
      });
    }
  }

  const already = await prisma.userTitle.findFirst({ where: { userId: buyerId, titleId } });
  if (already) return inter.reply({ content: "ℹ️ Tu possèdes déjà ce titre.", ephemeral: true });

  await chargePoints(buyerId, title.price, `BUY_TITLE:${title.name}`);
  await prisma.userTitle.create({ data: { userId: buyerId, titleId } });

  return inter.reply({
    embeds: [new EmbedBuilder().setTitle("✅ Achat confirmé").setDescription(`Tu as acheté le **titre** : *${title.name}* pour **${title.price} pts**.`)],
    ephemeral: true,
  });
}

async function buyConsumable(
  inter: ChatInputCommandInteraction | StringSelectMenuInteraction,
  buyerId: string,
  itemId: number,
) {
  const item = await prisma.shopItem.findUnique({ where: { id: itemId } });
  if (!item || item.type !== ShopType.CONSUMABLE) {
    return inter.reply({ content: "❌ Cet ID n’est pas un **consommable**.", ephemeral: true });
  }

  const cType = mapConsumableTypeByName(item.name);
  if (!cType) {
    return inter.reply({
      content: "❌ Consommable non reconnu (renomme l’item avec `Ban +1`, `Imposteur` ou `Transfert`).",
      ephemeral: true,
    });
  }

  const rule = CONSUMABLE_RULES[cType];
  const quota = await checkAndIncrementQuota(buyerId, rule.quota, rule.cap);
  if (!quota.ok) {
    const scope = rule.quota === "FACTION_TRANSFER_MONTHLY" ? "mois" : "semaine";
    return inter.reply({ content: `⛔ Quota atteint pour **${rule.displayName}** (${rule.cap}/${scope}).`, ephemeral: true });
  }

  const priceToCharge = item.price ?? rule.price;
  await chargePoints(buyerId, priceToCharge, `BUY_CONSUMABLE:${rule.displayName}`);
  await addConsumable(buyerId, cType, 1);

  return inter.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle("✅ Achat confirmé")
        .setDescription(
          `Tu as acheté **${rule.displayName}** pour **${priceToCharge} pts**.\n` +
            `Il te reste **${quota.remaining}** achat(s) disponible(s) sur la fenêtre en cours.`,
        ),
    ],
    ephemeral: true,
  });
}
