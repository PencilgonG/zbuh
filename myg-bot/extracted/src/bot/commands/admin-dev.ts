// src/bot/commands/admin-dev.ts
import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
} from "discord.js";
import { prisma } from "../../prismat";
import { env } from "../../env";

export const data = new SlashCommandBuilder()
  .setName("admin-dev")
  .setDescription("Outils dev/respo : infinite points & toggles")
  .addSubcommand((sc) => sc.setName("infinite").setDescription("Toggle infinite points pour toi"))
  .addSubcommand((sc) =>
    sc
      .setName("supp")
      .setDescription("Toggle infinite points pour un utilisateur")
      .addUserOption((opt) => opt.setName("user").setDescription("Cible").setRequired(true)),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

// Petite util pour s'assurer qu'un profil existe (FK intacte)
async function ensureUserProfile(discordId: string) {
  const existing = await prisma.userProfile.findUnique({ where: { discordId } });
  if (existing) return existing;
  // Tous les champs non requis sont optionnels dans ton schema => on crée un profil minimal
  return prisma.userProfile.create({
    data: { discordId },
  });
}

export async function execute(interaction: ChatInputCommandInteraction) {
  // sécurité : réservé aux responsables
  const member = await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
  const isRespo = !!member?.roles.cache.has(env.ROLE_RESPO_ID);
  if (!isRespo) {
    return interaction.reply({ content: "⛔ Réservé aux responsables.", ephemeral: true });
  }

  const sub = interaction.options.getSubcommand(true);

  if (sub === "infinite") {
    const userId = interaction.user.id;

    // Assure la FK
    await ensureUserProfile(userId);

    const current = await prisma.devOverride.findUnique({ where: { userId } });
    const newVal = !current?.infinitePoints;

    await prisma.devOverride.upsert({
      where: { userId },
      update: { infinitePoints: newVal },
      create: { userId, infinitePoints: newVal },
    });

    return interaction.reply({
      content: `🔧 Infinite points **${newVal ? "activé" : "désactivé"}** pour ${interaction.user}.`,
      ephemeral: true,
    });
  }

  if (sub === "supp") {
    const target = interaction.options.getUser("user", true);
    const userId = target.id;

    // Assure la FK
    await ensureUserProfile(userId);

    const current = await prisma.devOverride.findUnique({ where: { userId } });
    const newVal = !current?.infinitePoints;

    await prisma.devOverride.upsert({
      where: { userId },
      update: { infinitePoints: newVal },
      create: { userId, infinitePoints: newVal },
    });

    return interaction.reply({
      content: `🔧 Infinite points **${newVal ? "activé" : "désactivé"}** pour ${target}.`,
      ephemeral: true,
    });
  }

  return interaction.reply({ content: "Commande inconnue.", ephemeral: true });
}
