import { APIEmbed } from "discord.js";
import { env } from "../env";

export function mygEmbedBase(partial: APIEmbed = {}): APIEmbed {
  return {
    color: 0xd4af37,
    author: partial.author,
    title: partial.title,
    description: partial.description,
    fields: partial.fields,
    thumbnail: partial.thumbnail,
    footer: partial.footer ?? { text: "MYG Inhouses" },
    image: { url: env.BANNER_URL },
  };
}
