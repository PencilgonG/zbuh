import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

export const log = pino({
  level: "info",
  ...(isDev
    ? { transport: { target: "pino-pretty" } }
    : {}), // en prod: sortie JSON standard (pas de pretty)
});
