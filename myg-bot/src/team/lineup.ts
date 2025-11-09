import { ChatInputCommandInteraction, EmbedBuilder, TextChannel } from "discord.js";
import { prisma } from "../prismat";
import { env } from "../env";
import { mygEmbedBase } from "../utils/embeds";

// Liste “Surprise” (fixée)
const SURPRISE_RULES = [
  "Only melee champs",
  "Only ranged champs",
  "Pas de chaussures",
  "Off-meta only",
  "Pas de ward (trinket jaune rouge bleu pinks interdit)",
  "Pas de dragons",
  "Tout le monde joue Ignite",
  "Aucun champ à dashs",
  "Pas le droit de recall avant 5min (droit de mourir)",
];

export async function sendLineup(inter: ChatInputCommandInteraction | { client: any }, lobbyId: string) {
  const lobby = await prisma.lobby.findUnique({
    where: { id: lobbyId },
    include: {
      teamsList: { include: { members: { include: { participant: true } } } },
      participants: true,
    },
  });
  if (!lobby) return;

  // 🎲 Surprise rule (non persistée)
  let surpriseRule: string | null = null;
  if (lobby.mode === "SURPRISE") {
    surpriseRule = SURPRISE_RULES[Math.floor(Math.random() * SURPRISE_RULES.length)];
  }

  // Profils (pour liens OP.GG) + titres actifs
  const profIds = lobby.participants.map((p) => p.discordId).filter((v): v is string => !!v);
  const profiles = await prisma.userProfile.findMany({
    where: { discordId: { in: profIds } },
    include: { activeTitle: true },
  });
  const profById = new Map(profiles.map((p) => [p.discordId, p]));
  const titleById = new Map<string, string>();
  for (const p of profiles) {
    if (p.discordId && p.activeTitle?.name) titleById.set(p.discordId, p.activeTitle.name);
  }

  // ✅ Effets armés : compter les Ban+1 non consommés par joueur
  const pending = await prisma.pendingEffect.groupBy({
    by: ["userId"],
    _count: { _all: true },
    where: {
      type: "BAN_PLUS_ONE",
      consumedAt: null,
      userId: { in: profIds },
    },
  });
  const pendingMap = new Map<string, number>(pending.map((p) => [p.userId, p._count._all]));

  const displayWithTitle = (display: string, discordId: string | null) => {
    if (!discordId) return display;
    const t = titleById.get(discordId);
    return t ? `${display} [*${t}*]` : display;
  };

  // Helpers
  const fmtUser = (part: { discordId: string | null; display: string }) => {
    const id = part.discordId ?? "";
    const prof = id ? profById.get(id) : undefined;

    const count = id ? pendingMap.get(id) ?? 0 : 0;
    const suffix = count > 0 ? ` (Ban+${Math.min(count, 3)})` : "";

    const base = displayWithTitle(part.display + suffix, id || null);

    if (prof?.opggUrl) {
      // 🔗 le lien ne couvre QUE le pseudo — le titre reste hors du lien
      const title = id ? titleById.get(id) : undefined;
      const plainName = part.display + suffix;
      const linked = `[${plainName}](${prof.opggUrl})`;
      return title ? `${linked} [*${title}*]` : linked;
    }

    return base;
  };

  const fmtTeam = (t: typeof lobby.teamsList[number]) => {
    const get = (r: "TOP" | "JGL" | "MID" | "ADC" | "SUPP") => {
      const m = t.members.find((m) => m.participant.role === r)?.participant;
      return m ? fmtUser(m) : "—";
    };
    const cap = t.captainId
      ? t.members.find((m) => m.lobbyParticipantId === t.captainId)?.participant.display
      : undefined;
    return `**${t.name}**${cap ? ` (👑 ${cap})` : ""}
Top: ${get("TOP")}
Jgl: ${get("JGL")}
Mid: ${get("MID")}
Adc: ${get("ADC")}
Supp: ${get("SUPP")}`;
  };

  // 🧾 Embed line-up
  const embed = new EmbedBuilder(
    mygEmbedBase({
      title: `Line-up — ${lobby.name}`,
      description: lobby.teamsList.map(fmtTeam).join("\n\n"),
      footer: { text: "Bonne chance & have fun !" },
    }),
  );

  if (lobby.mode === "SURPRISE" && surpriseRule) {
    embed.addFields({ name: "⚠️ Règle spéciale", value: surpriseRule });
  }

  // Envoi dans le salon LINEUP défini par l'env
  const ch = await (inter as any).client.channels.fetch(env.LINEUP_CHANNEL_ID).catch(() => null);
  if (ch && (ch as any).isTextBased?.()) {
    await (ch as TextChannel).send({ embeds: [embed] });
  }

  // ✅ Consommer automatiquement TOUS les Ban+1 armés des joueurs inscrits (pour ce lobby)
  if (lobby.mode === "NORMAL" || lobby.mode === "SURPRISE") {
    await prisma.pendingEffect.updateMany({
      where: {
        type: "BAN_PLUS_ONE",
        consumedAt: null,
        userId: { in: profIds },
      },
      data: { consumedAt: new Date() },
    });
  }
}
