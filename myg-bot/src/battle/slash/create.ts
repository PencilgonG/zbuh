import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  TextChannel,
} from "discord.js";
import { prisma } from "../../prismat";
import { mygEmbedBase } from "../../utils/embeds";

const BR_RULES =
  "Mode 1v1 (map ARAM) · **First blood only** · **Même champion**, **mêmes runes**, **mêmes items** · Heals autorisés.";

function ensureTextChannel(inter: ChatInputCommandInteraction): TextChannel | null {
  const ch: any = inter.channel;
  if (!ch || !("isTextBased" in ch) || !ch.isTextBased()) return null;
  return ch as TextChannel;
}

/**
 * /br — crée un lobby Battle Royale complètement séparé
 */
export async function handleBrCreate(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const name = interaction.options.getString("nom", true);

  // 1) Crée le lobby en mode BR
  const lobby = await prisma.lobby.create({
    data: {
      guildId: interaction.guildId!,
      channelId: interaction.channelId,
      messageId: "pending",
      name,
      teams: 0, // pas d’équipes en BR
      status: "WAITING",
      createdBy: interaction.user.id,
      format: null,
      mode: "BATTLE_ROYALE",
    },
    select: { id: true, name: true },
  });

  // 2) Salon textuel
  const ch = ensureTextChannel(interaction);
  if (!ch) {
    await interaction.editReply("❌ Ce salon n’est pas textuel.");
    return;
  }

  // 3) Embed + boutons spécifiques BR
  const embed = new EmbedBuilder(
    mygEmbedBase({
      title: `Battle Royale — ${lobby.name}`,
      description: `Inscris-toi avec le bouton ci-dessous.\nAucun rôle, aucun cap.\n\n**Règles :** ${BR_RULES}`,
      footer: { text: "Mode: BATTLE ROYALE • Inscriptions libres" },
    }),
  );

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`BR:JOIN:${lobby.id}`)
      .setLabel("S’inscrire / Se désinscrire")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`BR:TESTFILL:${lobby.id}`)
      .setLabel("Remplir (test)")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`BR:VALIDATE:${lobby.id}`)
      .setLabel("Valider (lancer Round 1)")
      .setStyle(ButtonStyle.Success),
  );

  const msg = await ch.send({ embeds: [embed], components: [row] });

  // 4) Sauvegarde du messageId
  await prisma.lobby.update({
    where: { id: lobby.id },
    data: { messageId: msg.id },
  });

  await interaction.editReply("✅ Lobby Battle Royale créé.");
}
