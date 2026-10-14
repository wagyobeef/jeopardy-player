import { parseArchiveUrl } from './archiveUrl.js';
import { parseGame } from './parseGame.js';

const MAX_HTML_BYTES = 2_000_000;
const INVALID_URL = 'Enter a full j-archive.com game URL, like https://j-archive.com/showgame.php?game_id=8491';
const UNUSABLE_PAGE = 'That page did not contain a usable Jeopardy game.';
const LOAD_FAILED = 'The game page could not be loaded.';

export async function loadGame(input, fetchImpl = globalThis.fetch) {
  const archiveUrl = parseArchiveUrl(input);
  if (!archiveUrl) return { ok: false, error: INVALID_URL };

  let response;
  try {
    response = await fetchImpl(archiveUrl.fetchUrl, {
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
      headers: {
        Accept: 'text/html',
        'User-Agent': 'jeopardy-player/0.1',
      },
    });
  } catch {
    return { ok: false, error: LOAD_FAILED };
  }

  if (!response.ok) return { ok: false, error: LOAD_FAILED };

  let finalHost = '';
  try {
    finalHost = new URL(response.url).hostname.toLowerCase();
  } catch {
    return { ok: false, error: LOAD_FAILED };
  }
  if (finalHost !== 'j-archive.com' && finalHost !== 'www.j-archive.com') {
    return { ok: false, error: LOAD_FAILED };
  }

  const html = await response.text();
  if (html.length > MAX_HTML_BYTES) return { ok: false, error: UNUSABLE_PAGE };

  const game = parseGame(html, archiveUrl.gameId);
  if (!game) return { ok: false, error: UNUSABLE_PAGE };
  return { ok: true, game };
}
