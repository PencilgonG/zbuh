import { SlashCommandBuilder, EmbedBuilder, } from "discord.js";
import { prisma } from "../../../db.js";
import { config } from "dotenv";
config();
export const data = new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Gère ton profil League of Legends")
    // /profile set
    .addSubcommand((sub) => sub
    .setName("set")
    .setDescription("Crée ou modifie ton profil MYG")
    .addStringOption((o) => o
    .setName("lolname")
    .setDescription("Ton pseudo complet LoL (ex: Aram Fétichiste#Gang)")
    .setRequired(true))
    .addStringOption((o) => o
    .setName("mainrole")
    .setDescription("Ton rôle principal")
    .addChoices({ name: "Top", value: "Top" }, { name: "Jungle", value: "Jungle" }, { name: "Mid", value: "Mid" }, { name: "ADC", value: "ADC" }, { name: "Support", value: "Support" })
    .setRequired(true))
    .addStringOption((o) => o
    .setName("elo")
    .setDescription("Ton elo (ex: Emerald 2)")
    .setRequired(true))
    .addStringOption((o) => o
    .setName("opgg")
    .setDescription("Lien vers ton profil OP.GG")
    .setRequired(true))
    .addStringOption((o) => o
    .setName("dpm")
    .setDescription("Lien vers ton profil DPM.LOL")
    .setRequired(true))
    .addStringOption((o) => o
    .setName("secondaryrole")
    .setDescription("Ton rôle secondaire")
    .addChoices({ name: "Top", value: "Top" }, { name: "Jungle", value: "Jungle" }, { name: "Mid", value: "Mid" }, { name: "ADC", value: "ADC" }, { name: "Support", value: "Support" }, { name: "Aucun", value: "None" })))
    // /profile view
    .addSubcommand((sub) => sub
    .setName("view")
    .setDescription("Affiche le profil d’un joueur")
    .addUserOption((o) => o
    .setName("utilisateur")
    .setDescription("Choisis le joueur à afficher")
    .setRequired(true)));
export async function execute(interaction) {
    const sub = interaction.options.getSubcommand();
    // /profile set
    if (sub === "set") {
        const discordId = interaction.user.id;
        const username = interaction.user.username;
        const lolName = interaction.options.getString("lolname", true);
        const mainRole = interaction.options.getString("mainrole", true);
        const secondaryRole = interaction.options.getString("secondaryrole") || "None";
        const elo = interaction.options.getString("elo", true);
        const opgg = interaction.options.getString("opgg", true);
        const dpm = interaction.options.getString("dpm", true);
        await prisma.userProfile.upsert({
            where: { discordId },
            update: {
                lolName,
                mainRole,
                secondaryRole,
                elo,
                opggLink: opgg,
                dpmLink: dpm,
            },
            create: {
                discordId,
                username,
                lolName,
                mainRole,
                secondaryRole,
                elo,
                opggLink: opgg,
                dpmLink: dpm,
            },
        });
        const embed = new EmbedBuilder()
            .setTitle("✅ Profil mis à jour")
            .setColor(0x00ffb3)
            .setThumbnail(interaction.user.displayAvatarURL())
            .setDescription(`Ton profil a bien été enregistré dans la base MYG.`)
            .addFields({ name: "Pseudo LoL", value: lolName, inline: true }, { name: "Rôle principal", value: mainRole, inline: true }, { name: "Rôle secondaire", value: secondaryRole, inline: true }, { name: "Elo", value: elo, inline: true }, { name: "OP.GG", value: opgg, inline: false }, { name: "DPM", value: dpm, inline: false });
        if (process.env.LOGO_URL) {
            embed.setFooter({ text: "MYG Database", iconURL: process.env.LOGO_URL });
        }
        await interaction.reply({ embeds: [embed], ephemeral: true });
        return;
    }
    // /profile view
    if (sub === "view") {
        const user = interaction.options.getUser("utilisateur", true);
        const profile = await prisma.userProfile.findUnique({
            where: { discordId: user.id },
        });
        if (!profile) {
            await interaction.reply({
                content: "❌ Ce joueur n’a pas encore créé de profil via `/profile set`.",
                ephemeral: true,
            });
            return;
        }
        const embed = new EmbedBuilder()
            .setColor(0x00b2ff)
            .setTitle(`${profile.username} – Profil MYG`)
            .setThumbnail(user.displayAvatarURL())
            .addFields({ name: "Pseudo LoL", value: profile.lolName, inline: true }, { name: "Rôle principal", value: profile.mainRole, inline: true }, {
            name: "Rôle secondaire",
            value: profile.secondaryRole || "Aucun",
            inline: true,
        }, { name: "Elo", value: profile.elo, inline: true }, {
            name: "Liens",
            value: `[OP.GG](${profile.opggLink}) | [DPM.LOL](${profile.dpmLink})`,
            inline: false,
        });
        if (process.env.BANNER_URL)
            embed.setImage(process.env.BANNER_URL);
        if (process.env.LOGO_URL) {
            embed.setFooter({ text: "MYG Database", iconURL: process.env.LOGO_URL });
        }
        await interaction.reply({ embeds: [embed] });
    }
}
