import crypto from 'node:crypto';
import { addPlayer, createPlay, leavePlay, present, restorePlayer } from './play.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function createCode() {
  let code = '';
  for (let index = 0; index < 6; index += 1) {
    code += ALPHABET[crypto.randomInt(ALPHABET.length)];
  }
  return code;
}

function createPlayer(name) {
  return { id: crypto.randomUUID(), score: 0, name };
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
    createSession(game, name) {
      let id = createCode();
      while (sessions.has(id)) id = createCode();
      const player = createPlayer(name);
      const session = { id, game, players: [player], departed: [], sockets: new Map(), play: null };
      session.play = createPlay(session.players);
      sessions.set(id, session);
      return { session, player };
    },

    join(sessionId, playerId, name) {
      const session = findSession(sessionId);
      if (!session) return { ok: false, error: 'No game found for that invitation code.' };

      const existing = typeof playerId === 'string'
        ? session.players.find((player) => player.id === playerId)
        : undefined;
      if (existing) {
        if (name) existing.name = name;
        return { ok: true, session, player: existing };
      }

      const departedIndex = typeof playerId === 'string'
        ? session.departed.findIndex((player) => player.id === playerId)
        : -1;
      if (departedIndex !== -1) {
        const [player] = session.departed.splice(departedIndex, 1);
        if (name) player.name = name;
        session.players.push(player);
        restorePlayer(session, player);
        return { ok: true, session, player };
      }

      const player = createPlayer(name);
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

    leave(session, playerId) {
      return leavePlay(session, playerId);
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
