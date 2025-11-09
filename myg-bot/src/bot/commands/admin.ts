// src/bot/commands/admin.ts
import {
  ChatInputCommandInteraction,
  GuildMember,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { prisma } from "../../prismat";
import { env } from "../../env";
import { costForNextLevel } from "../../utils/factions";

function ensureGuild(inter: ChatInputCommandInteraction) {
  if (!inter.inGuild()) throw new Error("Cette commande doit être utilisée dans un serveur.");
}

function isRespo(member: GuildMember | null): boolean {
  const roleId = env.ROLE_RESPO_ID;
  if (!member || !roleId) return false;
  return member.roles.cache.has(roleId);
}

async function getBalance(discordId: string): Promise<number> {
  const agg = await prisma.pointsLedger.aggregate({
    _sum: { points: true },
    where: { discordId },
  });
  return agg._sum.points ?? 0;
}

export const data = new SlashCommandBuilder()
  .setName("admin")
  .setDescription("Commandes admin (Respo seulement)")
  .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
  .setDMPermission(false)

  // ---- INVENTORY ----
  .addSubcommandGroup((g) =>
    g
      .setName("inventory")
      .setDescription("Inventaire joueur")
      .addSubcommand((sc) =>
        sc
          .setName("clear")
          .setDescription("Vider l'inventaire d'un joueur (consommables + quotas)")
          .addUserOption((o) =>
            o.setName("user").setDescription("Joueur cible").setRequired(true),
          ),
      ),
  )

  // ---- USER POINTS ----
  .addSubcommandGroup((g) =>
    g
      .setName("userpoints")
      .setDescription("Points MYG du joueur")
      .addSubcommand((sc) =>
        sc
          .setName("give")
          .setDescription("Donner X points à un joueur")
          .addUserOption((o) =>
            o.setName("user").setDescription("Joueur cible").setRequired(true),
          )
          .addIntegerOption((o) =>
            o.setName("amount").setDescription("Montant (>0)").setRequired(true),
          ),
      )
      .addSubcommand((sc) =>
        sc
          .setName("reset")
          .setDescription("Remettre à zéro les points d'un joueur (ajustement)")
          .addUserOption((o) =>
            o.setName("user").setDescription("Joueur cible").setRequired(true),
          ),
      ),
  )

  // ---- FACTION LEVEL ----
  .addSubcommandGroup((g) =>
    g
      .setName("factionlevel")
      .setDescription("Niveau de faction")
      .addSubcommand((sc) =>
        sc
          .setName("set")
          .setDescription("Fixer le niveau d'une faction")
          .addStringOption((o) =>
            o
              .setName("faction")
              .setDescription("Nom exact de la faction (ex: Freljord)")
              .setRequired(true),
          )
          .addIntegerOption((o) =>
            o
              .setName("level")
              .setDescription("Niveau (1–30)")
              .setRequired(true)
              .setMinValue(1)
              .setMaxValue(30),
          ),
      )
      .addSubcommand((sc) =>
        sc
          .setName("reset_all")
          .setDescription("Réinitialiser TOUTES les factions à L1, 0%"),
      ),
  )

  // ---- FACTION MEMBERSHIP ----
  .addSubcommandGroup((g) =>
    g
      .setName("faction")
      .setDescription("Gestion d'appartenance à une faction")
      .addSubcommand((sc) =>
        sc
          .setName("set")
          .setDescription("Changer un joueur de faction")
          .addUserOption((o) =>
            o.setName("user").setDescription("Joueur cible").setRequired(true),
          )
          .addStringOption((o) =>
            o
              .setName("faction")
              .setDescription("Nom exact de la faction (ex: Freljord)")
              .setRequired(true),
          ),
      )
      .addSubcommand((sc) =>
        sc
          .setName("remove")
          .setDescription("Retirer un joueur de sa faction")
          .addUserOption((o) =>
            o.setName("user").setDescription("Joueur cible").setRequired(true),
          ),
      ),
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    ensureGuild(interaction);

    const member = interaction.member as GuildMember | null;
    if (!isRespo(member)) {
      return interaction.reply({
        content: "🚫 Tu n'as pas le rôle requis pour cette commande.",
        ephemeral: true,
      });
    }

    const group = interaction.options.getSubcommandGroup(true);
    const sub = interaction.options.getSubcommand(true);

    // =============== INVENTORY ===============
    if (group === "inventory" && sub === "clear") {
      const user = interaction.options.getUser("user", true);
      await prisma.$transaction([
        prisma.consumableStock.deleteMany({ where: { userId: user.id } }),
        prisma.userQuota.deleteMany({ where: { userId: user.id } }),
      ]);
      return interaction.reply({
        content: `🧹 Inventaire vidé pour <@${user.id}> (consommables + quotas).`,
        ephemeral: true,
      });
    }

    // =============== USER POINTS ===============
    if (group === "userpoints" && sub === "give") {
      const user = interaction.options.getUser("user", true);
      const amount = interaction.options.getInteger("amount", true);
      if (amount <= 0)
        return interaction.reply({ content: "Montant invalide.", ephemeral: true });

      await prisma.pointsLedger.create({
        data: {
          discordId: user.id,
          matchId: "ADMIN",
          points: amount,
          reason: "ADMIN_GRANT",
        },
      });

      const balance = await getBalance(user.id);
      return interaction.reply({
        content: `✅ +${amount} pts à <@${user.id}>. Nouveau solde: **${balance}**.`,
        ephemeral: true,
      });
    }

    if (group === "userpoints" && sub === "reset") {
      const user = interaction.options.getUser("user", true);
      const bal = await getBalance(user.id);
      if (bal !== 0) {
        await prisma.pointsLedger.create({
          data: {
            discordId: user.id,
            matchId: "ADMIN",
            points: -bal,
            reason: "ADMIN_RESET",
          },
        });
      }
      return interaction.reply({
        content: `♻️ Points remis à zéro pour <@${user.id}>.`,
        ephemeral: true,
      });
    }

    // =============== FACTION LEVEL ===============
    if (group === "factionlevel" && sub === "set") {
      const name = interaction.options.getString("faction", true);
      const level = interaction.options.getInteger("level", true);

      const faction = await prisma.faction.findFirst({ where: { name } });
      if (!faction) {
        return interaction.reply({ content: "❌ Faction introuvable.", ephemeral: true });
      }

      // upsert FactionState (niveau + progress=0)
      await prisma.factionState.upsert({
        where: { factionId: faction.id },
        update: { level, progress: 0 },
        create: { factionId: faction.id, level, progress: 0 },
      });

      const need = costForNextLevel(level);
      return interaction.reply({
        content: `🛠️ ${name} → niveau **${level}** (progression 0%, prochain palier: ${need ?? "—"} pts).`,
        ephemeral: true,
      });
    }

    if (group === "factionlevel" && sub === "reset_all") {
      // Met à jour toutes les lignes existantes
      await prisma.factionState.updateMany({ data: { level: 1, progress: 0 } });
      // Crée les manquantes (si de nouvelles factions existent)
      const factions = await prisma.faction.findMany();
      await Promise.all(
        factions.map((f) =>
          prisma.factionState.upsert({
            where: { factionId: f.id },
            update: { level: 1, progress: 0 },
            create: { factionId: f.id, level: 1, progress: 0 },
          }),
        ),
      );
      return interaction.reply({
        content: "🔁 Tous les niveaux de faction ont été réinitialisés à **1** (0%).",
        ephemeral: true,
      });
    }

    // =============== FACTION MEMBERSHIP ===============
    if (group === "faction" && sub === "set") {
      const user = interaction.options.getUser("user", true);
      const name = interaction.options.getString("faction", true);

      const faction = await prisma.faction.findFirst({ where: { name } });
      if (!faction) {
        return interaction.reply({ content: "❌ Faction introuvable.", ephemeral: true });
      }

      await prisma.userProfile.upsert({
        where: { discordId: user.id },
        update: { factionId: faction.id },
        create: { discordId: user.id, factionId: faction.id },
      });

      return interaction.reply({
        content: `🏳️ <@${user.id}> → **${name}**.`,
        ephemeral: true,
      });
    }

    if (group === "faction" && sub === "remove") {
      const user = interaction.options.getUser("user", true);
      const profile = await prisma.userProfile.findUnique({
        where: { discordId: user.id },
      });
      if (!profile?.factionId) {
        return interaction.reply({
          content: "ℹ️ Ce joueur n'est dans aucune faction.",
          ephemeral: true,
        });
      }
      await prisma.userProfile.update({
        where: { discordId: user.id },
        data: { factionId: null },
      });
      return interaction.reply({
        content: `🚪 <@${user.id}> a été retiré de sa faction.`,
        ephemeral: true,
      });
    }

    return interaction.reply({ content: "Sous-commande inconnue.", ephemeral: true });
  } catch (e: any) {
    return interaction.reply({
      content: `❌ Erreur: ${e?.message ?? "inconnue"}`,
      ephemeral: true,
    });
  }
}
