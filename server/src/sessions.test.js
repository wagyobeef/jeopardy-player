import assert from 'node:assert/strict';
import test from 'node:test';
import { createStore } from './sessions.js';

const game = {
  id: '8491',
  title: 'Show #890',
  boards: [],
  finalJeopardy: { category: 'CINEMA', question: 'Question', answer: 'UNIQUE_ANSWER_TOKEN' },
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

test('a joined player resumes the same score', () => {
  const store = createStore();
  const { session } = store.createSession(game);
  const joined = store.join(session.id);
  joined.player.score = 500;

  const resumed = store.join(session.id.toLowerCase(), joined.player.id);
  assert.equal(resumed.ok, true);
  assert.equal(resumed.player.id, joined.player.id);
  assert.equal(resumed.player.score, 500);
  assert.equal(session.players.length, 2);
});

test('leaving keeps a player score for the same invitation code', () => {
  const store = createStore();
  const { session, player } = store.createSession(game);
  player.score = 250;
  const left = store.leave(session, player.id);

  assert.equal(left.ok, true);
  assert.equal(session.players.length, 0);
  assert.equal(session.departed[0].score, 250);

  const returned = store.join(session.id, player.id);
  assert.equal(returned.ok, true);
  assert.equal(returned.player.id, player.id);
  assert.equal(returned.player.score, 250);
  assert.equal(session.players.length, 1);
  assert.equal(session.departed.length, 0);

  const stranger = store.join(session.id);
  assert.notEqual(stranger.player.id, player.id);
  assert.equal(stranger.player.score, 0);
});

test('resume does not create a player when the id is unknown', () => {
  const store = createStore();
  const { session } = store.createSession(game);
  const result = store.resume(session.id, 'missing-player');
  assert.equal(result.ok, false);
  assert.equal(session.players.length, 1);
});

test('a new session shows the board without answers', () => {
  const store = createStore();
  const { session, player } = store.createSession(game);
  const socket = fakeSocket();
  store.attach(session, player.id, socket);
  store.broadcast(session);

  const message = socket.sent[0];
  assert.equal(message.type, 'session');
  assert.equal(message.sessionId, session.id);
  assert.equal(message.playerId, player.id);
  assert.equal(message.title, 'Show #890');
  assert.equal(message.phase, 'board');
  assert.equal(message.players[0].score, 0);
  assert.equal(message.players[0].isYou, true);
  assert.equal(JSON.stringify(message).includes('UNIQUE_ANSWER_TOKEN'), false);

  store.detachSocket(socket);
  store.broadcast(session);
  assert.equal(socket.sent.length, 1);
});
