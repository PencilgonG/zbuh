import { ChannelType, Guild } from "discord.js";

export interface TeamChannelsRef {
  categoryId: string;
  textId: string;
  voiceId: string;
}

export async function createTeamCategory(
  guild: Guild,
  teamName: string,
  visibleForEveryone = true
): Promise<TeamChannelsRef> {
  // Catégorie
  const category = await guild.channels.create({
    name: `🛡️ ${teamName}`,
    type: ChannelType.GuildCategory,
  });

  // Permissions : par défaut visible ; si false => cacher au @everyone
  if (!visibleForEveryone) {
    const everyone = guild.roles.everyone;
    // utilisez EDIT (meilleure compatibilité types djs v14)
    await category.permissionOverwrites.edit(everyone, { ViewChannel: false });
  }

  // Text
  const text = await guild.channels.create({
    name: `${teamName}-text`,
    type: ChannelType.GuildText,
    parent: category.id,
  });

  // Voice
  const voice = await guild.channels.create({
    name: `${teamName}-voice`,
    type: ChannelType.GuildVoice,
    parent: category.id,
  });

  return { categoryId: category.id, textId: text.id, voiceId: voice.id };
}

export async function deleteTeamCategory(guild: Guild, refs: TeamChannelsRef) {
  const { categoryId, textId, voiceId } = refs;
  const del = async (id?: string) => {
    if (!id) return;
    const ch = guild.channels.cache.get(id);
    if (ch) {
      try {
        await ch.delete();
      } catch {
        /* ignore */
      }
    }
  };
  await del(textId);
  await del(voiceId);
  await del(categoryId);
}
