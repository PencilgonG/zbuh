import { data as profileData, execute as profileExecute, } from "../commands/profile/index.js";
import { data as lobbyData, execute as lobbyExecute, } from "../commands/lobby/index.js";
import { onButton, onTeamBuilderButton } from "./buttons.js";
import { onSelect } from "./selects.js";
import { onModal } from "./modals.js";
import { get as getStateByMessage, findStateByChannel, } from "../utils/lobby.js";
import { MATCH_REPOST, MATCH_SKIP, MATCH_VALIDATE, } from "../utils/constants.js";
import { onMatchRepost, onMatchSkip, onMatchValidate } from "./match.js";
/**
 * Route les slash commands
 */
export async function handleSlash(interaction) {
    const name = interaction.commandName;
    if (name === profileData.name)
        return profileExecute(interaction);
    if (name === lobbyData.name)
        return lobbyExecute(interaction);
}
/**
 * Route TOUTES les interactions (boutons, selects, modals, slash)
 */
export async function handleAny(interaction) {
    if (interaction.isChatInputCommand())
        return handleSlash(interaction);
    if (interaction.isButton()) {
        // 1) Waiting room: le message d'origine (embed salle d'attente) porte l'état
        const stateByMsg = interaction.message
            ? getStateByMessage(interaction.message.id)
            : undefined;
        if (stateByMsg && interaction.customId.startsWith("lobby:")) {
            return onButton(interaction);
        }
        // 2) Team Builder (réponse éphémère): on résout via le salon
        const stateByChan = findStateByChannel(interaction.channelId);
        if (stateByChan && interaction.customId.startsWith("tb:")) {
            return onTeamBuilderButton(interaction, stateByChan);
        }
        // 3) Match board (salon match)
        if (interaction.customId === MATCH_VALIDATE)
            return onMatchValidate(interaction);
        if (interaction.customId === MATCH_REPOST)
            return onMatchRepost(interaction);
        if (interaction.customId === MATCH_SKIP)
            return onMatchSkip(interaction);
        // fallback
        return interaction.reply({
            content: "Action inconnue ou session introuvable.",
            ephemeral: true,
        });
    }
    if (interaction.isStringSelectMenu()) {
        return onSelect(interaction);
    }
    if (interaction.isModalSubmit()) {
        return onModal(interaction);
    }
}
