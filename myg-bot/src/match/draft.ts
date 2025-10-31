// src/match/draft.ts

/**
 * Génère des liens LoLProDraft valides (sans Playwright).
 * Format attendu :
 *   base = https://lolprodraft.com/draft/<ROOM_ID>
 *   query = ?ROOM_ID=<...>&blueName=<...>&redName=<...>
 *   blue = <base>/blue<query>
 *   red  = <base>/red<query>
 *   spec = <base><query>
 *   stream = <base>/stream<query>   (non utilisé dans le flux actuel, dispo au besoin)
 */

type DraftLinks = {
  roomId: string;
  blueUrl: string;
  redUrl: string;
  specUrl: string;
  streamUrl: string;
};

function generateRoomId(): string {
  // ID court et lisible (évite 0/O, 1/l, etc.)
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let id = "";
  for (let i = 0; i < 8; i++) {
    id += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return id;
}

export async function createDraftRoom(
  teamAName: string,
  teamBName: string
): Promise<{
  roomId: string;
  blueUrl: string;
  redUrl: string;
  specUrl: string;
}> {
  const ROOM_ID = generateRoomId();

  const enc = encodeURIComponent;
  const base = `https://lolprodraft.com/draft/${ROOM_ID}`;
  const query = `?ROOM_ID=${ROOM_ID}&blueName=${enc(teamAName)}&redName=${enc(teamBName)}`;

  const links: DraftLinks = {
    roomId: ROOM_ID,
    blueUrl: `${base}/blue${query}`,
    redUrl: `${base}/red${query}`,
    specUrl: `${base}${query}`,
    streamUrl: `${base}/stream${query}`,
  };

  // On ne retourne que ce qui est consommé par le flux actuel
  return {
    roomId: links.roomId,
    blueUrl: links.blueUrl,
    redUrl: links.redUrl,
    specUrl: links.specUrl,
  };
}
