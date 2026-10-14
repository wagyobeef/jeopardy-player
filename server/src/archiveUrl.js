const HOSTS = new Set(['j-archive.com', 'www.j-archive.com']);

export function parseArchiveUrl(input) {
  if (typeof input !== 'string' || input.length > 500) return null;

  let url;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (!HOSTS.has(url.hostname.toLowerCase())) return null;
  if (!/^\/showgame\.php\/?$/.test(url.pathname)) return null;

  const gameId = url.searchParams.get('game_id');
  if (!gameId || !/^[1-9]\d{0,9}$/.test(gameId)) return null;

  return {
    gameId,
    fetchUrl: `https://j-archive.com/showgame.php?game_id=${gameId}`,
  };
}
