import { ChannelType, Guild, OverwriteType, PermissionFlagsBits } from "discord.js";

/** Crée un salon vocal éphémère basique (retourne l'ID) */
export async function createTempVoice(guild: Guild, name: string): Promise<string | null> {
  try {
    const ch = await guild.channels.create({
      name: `voice-${name}`.toLowerCase().replace(/\s+/g, "-").slice(0, 90),
      type: ChannelType.GuildVoice,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          type: OverwriteType.Role,
          allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel],
        },
      ],
    });
    return ch.id;
  } catch {
    return null;
  }
}

/** Supprime un salon par ID (safe) */
export async function deleteChannelSafe(guild: Guild, channelId: string) {
  try {
    const ch = await guild.channels.fetch(channelId);
    if (ch) await ch.delete().catch(() => {});
  } catch {}
}
