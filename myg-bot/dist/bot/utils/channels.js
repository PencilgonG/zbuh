import { ChannelType } from "discord.js";
export async function createTeamCategory(guild, teamName, visibleForEveryone = true) {
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
export async function deleteTeamCategory(guild, refs) {
    const { categoryId, textId, voiceId } = refs;
    const del = async (id) => {
        if (!id)
            return;
        const ch = guild.channels.cache.get(id);
        if (ch) {
            try {
                await ch.delete();
            }
            catch {
                /* ignore */
            }
        }
    };
    await del(textId);
    await del(voiceId);
    await del(categoryId);
}
