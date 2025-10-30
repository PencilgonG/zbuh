import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, } from "discord.js";
import { BANNER_URL, LOGO_URL, ROLES, MATCH_REPOST, MATCH_SKIP, MATCH_VALIDATE, } from "./constants.js";
/* ---------- Waiting room ---------- */
export function lobbyEmbed(opts) {
    const e = new EmbedBuilder()
        .setTitle(`🛡️ Inhouse: ${opts.name}`)
        .setDescription(`Mode **${opts.mode}** • Équipes: **${opts.teamCount}**\n` +
        `Clique sur un bouton pour t'inscrire/désinscrire.`)
        .setColor(0xffd166)
        .setFooter({
        text: "MYG Inhouses — Waiting Room",
        iconURL: LOGO_URL || undefined,
    });
    if (BANNER_URL)
        e.setImage(BANNER_URL);
    const fields = ROLES.map((r) => {
        const cap = opts.caps[r];
        const current = opts.slots[r].length;
        const head = cap === null ? `∞` : `${current}/${cap}`;
        const names = opts.slots[r].length
            ? opts.slots[r].map((u) => `<@${u}>`).join(" · ")
            : "—";
        return { name: `${r} (${head})`, value: names, inline: true };
    });
    e.addFields(fields);
    return e;
}
/* ---------- Team Builder ---------- */
export function teamBuilderEmbed(state) {
    const maxPage = Math.max(1, Math.ceil(state.teamCount / 2));
    const startIdx = (state.page - 1) * 2;
    const teams = state.teams.slice(startIdx, startIdx + 2);
    const e = new EmbedBuilder()
        .setTitle(`🧩 Team Builder — ${state.name}`)
        .setDescription(`Mode **${state.mode}** • Équipes **${state.teamCount}** • ` +
        `Page **${state.page}/${maxPage}**`)
        .setColor(0x90be6d)
        .setFooter({
        text: "MYG Inhouses — Team Builder",
        iconURL: LOGO_URL || undefined,
    });
    if (BANNER_URL)
        e.setImage(BANNER_URL);
    const poolTxt = state.pool.length
        ? state.pool.map((u) => `<@${u}>`).join(" · ")
        : "_Pool vide_";
    e.addFields({ name: "🎒 Pool disponible", value: poolTxt });
    for (const t of teams) {
        const lines = [];
        ["Top", "Jungle", "Mid", "ADC", "Support"].forEach((r) => {
            const v = t.slots[r] ? `<@${t.slots[r]}>` : "—";
            lines.push(`**${r}**: ${v}`);
        });
        lines.push(`**Capitaine**: ${t.captainId ? `<@${t.captainId}>` : "—"}`);
        lines.push(`**Nom**: ${t.name}`);
        e.addFields({
            name: `🛡️ Équipe ${t.number}`,
            value: lines.join("\n"),
            inline: true,
        });
    }
    if (teams.length === 1)
        e.addFields({ name: "\u200B", value: "\u200B", inline: true });
    e.addFields({
        name: "🎯 Format",
        value: state.format ? `\`${state.format}\`` : "—",
    });
    return e;
}
/* ---------- Line-up ---------- */
export function lineupEmbed(state) {
    const e = new EmbedBuilder()
        .setTitle(`📋 Line-up — ${state.name}`)
        .setColor(0x577590)
        .setFooter({
        text: "MYG Inhouses — Line-up",
        iconURL: LOGO_URL || undefined,
    });
    if (BANNER_URL)
        e.setImage(BANNER_URL);
    for (const t of state.teams) {
        const lines = [];
        ["Top", "Jungle", "Mid", "ADC", "Support"].forEach((r) => {
            const v = t.slots[r] ? `<@${t.slots[r]}>` : "—";
            lines.push(`**${r}**: ${v}`);
        });
        lines.push(`**Capitaine**: ${t.captainId ? `<@${t.captainId}>` : "—"}`);
        e.addFields({
            name: `🛡️ ${t.name}`,
            value: lines.join("\n"),
            inline: true,
        });
    }
    return e;
}
/* ---------- Match board (spectate only) ---------- */
export function matchEmbed(state, m) {
    const blue = state.teams.find((t) => t.number === m.blueTeam)?.name ??
        `Team ${m.blueTeam}`;
    const red = state.teams.find((t) => t.number === m.redTeam)?.name ??
        `Team ${m.redTeam}`;
    return {
        embeds: [
            new EmbedBuilder()
                .setTitle(`🧭 Match ${m.index + 1}: ${blue} vs ${red}`)
                .setColor(0xee964b)
                .setDescription(`État: **${m.state}**`)
                .addFields({ name: "Blue", value: blue, inline: true }, { name: "Red", value: red, inline: true })
                // Affiche UNIQUEMENT le lien spectateur dans le board public
                .addFields({ name: "Lien spectateur", value: m.links?.spec ?? "—" })
                .setFooter({
                text: "MYG Inhouses — Match Board",
                iconURL: LOGO_URL || undefined,
            }),
        ],
        components: [
            new ActionRowBuilder().addComponents(new ButtonBuilder()
                .setCustomId(MATCH_VALIDATE)
                .setLabel("✅ Valider (respo)")
                .setStyle(ButtonStyle.Success), new ButtonBuilder()
                .setCustomId(MATCH_REPOST)
                .setLabel("🔁 Reposter liens")
                .setStyle(ButtonStyle.Secondary), new ButtonBuilder()
                .setCustomId(MATCH_SKIP)
                .setLabel("⏭️ Skip (respo)")
                .setStyle(ButtonStyle.Danger)),
        ],
    };
}
