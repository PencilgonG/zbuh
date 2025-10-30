import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, } from "discord.js";
import { JOIN_IDS, BTN_VALIDATE_ID, BTN_FAKE_ID, } from "../../utils/constants.js";
import { createState, put } from "../../utils/lobby.js";
import { lobbyEmbed } from "../../utils/embeds.js";
import { rememberState as rememberTBState } from "../../interactions/selects.js";
export const data = new SlashCommandBuilder()
    .setName("lobby")
    .setDescription("Créer et gérer un lobby inhouse")
    .addSubcommand((sub) => sub
    .setName("create")
    .setDescription("Créer un lobby (salle d’attente)")
    .addStringOption((o) => o.setName("name").setDescription("Nom de l’inhouse").setRequired(true))
    .addStringOption((o) => o
    .setName("mode")
    .setDescription("Mode")
    .addChoices({ name: "5v5", value: "5v5" }, { name: "4v4", value: "4v4" }, { name: "3v3", value: "3v3" }, { name: "2v2", value: "2v2" }, { name: "1v1", value: "1v1" })
    .setRequired(true))
    .addIntegerOption((o) => o
    .setName("teams")
    .setDescription("Nombre d’équipes (2–6)")
    .setMinValue(2)
    .setMaxValue(6)
    .setRequired(true)));
export async function execute(interaction) {
    if (interaction.options.getSubcommand() !== "create")
        return;
    const name = interaction.options.getString("name", true);
    const mode = interaction.options.getString("mode", true);
    const teamCount = interaction.options.getInteger("teams", true);
    const state = createState({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        name,
        mode,
        teamCount,
    });
    const row1 = new ActionRowBuilder().addComponents(new ButtonBuilder()
        .setCustomId(JOIN_IDS.Top)
        .setLabel("Top")
        .setStyle(ButtonStyle.Primary), new ButtonBuilder()
        .setCustomId(JOIN_IDS.Jungle)
        .setLabel("Jungle")
        .setStyle(ButtonStyle.Primary), new ButtonBuilder()
        .setCustomId(JOIN_IDS.Mid)
        .setLabel("Mid")
        .setStyle(ButtonStyle.Primary), new ButtonBuilder()
        .setCustomId(JOIN_IDS.ADC)
        .setLabel("ADC")
        .setStyle(ButtonStyle.Primary), new ButtonBuilder()
        .setCustomId(JOIN_IDS.Support)
        .setLabel("Support")
        .setStyle(ButtonStyle.Primary));
    const row2 = new ActionRowBuilder().addComponents(new ButtonBuilder()
        .setCustomId(JOIN_IDS.Flex)
        .setLabel("Flex")
        .setStyle(ButtonStyle.Secondary), new ButtonBuilder()
        .setCustomId(JOIN_IDS.Sub)
        .setLabel("Sub")
        .setStyle(ButtonStyle.Secondary), new ButtonBuilder()
        .setCustomId(BTN_VALIDATE_ID)
        .setLabel("Valider (respo)")
        .setStyle(ButtonStyle.Success), new ButtonBuilder()
        .setCustomId(BTN_FAKE_ID)
        .setLabel("🧪 Fake")
        .setStyle(ButtonStyle.Danger));
    const msg = await interaction.reply({
        embeds: [
            lobbyEmbed({
                name,
                mode,
                teamCount,
                slots: state.slots,
                caps: state.caps,
            }),
        ],
        components: [row1, row2],
        fetchReply: true,
    });
    state.messageId = msg.id;
    put(state);
    rememberTBState(interaction.channelId, msg.id);
}
