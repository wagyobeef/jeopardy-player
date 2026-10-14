import assert from 'node:assert/strict';
import test from 'node:test';
import {
  continuePlay,
  createPlay,
  judge,
  leavePlay,
  present,
  restorePlayer,
  reveal,
  selectClue,
  skipAnswer,
  submitAnswer,
  submitWager,
} from './play.js';

const first = { id: 'p1', score: 0 };
const second = { id: 'p2', score: 0 };

function clue(overrides) {
  return {
    column: 1,
    row: 1,
    category: 'ALPHA',
    value: 200,
    question: 'Question text',
    answer: 'Answer text',
    dailyDouble: false,
    ...overrides,
  };
}

function session(clues, players = [first, second]) {
  const roster = players.map((player) => ({ ...player }));
  const play = createPlay(roster, () => 0);
  return {
    id: 'GAME',
    game: {
      title: 'Show',
      boards: [
        { name: 'Jeopardy', categories: ['ALPHA', 'BETA', 'GAMMA', 'DELTA', 'EPSILON', 'ZETA'], clues },
        {
          name: 'Double Jeopardy',
          categories: ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX'],
          clues: [clue({ column: 2, row: 1, value: 400, question: 'Next round', answer: 'Next answer' })],
        },
      ],
    },
    players: roster,
    play,
  };
}

function view(current, playerId = 'p1') {
  return present(current, playerId);
}

test('the opening selector is chosen at random and answers stay hidden', () => {
  const current = session([clue()]);
  const board = view(current);
  assert.equal(board.phase, 'board');
  assert.equal(board.players.find((player) => player.isSelector).id, 'p1');
  assert.equal(board.players.find((player) => player.id === 'p1').status, 'Waiting for player...');
  assert.equal(JSON.stringify(board).includes('Answer text'), false);
  assert.equal(board.cells.find((cell) => cell.column === 1 && cell.row === 1).selectable, true);
  assert.equal(board.cells.find((cell) => cell.column === 2 && cell.row === 1).selectable, false);
});

test('a selected question is shown only after it is chosen', () => {
  const current = session([clue()]);
  assert.equal(selectClue(current, 'p2', 1, 1).ok, false);
  assert.equal(selectClue(current, 'p1', 1, 1).ok, true);

  const question = view(current);
  assert.equal(question.phase, 'question');
  assert.equal(question.active.category, 'ALPHA');
  assert.equal(question.active.question, 'Question text');
  assert.equal(question.active.answer, null);
  assert.equal(question.players.find((player) => player.id === 'p2').status, 'Waiting for player...');
});

test('answers are revealed after both players respond, then only correct players score', () => {
  const current = session([clue()]);
  selectClue(current, 'p1', 1, 1);
  assert.equal(submitAnswer(current, 'p1', 'mine', 1_000).startCountdown, undefined);
  const waiting = view(current, 'p1');
  assert.equal(waiting.players.find((player) => player.isYou).status, 'Submitted');
  assert.equal(waiting.players.every((player) => player.submittedAnswer == null), true);

  const ready = submitAnswer(current, 'p2', 'theirs', 1_000);
  assert.equal(ready.startCountdown, true);
  const countdown = present(current, 'p1', 1_500);
  assert.equal(countdown.countdownSeconds, 1);
  assert.equal(countdown.players.every((player) => player.submittedAnswer == null), true);
  assert.equal(present(current, 'p1', 1_500).yourAnswer, null);
  assert.equal(view(current).active.answer, null);

  assert.equal(reveal(current), true);
  assert.equal(view(current).active.answer, 'Answer text');
  assert.equal(view(current).players.find((player) => player.id === 'p1').submittedAnswer, 'mine');
  assert.equal(view(current).players.find((player) => player.id === 'p2').submittedAnswer, 'theirs');
  assert.equal(view(current, 'p1').yourAnswer, 'mine');
  assert.equal(view(current, 'p2').yourAnswer, 'theirs');
  judge(current, 'p1', true);
  assert.equal(view(current).phase, 'reveal');
  judge(current, 'p2', false);

  const scored = view(current);
  assert.equal(scored.phase, 'scored');
  assert.equal(scored.players.find((player) => player.id === 'p1').score, 200);
  assert.equal(scored.players.find((player) => player.id === 'p1').delta, '+200');
  assert.equal(scored.players.find((player) => player.id === 'p2').score, 0);
  assert.equal(scored.players.find((player) => player.id === 'p2').delta, null);
});

test('a skipped answer is not judged and does not score', () => {
  const current = session([clue()], [{ ...first }, { ...second }]);
  selectClue(current, 'p1', 1, 1);
  skipAnswer(current, 'p1', 0);
  submitAnswer(current, 'p2', 'yes', 0);
  reveal(current);
  assert.equal(view(current, 'p1').yourAction, null);
  assert.equal(view(current, 'p1').yourAnswer, null);
  assert.equal(view(current, 'p2').yourAnswer, 'yes');
  assert.equal(view(current).players.find((player) => player.id === 'p1').submittedAnswer, null);
  assert.equal(view(current).players.find((player) => player.id === 'p2').submittedAnswer, 'yes');
  assert.equal(judge(current, 'p1', true).ok, false);
  judge(current, 'p2', true);
  assert.equal(current.players.find((player) => player.id === 'p1').score, 0);
  assert.equal(current.players.find((player) => player.id === 'p2').score, 200);
});

test('the selector keeps control after a correct answer and otherwise it passes to a correct player', () => {
  const current = session([
    clue(),
    clue({ column: 1, row: 2, question: 'Second', answer: 'Two' }),
    clue({ column: 1, row: 3, question: 'Third', answer: 'Three' }),
  ]);
  selectClue(current, 'p1', 1, 1);
  submitAnswer(current, 'p1', 'yes', 0);
  submitAnswer(current, 'p2', 'yes', 0);
  reveal(current);
  judge(current, 'p1', true);
  judge(current, 'p2', true);
  continuePlay(current, 'p1', () => 0);
  continuePlay(current, 'p2', () => 0);
  assert.equal(current.play.selectorId, 'p1');
  assert.equal(view(current).cells.find((cell) => cell.column === 1 && cell.row === 1).value, null);

  selectClue(current, 'p1', 1, 2);
  skipAnswer(current, 'p1', 0);
  submitAnswer(current, 'p2', 'yes', 0);
  reveal(current);
  judge(current, 'p2', true);
  continuePlay(current, 'p1', () => 0);
  continuePlay(current, 'p2', () => 0);
  assert.equal(current.play.phase, 'board');
  assert.equal(current.play.selectorId, 'p2');
});

test('nobody correct leaves selection with the same player', () => {
  const current = session([clue(), clue({ column: 2, row: 1 })]);
  selectClue(current, 'p1', 1, 1);
  submitAnswer(current, 'p1', 'no', 0);
  submitAnswer(current, 'p2', 'no', 0);
  reveal(current);
  judge(current, 'p1', false);
  judge(current, 'p2', false);
  continuePlay(current, 'p1');
  continuePlay(current, 'p2');
  assert.equal(current.play.selectorId, 'p1');
  assert.equal(current.play.phase, 'board');
});

test('a daily double uses the wager for both gains and losses', () => {
  const current = session([
    clue({ dailyDouble: true, value: 200, column: 1, row: 1 }),
    clue({ column: 1, row: 2 }),
  ], [{ ...first }, { ...second }]);
  selectClue(current, 'p1', 1, 1);
  assert.equal(view(current).phase, 'wager');
  assert.equal(view(current).active.question, null);
  assert.equal(submitWager(current, 'p1', 401).ok, false);
  submitWager(current, 'p1', 400);
  submitWager(current, 'p2', 0);
  assert.equal(view(current).phase, 'question');
  assert.equal(view(current).players.find((player) => player.id === 'p1').bet, 400);

  submitAnswer(current, 'p1', 'yes', 0);
  skipAnswer(current, 'p2', 0);
  reveal(current);
  judge(current, 'p1', true);
  const scored = view(current);
  assert.equal(scored.players.find((player) => player.id === 'p1').score, 400);
  assert.equal(scored.players.find((player) => player.id === 'p1').delta, '+400');
  assert.equal(scored.players.find((player) => player.id === 'p2').score, 0);
  assert.equal(scored.players.find((player) => player.id === 'p2').delta, '-0');
});

test('the end of Jeopardy ranks players and Double Jeopardy starts with the lowest score', () => {
  const players = [{ id: 'p1', score: 0 }, { id: 'p2', score: 500 }, { id: 'p3', score: 500 }];
  const current = session([clue()], players);
  current.play.selectorId = 'p1';
  selectClue(current, 'p1', 1, 1);
  submitAnswer(current, 'p1', 'yes', 0);
  skipAnswer(current, 'p2', 0);
  skipAnswer(current, 'p3', 0);
  reveal(current);
  judge(current, 'p1', true);
  for (const player of players) continuePlay(current, player.id, () => 0);

  const summary = view(current);
  assert.equal(summary.phase, 'summary');
  assert.equal(summary.players.find((player) => player.id === 'p1').rank, 3);
  assert.equal(summary.players.find((player) => player.id === 'p1').correctCount, 1);
  assert.equal(summary.players.find((player) => player.id === 'p2').rank, 1);
  assert.equal(summary.players.find((player) => player.id === 'p3').rank, 1);

  for (const player of players) continuePlay(current, player.id, () => 0);
  assert.equal(current.play.roundIndex, 1);
  assert.equal(current.play.phase, 'board');
  assert.equal(current.play.selectorId, 'p1');
  assert.equal(view(current).categories[0], 'ONE');
  assert.equal(view(current).players[0].correctCount, null);
});

test('leaving removes the player and lets everyone else finish the question', () => {
  const current = session([clue()]);
  selectClue(current, 'p1', 1, 1);
  submitAnswer(current, 'p2', 'yes', 1_000);
  const left = leavePlay(current, 'p1', () => 0, 1_000);

  assert.equal(left.startCountdown, true);
  assert.equal(current.players.map((player) => player.id).join(','), 'p2');
  assert.equal(current.departed[0].id, 'p1');
  assert.equal(current.departed[0].score, 0);
  assert.equal(current.play.phase, 'countdown');
});

test('the selector role moves when that player leaves the board', () => {
  const current = session([clue()]);
  assert.equal(current.play.selectorId, 'p1');
  leavePlay(current, 'p1', () => 0);
  assert.equal(current.play.selectorId, 'p2');
  assert.equal(view(current, 'p2').yourAction, 'select');
});

test('a player who returns keeps the score from when they left', () => {
  const current = session([clue()], [{ id: 'p1', score: 300 }]);
  selectClue(current, 'p1', 1, 1);
  leavePlay(current, 'p1');
  assert.equal(current.players.length, 0);
  assert.equal(current.play.phase, 'question');

  const player = current.departed[0];
  current.players.push(player);
  current.departed.splice(0, 1);
  restorePlayer(current, player);

  assert.equal(current.players[0].score, 300);
  assert.equal(current.play.phase, 'question');
  assert.equal(view(current).yourAction, 'answer');
});

test('finishing Double Jeopardy stops before Final Jeopardy', () => {
  const current = session([clue()], [{ ...first }]);
  current.play.roundIndex = 1;
  current.play.selectorId = 'p1';
  selectClue(current, 'p1', 2, 1);
  skipAnswer(current, 'p1', 0);
  reveal(current);
  continuePlay(current, 'p1');
  assert.equal(current.play.phase, 'summary');
  continuePlay(current, 'p1');
  assert.equal(current.play.phase, 'complete');
  assert.equal(view(current).active, null);
});
