import assert from 'node:assert/strict';
import test from 'node:test';
import { parseGame } from './parseGame.js';

const CATEGORIES = ['ALPHA', 'BETA', 'GAMMA', 'DELTA', 'EPSILON', 'ZETA'];

function categories(names) {
  return names.map((name) => `<td class="category"><table><tr><td class="category_name">${name}</td></tr></table></td>`).join('');
}

function clueCell({ round, column, row, faceValue, wager, question, answer }) {
  const id = `clue_${round}_${column}_${row}`;
  const valueCell = wager == null
    ? `<td class="clue_value">$${faceValue}</td>`
    : `<td class="clue_value_daily_double">DD: $${wager}</td>`;
  return `<td class="clue"><table>
    <tr><td><table class="clue_header"><tr><td id="${id}_stuck"></td>${valueCell}</tr></table></td></tr>
    <tr>
      <td id="${id}" class="clue_text">${question}</td>
      <td id="${id}_r" class="clue_text">(Pat: no)<em class="correct_response">${answer}</em><table><tr><td class="right">Pat</td></tr></table></td>
    </tr>
  </table></td>`;
}

function gameHtml({ jeopardy = [], doubleJeopardy = [], final = true } = {}) {
  const finalHtml = final
    ? `<div id="final_jeopardy_round"><table class="final_round"><tr><td class="category"><table><tr><td class="category_name">CINEMA</td></tr></table></td></tr>
      <tr><td class="clue"><table><tr>
        <td id="clue_FJ" class="clue_text">Last film</td>
        <td id="clue_FJ_r" class="clue_text">[note]<table><tr><td class="right">Sue</td><td>$100</td></tr></table><em class="correct_response"><i>The Ten Commandments</i></em></td>
      </tr></table></td></tr></table></div>`
    : '';

  return `<div id="game_title"><h1>Show #1 - Monday, January 1, 2000</h1></div>
    <div id="jeopardy_round"><table class="round"><tr>${categories(CATEGORIES)}</tr><tr>${jeopardy.join('')}</tr></table></div>
    <div id="double_jeopardy_round"><table class="round"><tr>${categories(['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX'])}</tr><tr>${doubleJeopardy.join('')}</tr></table></div>
    ${finalHtml}`;
}

test('parses boards, answers, empty squares, and daily doubles', () => {
  const game = parseGame(gameHtml({
    jeopardy: [
      clueCell({
        round: 'J',
        column: 1,
        row: 1,
        faceValue: '200',
        question: 'Hear <a href="https://www.j-archive.com/media/x.mp3">this song</a><br />next',
        answer: 'the <i>answer</i>',
      }),
      '<td class="clue"></td>',
      clueCell({
        round: 'J',
        column: 3,
        row: 1,
        wager: '5,000',
        question: 'Daily double clue',
        answer: 'daily answer',
      }),
    ],
    doubleJeopardy: [
      clueCell({
        round: 'DJ',
        column: 2,
        row: 4,
        faceValue: '800',
        question: 'Second board',
        answer: 'second answer',
      }),
    ],
  }), '8491');

  assert.equal(game.id, '8491');
  assert.equal(game.title, 'Show #1 - Monday, January 1, 2000');
  assert.deepEqual(game.boards[0].categories, CATEGORIES);
  assert.equal(game.boards[0].clues.length, 2);
  assert.deepEqual(game.boards[0].clues[0], {
    column: 1,
    row: 1,
    category: 'ALPHA',
    value: 200,
    question: 'Hear this song (https://www.j-archive.com/media/x.mp3)\nnext',
    answer: 'the answer',
    dailyDouble: false,
  });
  assert.equal(game.boards[0].clues[1].dailyDouble, true);
  assert.equal(game.boards[0].clues[1].value, 200);
  assert.equal(game.boards[0].clues[1].answer, 'daily answer');
  assert.equal(game.boards[1].name, 'Double Jeopardy');
  assert.equal(game.boards[1].clues[0].category, 'TWO');
  assert.equal(game.boards[1].clues[0].value, 800);
  assert.deepEqual(game.finalJeopardy, {
    category: 'CINEMA',
    question: 'Last film',
    answer: 'The Ten Commandments',
  });
});

test('infers a daily double face value from the surrounding rows', () => {
  const game = parseGame(gameHtml({
    jeopardy: [
      clueCell({ round: 'J', column: 1, row: 1, faceValue: '200', question: 'Top', answer: 'top' }),
      clueCell({ round: 'J', column: 1, row: 2, wager: '100', question: 'Middle', answer: 'middle' }),
      clueCell({ round: 'J', column: 1, row: 3, faceValue: '600', question: 'Bottom', answer: 'bottom' }),
    ],
    doubleJeopardy: [
      clueCell({ round: 'DJ', column: 1, row: 1, faceValue: '400', question: 'Other', answer: 'other' }),
    ],
  }), '1');

  assert.equal(game.boards[0].clues[1].value, 400);
  assert.equal(game.boards[0].clues[1].dailyDouble, true);
});

test('returns null when the page is missing a round', () => {
  assert.equal(parseGame(gameHtml({ final: false }), '1'), null);
});
