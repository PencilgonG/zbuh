import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { prisma } from "../prismat";
import { mygEmbedBase } from "../utils/embeds";
import { roleCap } from "./state";
import {
  lobbyJoinId,
  lobbyQuitId,
  lobbyTestId,
  lobbyValidateId,
} from "./ids";

type Row = ActionRowBuilder<ButtonBuilder>;
type RenderResult = { embed: EmbedBuilder; rows: Row[] };

const SURPRISE_RULES: string[] = [
  "Only melee champs",
  "Only ranged champs",
  "Pas de chaussures",
  "Off-meta only",
  "Pas de ward (trinket jaune, rouge, bleu, pinks interdits)",
  "Pas de dragons",
  "Tout le monde joue Ignite",
  "Aucun champ à dashs",
  "Pas le droit de recall avant 5 min (droit de mourir)",
];

const BR_RULES =
  "Mode 1v1 (map ARAM) · **First blood only** · **Même champion**, **mêmes runes**, **mêmes items** · Heals autorisés.";

function fmtList(arr: string[]) {
  return arr.length ? arr.join("\n") : "_(vide)_";
}

export async function renderLobbyMessage(lobbyId: string): Promise<RenderResult> {
  const lobby = await prisma.lobby.findUnique({
    where: { id: lobbyId },
    include: { participants: true },
  });
  if (!lobby) {
    const embed = new EmbedBuilder(
      mygEmbedBase({
        title: "Lobby introuvable",
        description: "Ce lobby n'existe plus.",
      }),
    );
    // On renvoie quand même 2 rows avec au moins 1 bouton pour respecter la contrainte Discord (1..5 composants)
    const dummy = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("DUMMY:1").setLabel("—").setStyle(ButtonStyle.Secondary).setDisabled(true),
    );
    return { embed, rows: [dummy, dummy] };
  }

  // --- Map titres actifs (discordId -> Title.name)
  const ids = lobby.participants.map((p) => p.discordId).filter((v): v is string => !!v);
  const profiles =
    ids.length > 0
      ? await prisma.userProfile.findMany({
          where: { discordId: { in: ids } },
          include: { activeTitle: true },
        })
      : [];
  const titleById = new Map<string, string>();
  for (const p of profiles) {
    if (p.discordId && p.activeTitle?.name) titleById.set(p.discordId, p.activeTitle.name);
  }
  const withTitle = (display: string, discordId: string | null) => {
    if (!discordId) return display;
    const t = titleById.get(discordId);
    return t ? `${display} [*${t}*]` : display;
  };

  const mode = (lobby as any).mode as "NORMAL" | "SURPRISE" | "BATTLE_ROYALE" | undefined;

  // ====== BATTLE ROYALE : liste plate, avec titres actifs ======
  if (mode === "BATTLE_ROYALE") {
    const names = lobby.participants
      .map((p) => withTitle(p.display, p.discordId ?? null))
      .sort((a, b) => a.localeCompare(b));

    const embed = new EmbedBuilder(
      mygEmbedBase({
        title: `Salle d'attente — ${lobby.name}`,
        description:
          (names.length ? names.map((n, i) => `**${i + 1}.** ${n}`).join("\n") : "_Aucun inscrit pour l’instant_") +
          "\n\n" +
          `**Règles :** ${BR_RULES}`,
        footer: {
          text: `Mode: BATTLE ROYALE • Inscriptions libres`,
        },
      }),
    );

    // Pour BR, pas de rôles. On fournit néanmoins 2 rows avec des boutons valides
    // (Quit/Test/Valider restent utiles pour la modération/flux).
    const rowA = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(lobbyQuitId(lobby.id)).setLabel("Quitter").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(lobbyTestId(lobby.id)).setLabel("Remplir test").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(lobbyValidateId(lobby.id)).setLabel("Valider").setStyle(ButtonStyle.Success),
    );
    // Row B “remplissage” pour respecter 1..5 composants par rangée (ici un bouton neutre désactivé)
    const rowB = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("BR:DUMMY").setLabel("—").setStyle(ButtonStyle.Secondary).setDisabled(true),
    );

    return { embed, rows: [rowA, rowB] };
  }

  // ====== NORMAL & SURPRISE : rendu par rôles (avec titres actifs) ======
  const byRole = (r: string) =>
    lobby.participants
      .filter((p) => p.role === r)
      .map((p) => withTitle(p.display, p.discordId ?? null));

  const fields = [
    { name: "Top", value: fmtList(byRole("TOP")), inline: true },
    { name: "Jgl", value: fmtList(byRole("JGL")), inline: true },
    { name: "Mid", value: fmtList(byRole("MID")), inline: true },
    { name: "Adc", value: fmtList(byRole("ADC")), inline: true },
    { name: "Supp", value: fmtList(byRole("SUPP")), inline: true },
    { name: "Sub", value: fmtList(byRole("SUB")), inline: true },
  ];

  // Règle surprise (si mode SURPRISE)
  let surpriseLine = "";
  if (mode === "SURPRISE") {
    const rule = SURPRISE_RULES[Math.floor(Math.random() * SURPRISE_RULES.length)];
    surpriseLine = `\n**Règle Surprise :** ${rule}`;
  }

  const embed = new EmbedBuilder(
    mygEmbedBase({
      title: `Salle d'attente — ${lobby.name} (${lobby.teams} équipe${lobby.teams > 1 ? "s" : ""})`,
      fields,
      footer: {
        text: `Statut: ${lobby.status} • ${mode ? `Mode: ${mode}` : "Mode: NORMAL"}`,
      },
      description: surpriseLine || undefined,
    }),
  );

  // === Boutons d'inscription par rôle (avec cap dynamique) ===
  // Cap par rôle (SUB illimité d’après roleCap)
  const currentCounts = new Map<string, number>();
  for (const r of ["TOP", "JGL", "MID", "ADC", "SUPP", "SUB"] as const) {
    currentCounts.set(
      r,
      lobby.participants.filter((p) => p.role === r).length,
    );
  }

  const mkJoin = (label: string, role: "TOP"|"JGL"|"MID"|"ADC"|"SUPP"|"SUB") => {
    const cap = roleCap(lobby.teams, role);
    const count = currentCounts.get(role) ?? 0;
    const disabled = count >= cap;
    return new ButtonBuilder()
      .setCustomId(lobbyJoinId(lobby.id, role))
      .setLabel(label)
      .setStyle(role === "SUB" ? ButtonStyle.Secondary : ButtonStyle.Primary)
      .setDisabled(disabled);
  };

  const rowRoles = new ActionRowBuilder<ButtonBuilder>().addComponents(
    mkJoin("Top", "TOP"),
    mkJoin("Jgl", "JGL"),
    mkJoin("Mid", "MID"),
    mkJoin("Adc", "ADC"),
    mkJoin("Supp", "SUPP"),
  );

  const rowActions = new ActionRowBuilder<ButtonBuilder>().addComponents(
    mkJoin("Sub", "SUB"),
    new ButtonBuilder().setCustomId(lobbyQuitId(lobby.id)).setLabel("Quitter").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(lobbyTestId(lobby.id)).setLabel("Remplir test").setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(lobbyValidateId(lobby.id)).setLabel("Valider").setStyle(ButtonStyle.Success),
  );

  // On renvoie exactement 2 rangées pour rester compatible avec create.ts (rows[0], rows[1])
  return { embed, rows: [rowRoles, rowActions] };
}
