import assert from 'node:assert/strict';
import test from 'node:test';
import { handleMessage } from './handleMessage.js';
import { createStore } from './sessions.js';

const game = {
  id: '8491',
  title: 'Show #890',
  boards: [{
    name: 'Jeopardy',
    categories: ['A', 'B', 'C', 'D', 'E', 'F'],
    clues: [{
      column: 1,
      row: 1,
      category: 'A',
      value: 200,
      question: 'Clue text',
      answer: 'SECRET_ANSWER',
      dailyDouble: false,
    }],
  }],
  finalJeopardy: { category: 'CINEMA', question: 'Final question', answer: 'SECRET_ANSWER' },
};

function fakeSocket() {
  return {
    readyState: 1,
    sent: [],
    send(data) {
      this.sent.push(JSON.parse(data));
    },
  };
}

test('creating a session logs the parsed game and sends it to the client', async () => {
  const store = createStore();
  const logs = [];
  const socket = fakeSocket();

  await handleMessage(
    store,
    async () => ({ ok: true, game }),
    (line) => logs.push(line),
    socket,
    JSON.stringify({ type: 'create', url: 'https://j-archive.com/showgame.php?game_id=8491' }),
  );

  assert.equal(logs.length, 2);
  assert.match(logs[0], /^Created game session [A-Z0-9]{6} for archive game 8491$/);
  assert.equal(JSON.parse(logs[1]).finalJeopardy.answer, 'SECRET_ANSWER');
  assert.equal(socket.sent[0].type, 'session');
  assert.equal(socket.sent[0].phase, 'board');
  assert.equal(JSON.stringify(socket.sent[0]).includes('SECRET_ANSWER'), false);
  assert.equal(socket.sent[0].cells.find((cell) => cell.column === 1 && cell.row === 1).value, 200);
});

test('an unknown invitation code returns an error', async () => {
  const socket = fakeSocket();
  await handleMessage(
    createStore(),
    async () => ({ ok: false, error: 'unused' }),
    () => {},
    socket,
    JSON.stringify({ type: 'join', sessionId: 'ZZZZZZ' }),
  );

  assert.deepEqual(socket.sent[0], {
    type: 'error',
    message: 'No game found for that invitation code.',
  });
});

test('a failed resume tells the client to show the lobby', async () => {
  const socket = fakeSocket();
  await handleMessage(
    createStore(),
    async () => ({ ok: false, error: 'unused' }),
    () => {},
    socket,
    JSON.stringify({ type: 'resume', sessionId: 'ZZZZZZ', playerId: 'missing' }),
  );

  assert.deepEqual(socket.sent[0], { type: 'lobby' });
});
