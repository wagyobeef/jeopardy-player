import { load } from 'cheerio';

function clean(text) {
  return text
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function readableText($, element) {
  const clone = $(element).clone();
  clone.find('br').replaceWith('\n');
  clone.find('a').each((_, anchor) => {
    const href = $(anchor).attr('href');
    if (href) $(anchor).after(` (${href})`);
  });
  return clean(clone.text());
}

function parseDollars(text) {
  const match = text.match(/\$(\d[\d,]*)/);
  if (!match) return null;
  const amount = Number(match[1].replace(/,/g, ''));
  return Number.isInteger(amount) && amount > 0 ? amount : null;
}

function assignFaceValues(partials) {
  const rowValue = new Map();
  for (const clue of partials) {
    if (clue.rawValue == null) continue;
    const existing = rowValue.get(clue.row);
    if (existing != null && existing !== clue.rawValue) return null;
    rowValue.set(clue.row, clue.rawValue);
  }

  const known = [...rowValue.entries()].sort((a, b) => a[0] - b[0]);
  const needsInference = partials.some((clue) => clue.rawValue == null && !rowValue.has(clue.row));
  if (needsInference && known.length >= 2) {
    const [firstRow, firstValue] = known[0];
    const [lastRow, lastValue] = known[known.length - 1];
    const step = (lastValue - firstValue) / (lastRow - firstRow);
    if (!Number.isInteger(step)) return null;
    for (const [row, value] of known) {
      if (value !== firstValue + (row - firstRow) * step) return null;
    }
    for (let row = 1; row <= 5; row += 1) {
      if (!rowValue.has(row)) {
        rowValue.set(row, firstValue + (row - firstRow) * step);
      }
    }
  }

  const clues = [];
  for (const clue of partials) {
    const value = clue.rawValue ?? rowValue.get(clue.row);
    if (!Number.isInteger(value) || value <= 0) return null;
    clues.push({
      column: clue.column,
      row: clue.row,
      category: clue.category,
      value,
      question: clue.question,
      answer: clue.answer,
      dailyDouble: clue.dailyDouble,
    });
  }

  clues.sort((a, b) => a.row - b.row || a.column - b.column);
  return clues;
}

function parseBoard($, roundId, name) {
  const round = $(`#${roundId}`);
  if (round.length !== 1) return null;

  const categories = round.find('td.category_name').toArray().map((element) => clean($(element).text()));
  if (categories.length !== 6 || categories.some((category) => category.length === 0)) return null;

  const partials = [];
  const seen = new Set();

  for (const element of round.find('[id]').toArray()) {
    const id = $(element).attr('id') ?? '';
    const match = id.match(/^clue_(?:DJ|J)_(\d+)_(\d+)$/);
    if (!match) continue;

    const column = Number(match[1]);
    const row = Number(match[2]);
    const key = `${column}-${row}`;
    if (column < 1 || column > 6 || row < 1 || row > 5 || seen.has(key)) return null;
    seen.add(key);

    const cell = $(element).closest('td.clue');
    if (cell.length !== 1) return null;

    const question = readableText($, element);
    const answer = clean(cell.find(`#${id}_r em.correct_response`).first().text());
    if (!question || !answer) return null;

    partials.push({
      column,
      row,
      category: categories[column - 1],
      dailyDouble: cell.find('.clue_value_daily_double').length > 0,
      rawValue: parseDollars(cell.find('.clue_value').first().text()),
      question,
      answer,
    });
  }

  const clues = assignFaceValues(partials);
  if (!clues) return null;
  return { name, categories, clues };
}

function parseFinal($) {
  const round = $('#final_jeopardy_round');
  if (round.length !== 1) return null;

  const questionElement = round.find('#clue_FJ').get(0);
  if (!questionElement) return null;

  const category = clean(round.find('td.category_name').first().text());
  const question = readableText($, questionElement);
  const answer = clean(round.find('#clue_FJ_r em.correct_response').first().text());
  if (!category || !question || !answer) return null;

  return { category, question, answer };
}

export function parseGame(html, gameId) {
  if (typeof html !== 'string' || !/^[1-9]\d{0,9}$/.test(String(gameId))) return null;

  const $ = load(html);
  const title = clean($('#game_title h1').first().text());
  const jeopardy = parseBoard($, 'jeopardy_round', 'Jeopardy');
  const doubleJeopardy = parseBoard($, 'double_jeopardy_round', 'Double Jeopardy');
  const finalJeopardy = parseFinal($);
  if (!title || !jeopardy || !doubleJeopardy || !finalJeopardy) return null;

  return {
    id: String(gameId),
    title,
    boards: [jeopardy, doubleJeopardy],
    finalJeopardy,
  };
}
