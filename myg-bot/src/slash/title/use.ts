// src/slash/title/use.ts
import {
  ActionRowBuilder,
  ChatInputCommandInteraction,
  ComponentType,
  EmbedBuilder,
  StringSelectMenuBuilder,
} from "discord.js";
import { prisma } from "../../prismat";
import { mygEmbedBase } from "../../utils/embeds";

/**
 * /title use
 * - Si le joueur n'a aucun titre -> message explicite
 * - S'il n'a qu'un seul titre -> on l'équipe directement
 * - S'il en a plusieurs -> on ouvre un select éphémère pour choisir, puis on set activeTitleId
 *
 * Remarque: pas besoin de /title clear — relancer /title use remplace le titre actif.
 */
export async function handleTitleUse(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;
  await interaction.deferReply({ ephemeral: true });

  // Récupère les titres possédés + titre actif
  const profile = await prisma.userProfile.findUnique({
    where: { discordId: userId },
    include: {
      titles: { include: { title: true } }, // UserTitle[] avec Title inclus
      activeTitle: true,
      faction: true,
    },
  });

  if (!profile) {
    await interaction.editReply("❌ Tu n'as pas encore de profil. Utilise `/profil set` d'abord.");
    return;
  }

  const owned = (profile.titles ?? []).map((ut) => ut.title).filter(Boolean);
  if (owned.length === 0) {
    await interaction.editReply("ℹ️ Tu ne possèdes **aucun titre** pour le moment.");
    return;
  }

  // S'il n'y a qu'un seul titre, on l'équipe directement
  if (owned.length === 1) {
    const t = owned[0]!;
    await prisma.userProfile.update({
      where: { discordId: userId },
      data: { activeTitleId: t.id },
    });

    const embed = new EmbedBuilder(
      mygEmbedBase({
        title: "Titre équipé",
        description: `Tu affiches maintenant le titre **${t.name}**.`,
        footer: { text: "Réexécute /title use pour en choisir un autre." },
      }),
    );
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // Plusieurs titres → proposer un select (max 25 options Discord)
  const options = owned.slice(0, 25).map((t) => ({
    label: t.name.slice(0, 100),
    value: String(t.id),
    description: (t.rarity ? `${t.rarity}` : "Titre")?.slice(0, 100),
    default: profile.activeTitleId === t.id,
  }));

  const selectId = `TITLE:USE:${userId}:${Date.now()}`;
  const select = new StringSelectMenuBuilder()
    .setCustomId(selectId)
    .setPlaceholder("Choisis le titre à afficher")
    .addOptions(options);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

  const embed = new EmbedBuilder(
    mygEmbedBase({
      title: "Choisir un titre",
      description:
        `Tu possèdes **${owned.length}** titres.\n` +
        (profile.activeTitle
          ? `Titre actuel: **${profile.activeTitle.name}**\n`
          : "_Aucun titre équipé actuellement._"),
    }),
  );

  await interaction.editReply({ embeds: [embed], components: [row] });

  // Attendre la sélection (uniquement l'auteur, sur ce message)
  const msg = await interaction.fetchReply();
  try {
    const sel = await (msg as any).awaitMessageComponent({
      componentType: ComponentType.StringSelect,
      time: 60_000,
      filter: (i: any) => i.user.id === userId && i.customId === selectId,
    });

    const chosen = parseInt(sel.values[0]!, 10);
    const chosenTitle = owned.find((t) => t.id === chosen);

    await sel.deferUpdate();

    if (!chosenTitle) {
      await interaction.editReply({
        content: "⚠️ Titre invalide ou plus disponible.",
        embeds: [],
        components: [],
      });
      return;
    }

    await prisma.userProfile.update({
      where: { discordId: userId },
      data: { activeTitleId: chosen },
    });

    const done = new EmbedBuilder(
      mygEmbedBase({
        title: "Titre équipé",
        description: `Tu affiches maintenant le titre **${chosenTitle.name}**.`,
      }),
    );

    await interaction.editReply({ embeds: [done], components: [] });
  } catch {
    // Timeout / aucune sélection
    await interaction.editReply({
      content: "⏱️ Sélection expirée.",
      embeds: [],
      components: [],
    });
  }
}
