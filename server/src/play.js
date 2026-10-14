import crypto from 'node:crypto';

const WAITING = 'Waiting for player...';
const SUBMITTED = 'Submitted';

function clueKey(roundIndex, column, row) {
  return `${roundIndex}:${column}:${row}`;
}

function currentBoard(session) {
  return session.game.boards[session.play.roundIndex] ?? null;
}

function findClue(session, column, row) {
  return currentBoard(session)?.clues.find((clue) => clue.column === column && clue.row === row) ?? null;
}

function activeClue(session) {
  const position = session.play.clue;
  if (!position) return null;
  return findClue(session, position.column, position.row);
}

function responseFor(play, playerId) {
  return play.responses[playerId] ?? null;
}

function allAnswered(play) {
  return play.turnPlayerIds.every((playerId) => {
    const response = responseFor(play, playerId);
    return Boolean(response && (response.skipped || response.answer));
  });
}

function allJudged(play) {
  return play.turnPlayerIds.every((playerId) => {
    const response = responseFor(play, playerId);
    return Boolean(response?.skipped || typeof response?.correct === 'boolean');
  });
}

function continueIds(session) {
  if (session.play.phase === 'summary') return session.players.map((player) => player.id);
  return session.play.turnPlayerIds;
}

function allContinued(session) {
  return continueIds(session).every((playerId) => session.play.pendingContinue.includes(playerId));
}

function formatDelta(amount) {
  if (amount < 0 || Object.is(amount, -0)) return `-${Math.abs(amount)}`;
  return `+${amount}`;
}

function remainingClues(session) {
  const board = currentBoard(session);
  if (!board) return [];
  return board.clues.filter((clue) => !session.play.played.includes(clueKey(session.play.roundIndex, clue.column, clue.row)));
}

function clearTurn(play) {
  play.clue = null;
  play.responses = {};
  play.pendingContinue = [];
  play.deltas = {};
  play.revealAt = null;
}

export function createPlay(players, randomInt = crypto.randomInt) {
  return {
    roundIndex: 0,
    phase: 'board',
    selectorId: players[randomInt(players.length)].id,
    turnPlayerIds: players.map((player) => player.id),
    clue: null,
    responses: {},
    played: [],
    correctThisRound: Object.fromEntries(players.map((player) => [player.id, 0])),
    pendingContinue: [],
    deltas: {},
    revealAt: null,
  };
}

export function addPlayer(session, playerId) {
  if (session.play.correctThisRound[playerId] == null) {
    session.play.correctThisRound[playerId] = 0;
  }
}

export function restorePlayer(session, player) {
  addPlayer(session, player.id);
  const ids = session.players.map((candidate) => candidate.id);
  if (!ids.includes(session.play.selectorId)) session.play.selectorId = player.id;
  if (session.play.phase === 'board') {
    session.play.turnPlayerIds = ids;
    return;
  }
  if (session.play.turnPlayerIds.length === 0 && session.play.phase !== 'summary' && session.play.phase !== 'complete') {
    session.play.turnPlayerIds = [player.id];
  }
}

export function leavePlay(session, playerId, randomInt = crypto.randomInt, now = Date.now()) {
  const play = session.play;
  const index = session.players.findIndex((player) => player.id === playerId);
  if (index === -1) return { ok: false, error: 'That action is not available right now.' };

  const [player] = session.players.splice(index, 1);
  if (!session.departed) session.departed = [];
  session.departed.push(player);
  play.turnPlayerIds = play.turnPlayerIds.filter((id) => id !== playerId);
  play.pendingContinue = play.pendingContinue.filter((id) => id !== playerId);
  delete play.responses[playerId];
  delete play.deltas[playerId];

  if (session.players.length === 0) return { ok: true };

  if (play.phase === 'board' && play.selectorId === playerId) {
    play.selectorId = session.players[randomInt(session.players.length)].id;
  }

  if (play.phase === 'wager' && play.turnPlayerIds.every((id) => responseFor(play, id)?.wager != null)) {
    play.phase = 'question';
  }

  let startCountdown = false;
  if (play.phase === 'question' && allAnswered(play)) {
    startCountdown = Boolean(finishAnswers(play, now).startCountdown);
  }
  if (play.phase === 'reveal' && allJudged(play)) applyScores(session);
  if ((play.phase === 'scored' || play.phase === 'summary') && allContinued(session)) {
    continuePlay(session, session.players[0].id, randomInt);
  }

  return { ok: true, startCountdown };
}

export function selectClue(session, playerId, column, row) {
  const play = session.play;
  if (play.phase !== 'board') return { ok: false, error: 'That action is not available right now.' };
  if (playerId !== play.selectorId) return { ok: false, error: 'Wait for your turn to choose a question.' };
  if (!Number.isInteger(column) || !Number.isInteger(row)) {
    return { ok: false, error: 'That question is not available.' };
  }

  const clue = findClue(session, column, row);
  const key = clueKey(play.roundIndex, column, row);
  if (!clue || play.played.includes(key)) return { ok: false, error: 'That question is not available.' };

  play.clue = { column, row };
  play.turnPlayerIds = session.players.map((player) => player.id);
  play.responses = {};
  play.pendingContinue = [];
  play.deltas = {};
  play.phase = clue.dailyDouble ? 'wager' : 'question';
  return { ok: true };
}

export function submitWager(session, playerId, amount) {
  const play = session.play;
  if (play.phase !== 'wager' || !play.turnPlayerIds.includes(playerId)) {
    return { ok: false, error: 'That action is not available right now.' };
  }

  const clue = activeClue(session);
  const max = clue.value * 2;
  if (!Number.isInteger(amount) || amount < 0 || amount > max) {
    return { ok: false, error: `Enter a whole number from 0 to ${max}.` };
  }
  if (responseFor(play, playerId)?.wager != null) return { ok: true };

  play.responses[playerId] = {
    wager: amount,
    answer: null,
    skipped: false,
    correct: null,
  };
  if (play.turnPlayerIds.every((id) => responseFor(play, id)?.wager != null)) {
    play.phase = 'question';
  }
  return { ok: true };
}

export const REVEAL_DELAY_MS = 1000;

function finishAnswers(play, now) {
  if (!allAnswered(play)) return { ok: true };
  play.phase = 'countdown';
  play.revealAt = now + REVEAL_DELAY_MS;
  return { ok: true, startCountdown: true };
}

export function submitAnswer(session, playerId, text, now = Date.now()) {
  const play = session.play;
  if (play.phase !== 'question' || !play.turnPlayerIds.includes(playerId)) {
    return { ok: false, error: 'That action is not available right now.' };
  }

  const response = responseFor(play, playerId);
  if (response?.skipped || response?.answer) return { ok: true };

  const answer = typeof text === 'string' ? text.trim() : '';
  if (!answer) return { ok: false, error: 'Enter an answer, or skip.' };

  play.responses[playerId] = {
    wager: response?.wager ?? null,
    answer,
    skipped: false,
    correct: null,
  };
  return finishAnswers(play, now);
}

export function skipAnswer(session, playerId, now = Date.now()) {
  const play = session.play;
  if (play.phase !== 'question' || !play.turnPlayerIds.includes(playerId)) {
    return { ok: false, error: 'That action is not available right now.' };
  }

  const response = responseFor(play, playerId);
  if (response?.skipped || response?.answer) return { ok: true };

  play.responses[playerId] = {
    wager: response?.wager ?? null,
    answer: null,
    skipped: true,
    correct: null,
  };
  return finishAnswers(play, now);
}

function applyScores(session) {
  const play = session.play;
  const clue = activeClue(session);
  play.deltas = {};

  for (const playerId of play.turnPlayerIds) {
    const response = responseFor(play, playerId);
    const player = session.players.find((candidate) => candidate.id === playerId);
    if (!player || !response) continue;

    let delta = null;
    if (clue.dailyDouble) {
      delta = response.correct === true ? response.wager : -response.wager;
    } else if (response.correct === true) {
      delta = clue.value;
    }

    if (delta != null) {
      player.score += delta;
      play.deltas[playerId] = delta;
    }
    if (response.correct === true) {
      play.correctThisRound[playerId] = (play.correctThisRound[playerId] ?? 0) + 1;
    }
  }

  play.phase = 'scored';
  play.pendingContinue = [];
}

export function reveal(session) {
  const play = session.play;
  if (play.phase !== 'countdown') return false;
  play.phase = 'reveal';
  play.revealAt = null;
  if (allJudged(play)) applyScores(session);
  return true;
}

export function judge(session, playerId, correct) {
  const play = session.play;
  if (play.phase !== 'reveal' || !play.turnPlayerIds.includes(playerId)) {
    return { ok: false, error: 'That action is not available right now.' };
  }

  const response = responseFor(play, playerId);
  if (!response || response.skipped) return { ok: false, error: 'That action is not available right now.' };
  if (typeof correct !== 'boolean') return { ok: false, error: 'That action is not available right now.' };
  if (typeof response.correct === 'boolean') return { ok: true };

  response.correct = correct;
  if (allJudged(play)) applyScores(session);
  return { ok: true };
}

function nextSelector(session, randomInt) {
  const play = session.play;
  const active = new Set(session.players.map((player) => player.id));
  const selectorResponse = responseFor(play, play.selectorId);
  if (selectorResponse?.correct === true && active.has(play.selectorId)) return play.selectorId;

  const correctIds = play.turnPlayerIds.filter((playerId) => (
    active.has(playerId) && responseFor(play, playerId)?.correct === true
  ));
  if (correctIds.length > 0) return correctIds[randomInt(correctIds.length)];
  if (active.has(play.selectorId)) return play.selectorId;
  const remaining = [...active];
  return remaining[randomInt(remaining.length)];
}

function lowestSelector(session, randomInt) {
  const lowest = Math.min(...session.players.map((player) => player.score));
  const tied = session.players.filter((player) => player.score === lowest);
  return tied[randomInt(tied.length)].id;
}

function startDoubleJeopardy(session, randomInt) {
  const play = session.play;
  play.roundIndex = 1;
  play.correctThisRound = Object.fromEntries(session.players.map((player) => [player.id, 0]));
  clearTurn(play);
  play.phase = 'board';
  play.selectorId = lowestSelector(session, randomInt);
  play.turnPlayerIds = session.players.map((player) => player.id);
}

export function continuePlay(session, playerId, randomInt = crypto.randomInt) {
  const play = session.play;
  if (play.phase !== 'scored' && play.phase !== 'summary') {
    return { ok: false, error: 'That action is not available right now.' };
  }
  if (!continueIds(session).includes(playerId)) return { ok: true };
  if (!play.pendingContinue.includes(playerId)) play.pendingContinue.push(playerId);
  if (!allContinued(session)) return { ok: true };

  if (play.phase === 'summary') {
    if (play.roundIndex === 0) startDoubleJeopardy(session, randomInt);
    else play.phase = 'complete';
    return { ok: true };
  }

  play.played.push(clueKey(play.roundIndex, play.clue.column, play.clue.row));
  if (remainingClues(session).length > 0) {
    const selectorId = nextSelector(session, randomInt);
    clearTurn(play);
    play.phase = 'board';
    play.selectorId = selectorId;
    play.turnPlayerIds = session.players.map((player) => player.id);
    return { ok: true };
  }

  clearTurn(play);
  play.phase = 'summary';
  return { ok: true };
}

function playerStatus(session, playerId) {
  const play = session.play;
  const response = responseFor(play, playerId);
  const inTurn = play.turnPlayerIds.includes(playerId);

  if (play.phase === 'board') return playerId === play.selectorId ? WAITING : null;
  if (play.phase === 'wager') {
    if (!inTurn) return null;
    return response?.wager == null ? WAITING : null;
  }
  if (play.phase === 'question' || play.phase === 'countdown') {
    if (!inTurn) return null;
    return response?.answer || response?.skipped ? SUBMITTED : WAITING;
  }
  if (play.phase === 'reveal') {
    if (!inTurn || response?.skipped) return null;
    return typeof response?.correct === 'boolean' ? null : WAITING;
  }
  if (play.phase === 'scored') {
    if (!inTurn) return null;
    return play.pendingContinue.includes(playerId) ? null : WAITING;
  }
  if (play.phase === 'summary') return play.pendingContinue.includes(playerId) ? null : WAITING;
  return null;
}

function yourAction(session, playerId) {
  const play = session.play;
  const response = responseFor(play, playerId);
  if (play.phase === 'board' && playerId === play.selectorId) return 'select';
  if (play.phase === 'wager' && play.turnPlayerIds.includes(playerId) && response?.wager == null) return 'wager';
  if (play.phase === 'question' && play.turnPlayerIds.includes(playerId) && !response?.answer && !response?.skipped) {
    return 'answer';
  }
  if (play.phase === 'reveal' && play.turnPlayerIds.includes(playerId) && response && !response.skipped && typeof response.correct !== 'boolean') {
    return 'judge';
  }
  if ((play.phase === 'scored' && play.turnPlayerIds.includes(playerId) && !play.pendingContinue.includes(playerId))
    || (play.phase === 'summary' && !play.pendingContinue.includes(playerId))) {
    return 'continue';
  }
  return null;
}

function ranks(players) {
  const sorted = [...players].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const rankById = new Map();
  let rank = 0;
  let previous = null;
  sorted.forEach((player, index) => {
    if (player.score !== previous) rank = index + 1;
    previous = player.score;
    rankById.set(player.id, rank);
  });
  return rankById;
}

export function present(session, playerId, now = Date.now()) {
  const play = session.play;
  const board = currentBoard(session);
  const clue = activeClue(session);
  const showQuestion = ['question', 'countdown', 'reveal', 'scored'].includes(play.phase);
  const showAnswer = ['reveal', 'scored'].includes(play.phase);
  const showBet = ['question', 'countdown', 'reveal'].includes(play.phase) && clue?.dailyDouble;
  const rankById = play.phase === 'summary' ? ranks(session.players) : null;
  const cells = [];

  if (board && play.phase === 'board') {
    for (let column = 1; column <= 6; column += 1) {
      for (let row = 1; row <= 5; row += 1) {
        const cellClue = findClue(session, column, row);
        const played = !cellClue || play.played.includes(clueKey(play.roundIndex, column, row));
        cells.push({
          column,
          row,
          value: played ? null : cellClue.value,
          selectable: play.phase === 'board' && playerId === play.selectorId && !played,
        });
      }
    }
  }

  return {
    type: 'session',
    sessionId: session.id,
    playerId,
    title: session.game.title,
    phase: play.phase,
    roundName: board?.name ?? '',
    revealAt: play.phase === 'countdown' ? play.revealAt : null,
    countdownSeconds: play.phase === 'countdown' && play.revealAt
      ? Math.max(0, Math.ceil((play.revealAt - now) / 1000))
      : null,
    yourAction: yourAction(session, playerId),
    yourAnswer: showAnswer ? (responseFor(play, playerId)?.answer ?? null) : null,
    maxWager: play.phase === 'wager' && clue ? clue.value * 2 : null,
    categories: play.phase === 'board' ? (board?.categories ?? []) : [],
    cells,
    active: clue && play.phase !== 'board' && play.phase !== 'summary' && play.phase !== 'complete'
      ? {
        column: clue.column,
        row: clue.row,
        value: clue.value,
        dailyDouble: clue.dailyDouble,
        category: showQuestion ? clue.category : null,
        question: showQuestion ? clue.question : null,
        answer: showAnswer ? clue.answer : null,
      }
      : null,
    players: session.players.map((player) => ({
      id: player.id,
      score: player.score,
      isYou: player.id === playerId,
      isSelector: player.id === play.selectorId && play.phase === 'board',
      status: playerStatus(session, player.id),
      delta: play.phase === 'scored' && play.deltas[player.id] != null ? formatDelta(play.deltas[player.id]) : null,
      bet: showBet && responseFor(play, player.id)?.wager != null ? responseFor(play, player.id).wager : null,
      correctCount: play.phase === 'summary' ? (play.correctThisRound[player.id] ?? 0) : null,
      rank: rankById ? rankById.get(player.id) : null,
    })),
  };
}
