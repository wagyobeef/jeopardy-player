import assert from 'node:assert/strict';
import test from 'node:test';
import { parseArchiveUrl } from './archiveUrl.js';

test('accepts a j-archive show URL and canonicalizes it', () => {
  const parsed = parseArchiveUrl('http://www.j-archive.com/showgame.php?game_id=8491');
  assert.deepEqual(parsed, {
    gameId: '8491',
    fetchUrl: 'https://j-archive.com/showgame.php?game_id=8491',
  });
});

test('rejects URLs that are not a single archived game', () => {
  assert.equal(parseArchiveUrl('https://example.com/showgame.php?game_id=8491'), null);
  assert.equal(parseArchiveUrl('https://j-archive.com/showseason.php?season=39'), null);
  assert.equal(parseArchiveUrl('https://j-archive.com/showgame.php?game_id=0'), null);
  assert.equal(parseArchiveUrl('https://j-archive.com/showgame.php?game_id=abc'), null);
  assert.equal(parseArchiveUrl('not a url'), null);
});
