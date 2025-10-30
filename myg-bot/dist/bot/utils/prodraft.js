// src/bot/utils/prodraft.ts
// Génération des liens LoLProDraft (reprend la logique de ton ZIP)
function generateRoomId() {
    // court et lisible : même approche que dans le zip
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    let id = "";
    for (let i = 0; i < 8; i++)
        id += alphabet[Math.floor(Math.random() * alphabet.length)];
    return id;
}
/**
 * Crée des liens LoLProDraft valides sans Playwright.
 * base = https://lolprodraft.com/draft/<ROOM_ID>
 * query = ?ROOM_ID=<...>&blueName=<...>&redName=<...>
 */
export function createDraftLinks(blueName, redName) {
    const ROOM_ID = generateRoomId();
    const enc = encodeURIComponent;
    const q = `?ROOM_ID=${ROOM_ID}&blueName=${enc(blueName)}&redName=${enc(redName)}`;
    const base = `https://lolprodraft.com/draft/${ROOM_ID}`;
    return {
        blue: `${base}/blue${q}`,
        red: `${base}/red${q}`,
        spec: `${base}${q}`,
        stream: `${base}/stream${q}`,
    };
}
