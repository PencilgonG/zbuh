/**
 * Génère des liens LoLProDraft valides (sans Playwright).
 * Format attendu :
 *   base = https://lolprodraft.com/draft/<ROOM_ID>
 *   query = ?ROOM_ID=<...>&blueName=<...>&redName=<...>
 *   blue = <base>/blue<query>
 *   red  = <base>/red<query>
 *   spec = <base><query>
 *   stream = <base>/stream<query>   (non utilisé actuellement)
 */

type DraftLinks = {
  roomId: string;
  blueUrl: string;
  redUrl: string;
  specUrl: string;
  streamUrl: string;
};

function generateRoomId(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let id = "";
  for (let i = 0; i < 8; i++) {
    id += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return id;
}

/**
 * @param swap Si true, on inverse les sides (= A en RED, B en BLUE)
 */
export async function createDraftRoom(
  teamAName: string,
  teamBName: string,
  swap: boolean = false
): Promise<{
  roomId: string;
  blueUrl: string;
  redUrl: string;
  specUrl: string;
}> {
  const ROOM_ID = generateRoomId();

  const blueName = swap ? teamBName : teamAName;
  const redName  = swap ? teamAName : teamBName;

  const enc = encodeURIComponent;
  const base = `https://lolprodraft.com/draft/${ROOM_ID}`;
  const query = `?ROOM_ID=${ROOM_ID}&blueName=${enc(blueName)}&redName=${enc(redName)}`;

  const links: DraftLinks = {
    roomId: ROOM_ID,
    blueUrl: `${base}/blue${query}`,
    redUrl: `${base}/red${query}`,
    specUrl: `${base}${query}`,
    streamUrl: `${base}/stream${query}`,
  };

  return {
    roomId: links.roomId,
    blueUrl: links.blueUrl,
    redUrl: links.redUrl,
    specUrl: links.specUrl,
  };
}
