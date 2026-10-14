import {
  REVEAL_DELAY_MS,
  continuePlay,
  judge,
  reveal,
  selectClue,
  skipAnswer,
  submitAnswer,
  submitWager,
} from './play.js';

function send(socket, message) {
  if (socket.readyState === 1) socket.send(JSON.stringify(message));
}

const countdownTimers = new WeakMap();

function scheduleReveal(store, session) {
  const existing = countdownTimers.get(session);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    countdownTimers.delete(session);
    if (!reveal(session)) return;
    store.broadcast(session);
  }, REVEAL_DELAY_MS);
  countdownTimers.set(session, timer);
}

function playAction(store, socket, run) {
  const current = store.playerForSocket(socket);
  if (!current) {
    send(socket, { type: 'error', message: 'Join a game before playing.' });
    return;
  }

  const result = run(current.session, current.playerId);
  if (!result.ok) {
    send(socket, { type: 'error', message: result.error });
    return;
  }
  if (result.startCountdown) scheduleReveal(store, current.session);
  store.broadcast(current.session);
}

const INVALID_URL = 'Enter a full j-archive.com game URL, like https://j-archive.com/showgame.php?game_id=8491';

export async function handleMessage(store, loadGame, log, socket, raw) {
  let message;
  try {
    message = JSON.parse(raw);
  } catch {
    return;
  }
  if (!message || typeof message !== 'object') return;

  if (message.type === 'create') {
    if (typeof message.url !== 'string') {
      send(socket, { type: 'error', message: INVALID_URL });
      return;
    }

    const loaded = await loadGame(message.url);
    if (!loaded.ok) {
      send(socket, { type: 'error', message: loaded.error });
      return;
    }

    const { session, player } = store.createSession(loaded.game);
    store.detachSocket(socket);
    store.attach(session, player.id, socket);
    log(`Created game session ${session.id} for archive game ${loaded.game.id}`);
    log(JSON.stringify(loaded.game, null, 2));
    store.broadcast(session);
    return;
  }

  if (message.type === 'join') {
    if (typeof message.sessionId !== 'string' || message.sessionId.trim() === '') {
      send(socket, { type: 'error', message: 'Enter an invitation code.' });
      return;
    }

    const result = store.join(
      message.sessionId,
      typeof message.playerId === 'string' ? message.playerId : undefined,
    );
    if (!result.ok) {
      send(socket, { type: 'error', message: result.error });
      return;
    }

    store.detachSocket(socket);
    store.attach(result.session, result.player.id, socket);
    store.broadcast(result.session);
    return;
  }

  if (message.type === 'resume') {
    if (typeof message.sessionId !== 'string' || typeof message.playerId !== 'string') {
      send(socket, { type: 'lobby' });
      return;
    }

    const result = store.resume(message.sessionId, message.playerId);
    if (!result.ok) {
      send(socket, { type: 'lobby' });
      return;
    }

    store.detachSocket(socket);
    store.attach(result.session, result.player.id, socket);
    store.broadcast(result.session);
    return;
  }

  if (message.type === 'leave') {
    const current = store.playerForSocket(socket);
    if (!current) {
      send(socket, { type: 'lobby' });
      return;
    }

    const result = store.leave(current.session, current.playerId);
    store.detachSocket(socket);
    send(socket, { type: 'lobby', sessionId: current.session.id, playerId: current.playerId });
    if (!result.ok) return;
    if (result.startCountdown) scheduleReveal(store, current.session);
    store.broadcast(current.session);
    return;
  }

  if (message.type === 'select') {
    playAction(store, socket, (session, playerId) => selectClue(session, playerId, message.column, message.row));
    return;
  }
  if (message.type === 'wager') {
    playAction(store, socket, (session, playerId) => submitWager(session, playerId, message.amount));
    return;
  }
  if (message.type === 'answer') {
    playAction(store, socket, (session, playerId) => submitAnswer(session, playerId, message.text));
    return;
  }
  if (message.type === 'skip') {
    playAction(store, socket, (session, playerId) => skipAnswer(session, playerId));
    return;
  }
  if (message.type === 'judge') {
    playAction(store, socket, (session, playerId) => judge(session, playerId, message.correct));
    return;
  }
  if (message.type === 'continue') {
    playAction(store, socket, (session, playerId) => continuePlay(session, playerId));
  }
}
