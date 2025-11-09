// src/bot/commands/faction.ts
import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
} from "discord.js";
import { prisma } from "@/lib/prisma";
import type { FactionBadge } from "@prisma/client";

export const data = new SlashCommandBuilder()
  .setName("faction")
  .setDescription("Commandes liées aux factions")
  .addSubcommand((sc) =>
    sc.setName("status").setDescription("Voir tes infos de faction"),
  )
  // (on ajoutera .addSubcommand(...) pour transfer plus tard)
  .setDMPermission(true)
  .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages);

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    const sub = interaction.options.getSubcommand();
    if (sub !== "status") {
      return interaction.reply({ content: "Sous-commande inconnue.", ephemeral: true });
    }

    const userId = interaction.user.id;

    // 1) Récup profil + faction + titre actif + badges
    const profile = await prisma.userProfile.findUnique({
      where: { discordId: userId },
      include: {
        faction: true,
        activeTitle: true,
        factionBadges: true,
      },
    });

    if (!profile) {
      return interaction.reply({
        content:
          "❌ Tu n’as pas encore de profil. Lance une inhouse ou demande à un respo de te créer un profil.",
        ephemeral: true,
      });
    }

    if (!profile.faction) {
      return interaction.reply({
        content: "ℹ️ Tu n’es dans **aucune faction** pour l’instant.",
        ephemeral: true,
      });
    }

    const faction = profile.faction;

    // 2) Stats de faction
    const [membersCount, rankAbove] = await Promise.all([
      prisma.userProfile.count({ where: { factionId: faction.id } }),
      prisma.faction.count({ where: { totalPoints: { gt: faction.totalPoints } } }),
    ]);
    const rank = rankAbove + 1;

    // 3) Prépare champs dynamiques
    const color = faction.colorHex || "#888888";
    const emblem = faction.emblemUrl ?? undefined;

    const badgesLabel =
      profile.factionBadges?.length
        ? profile.factionBadges
            .map((b: FactionBadge) => {
              const pretty =
                b.type === "EMISSAIRE" ? "Émissaire" :
                b.type === "INSIGNE"   ? "Insigne"   :
                b.type;
              return `• ${pretty} <t:${Math.floor(b.acquiredAt.getTime() / 1000)}:R>`;
            })
            .join("\n")
        : "—";

    const titleActive = profile.activeTitle?.name ?? "—";
    const avgPerMember =
      membersCount > 0 ? Math.round((faction.totalPoints / membersCount) * 100) / 100 : 0;

    const embed = new EmbedBuilder()
      .setTitle(`🏳️ Faction ${faction.name}`)
      .setColor(color as any)
      .setThumbnail(emblem)
      .addFields(
        { name: "Points totaux", value: `**${faction.totalPoints}**`, inline: true },
        { name: "Membres", value: `**${membersCount}**`, inline: true },
        { name: "Rang", value: `**#${rank}**`, inline: true },
        { name: "Moyenne / membre", value: `**${avgPerMember}**`, inline: true },
        { name: "Titre actif", value: titleActive, inline: true },
        { name: "Badges", value: badgesLabel, inline: false },
      )
      .setFooter({ text: `ID faction: ${faction.id}` });

    return interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    return interaction.reply({
      content: `❌ Erreur: ${msg}`,
      ephemeral: true,
    });
  }
}
