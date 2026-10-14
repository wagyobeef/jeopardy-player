import crypto from 'node:crypto';
import { addPlayer, createPlay, present } from './play.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function createCode() {
  let code = '';
  for (let index = 0; index < 6; index += 1) {
    code += ALPHABET[crypto.randomInt(ALPHABET.length)];
  }
  return code;
}

function createPlayer() {
  return { id: crypto.randomUUID(), score: 0 };
}

function normalizeCode(value) {
  return String(value ?? '').trim().toUpperCase();
}

export function createStore() {
  const sessions = new Map();

  function findSession(sessionId) {
    return sessions.get(normalizeCode(sessionId)) ?? null;
  }

  return {
    createSession(game) {
      let id = createCode();
      while (sessions.has(id)) id = createCode();
      const player = createPlayer();
      const session = { id, game, players: [player], sockets: new Map(), play: null };
      session.play = createPlay(session.players);
      sessions.set(id, session);
      return { session, player };
    },

    join(sessionId, playerId) {
      const session = findSession(sessionId);
      if (!session) return { ok: false, error: 'No game found for that invitation code.' };

      const existing = typeof playerId === 'string'
        ? session.players.find((player) => player.id === playerId)
        : undefined;
      if (existing) return { ok: true, session, player: existing };

      const player = createPlayer();
      session.players.push(player);
      addPlayer(session, player.id);
      return { ok: true, session, player };
    },

    resume(sessionId, playerId) {
      const session = findSession(sessionId);
      const player = session?.players.find((candidate) => candidate.id === playerId);
      if (!session || !player) return { ok: false };
      return { ok: true, session, player };
    },

    attach(session, playerId, socket) {
      session.sockets.set(playerId, socket);
    },

    detachSocket(socket) {
      for (const session of sessions.values()) {
        for (const [playerId, current] of session.sockets) {
          if (current === socket) session.sockets.delete(playerId);
        }
      }
    },

    playerForSocket(socket) {
      for (const session of sessions.values()) {
        for (const [playerId, current] of session.sockets) {
          if (current === socket) return { session, playerId };
        }
      }
      return null;
    },

    broadcast(session) {
      for (const [playerId, socket] of session.sockets) {
        if (socket.readyState === 1) {
          socket.send(JSON.stringify(present(session, playerId)));
        }
      }
    },
  };
}
