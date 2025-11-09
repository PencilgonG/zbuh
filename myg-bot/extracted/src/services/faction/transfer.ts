// src/services/faction/transfer.ts
import { prisma } from "@/lib/prisma";
import {
  OfferStatus,
  ConsumableType,
  type FactionTransferOffer,
} from "@prisma/client";
import {
  APIEmbed,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} from "discord.js";

const OFFER_EXPIRATION_HOURS = 24;

/**
 * Construit l'embed + boutons pour le DM du joueur ciblé.
 * (Renvoie les composants à envoyer par ton bot — pas d'appel sendDM ici)
 */
export function buildTransferDM(params: {
  offer: FactionTransferOffer;
  fromUserId: string;
  fromFactionName: string;
  toFactionName: string;
}) {
  const { offer, fromUserId, fromFactionName, toFactionName } = params;

  const embed: APIEmbed = {
    title: "⚔️ Offre de transfert de faction",
    description: `Le joueur <@${fromUserId}> souhaite te **racheter** pour rejoindre sa faction.`,
    fields: [
      { name: "Faction actuelle", value: `\`${fromFactionName}\`` },
      { name: "Nouvelle faction", value: `\`${toFactionName}\`` },
      { name: "Expiration", value: `<t:${Math.floor(offer.expiresAt.getTime() / 1000)}:R>` },
    ],
    color: 0xf1c40f,
  };

  const acceptBtn = new ButtonBuilder()
    .setCustomId(`FAC:TRANSF:ACC:${offer.id}`)
    .setLabel("Accepter le transfert")
    .setStyle(ButtonStyle.Success);

  const declineBtn = new ButtonBuilder()
    .setCustomId(`FAC:TRANSF:DEC:${offer.id}`)
    .setLabel("Refuser")
    .setStyle(ButtonStyle.Danger);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(acceptBtn, declineBtn);
  return { embed, components: [row] as const };
}

/**
 * Propose un transfert :
 * - vérifie que from & target ont une faction et qu'elles diffèrent
 * - vérifie que from possède un consommable FACTION_TRANSFER (quantity > 0)
 * - crée l'offre (PENDING)
 * - renvoie { offer, dm } pour que l'appelant envoie le DM lui-même
 */
export async function proposeTransfer(fromId: string, targetId: string) {
  // profils + factions
  const [from, target] = await Promise.all([
    prisma.userProfile.findUnique({ where: { discordId: fromId } }),
    prisma.userProfile.findUnique({ where: { discordId: targetId } }),
  ]);

  if (!from || !target) throw new Error("Profils introuvables.");
  if (!from.factionId || !target.factionId)
    throw new Error("Les deux joueurs doivent appartenir à une faction.");
  if (from.factionId === target.factionId)
    throw new Error("Les deux joueurs sont déjà dans la même faction.");

  // consommable (stock)
  const stock = await prisma.consumableStock.findUnique({
    where: {
      userId_type: { userId: fromId, type: ConsumableType.FACTION_TRANSFER },
    },
  });
  if (!stock || stock.quantity <= 0) {
    throw new Error("Tu ne possèdes pas de **Transfert de Faction**.");
  }

  const expiresAt = new Date(Date.now() + OFFER_EXPIRATION_HOURS * 60 * 60 * 1000);

  const offer = await prisma.factionTransferOffer.create({
    data: {
      fromUserId: fromId,
      targetUserId: targetId,
      fromFactionId: target.factionId,
      toFactionId: from.factionId,
      status: OfferStatus.PENDING,
      expiresAt,
    },
  });

  // noms jolis de factions pour le DM
  const [fromFaction, toFaction] = await Promise.all([
    prisma.faction.findUnique({ where: { id: target.factionId } }),
    prisma.faction.findUnique({ where: { id: from.factionId } }),
  ]);

  const dm = buildTransferDM({
    offer,
    fromUserId: fromId,
    fromFactionName: fromFaction?.name ?? `#${target.factionId}`,
    toFactionName: toFaction?.name ?? `#${from.factionId}`,
  });

  return { offer, dm };
}

/**
 * Accepter un transfert :
 * - vérifie ownership du target
 * - décrémente le stock de FACTION_TRANSFER du fromUser
 * - déplace la faction du target vers toFactionId
 * - marque l'offre ACCEPTED
 */
export async function acceptTransfer(offerId: string, targetId: string) {
  return prisma.$transaction(async (tx) => {
    const offer = await tx.factionTransferOffer.findUnique({ where: { id: offerId } });
    if (!offer) throw new Error("Offre introuvable.");
    if (offer.status !== OfferStatus.PENDING) throw new Error("Offre déjà traitée.");
    if (offer.targetUserId !== targetId) throw new Error("Tu n'es pas le joueur ciblé.");
    if (offer.expiresAt.getTime() < Date.now()) throw new Error("Offre expirée.");

    // décrémente le stock du fromUser
    const stock = await tx.consumableStock.findUnique({
      where: {
        userId_type: { userId: offer.fromUserId, type: ConsumableType.FACTION_TRANSFER },
      },
    });
    if (!stock || stock.quantity <= 0) {
      throw new Error("L'initiateur n'a plus de Transfert de Faction en stock.");
    }
    await tx.consumableStock.update({
      where: { userId_type: { userId: offer.fromUserId, type: ConsumableType.FACTION_TRANSFER } },
      data: { quantity: { decrement: 1 } },
    });

    // déplace le joueur
    await tx.userProfile.update({
      where: { discordId: offer.targetUserId },
      data: { factionId: offer.toFactionId },
    });

    // marque l'offre ACCEPTED
    const updated = await tx.factionTransferOffer.update({
      where: { id: offerId },
      data: { status: OfferStatus.ACCEPTED, decidedAt: new Date() },
    });

    return updated;
  });
}

/**
 * Refuser un transfert (marque DECLINED).
 */
export async function declineTransfer(offerId: string, targetId: string) {
  return prisma.$transaction(async (tx) => {
    const offer = await tx.factionTransferOffer.findUnique({ where: { id: offerId } });
    if (!offer) throw new Error("Offre introuvable.");
    if (offer.status !== OfferStatus.PENDING) throw new Error("Offre déjà traitée.");
    if (offer.targetUserId !== targetId) throw new Error("Tu n'es pas le joueur ciblé.");

    const updated = await tx.factionTransferOffer.update({
      where: { id: offerId },
      data: { status: OfferStatus.DECLINED, decidedAt: new Date() },
    });

    return updated;
  });
}
