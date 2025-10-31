import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) console.warn("[MYG] DATABASE_URL manquant — les API renverront des stubs.");

export const sql = url
  ? postgres(url, { max: 1, ssl: "require" })
  : null;
