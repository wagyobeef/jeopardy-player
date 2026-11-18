import { useEffect, useRef, useState } from 'react';

function formatScore(score) {
  return score.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

function playerLabel(players, player) {
  if (player.name) return player.name;
  if (player.isYou) return 'You';
  const index = players.findIndex((candidate) => candidate.id === player.id);
  return `Player ${index + 1}`;
}

function DoorIcon() {
  return (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
      <path
        d="M6 3.5h8.5a1 1 0 0 1 1 1V20H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M15.5 12H21m0 0-2.2-2.2M21 12l-2.2 2.2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12.2" cy="12" r="0.9" fill="currentColor" />
    </svg>
  );
}

function ScoreBar({ players }) {
  return (
    <footer className="scorebar">
      {players.map((player) => (
        <div className="player-score" key={player.id}>
          {player.submittedAnswer && <span className="submitted-answer">{player.submittedAnswer}</span>}
          <span>
            {playerLabel(players, player)}
            {player.isSelector && <span className="selector-star" aria-hidden="true">★</span>}
          </span>
          <div className="score-line">
            <strong>{formatScore(player.score)}</strong>
            {player.delta && <span className="delta">{player.delta}</span>}
          </div>
          {player.bet != null && <span>Bet {player.bet}</span>}
          {player.status && <span>{player.status}</span>}
        </div>
      ))}
    </footer>
  );
}

function cellAt(session, column, row) {
  return session.cells.find((cell) => cell.column === column && cell.row === row) ?? null;
}

function firstQuestion(session) {
  for (let column = 1; column <= 6; column += 1) {
    for (let row = 1; row <= 5; row += 1) {
      if (cellAt(session, column, row)?.value != null) return { column, row };
    }
  }
  return { column: 1, row: 1 };
}

function startingQuestion(session, lastClue) {
  if (lastClue) {
    for (let row = 1; row <= 5; row += 1) {
      if (cellAt(session, lastClue.column, row)?.value != null) {
        return { column: lastClue.column, row };
      }
    }
  }
  return firstQuestion(session);
}

function moveCursor(session, cursor, key) {
  const step = {
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
  }[key];
  if (!step) return cursor;

  let column = cursor.column + step[0];
  let row = cursor.row + step[1];
  while (column >= 1 && column <= 6 && row >= 1 && row <= 5) {
    if (cellAt(session, column, row)?.value != null) return { column, row };
    column += step[0];
    row += step[1];
  }
  return cursor;
}

function Board({ session, onSelect, cursor }) {
  const rows = [1, 2, 3, 4, 5].map((row) => (
    session.cells
      .filter((cell) => cell.row === row)
      .sort((a, b) => a.column - b.column)
  ));

  return (
    <div className="board">
      {session.categories.map((category, index) => (
        <div className="category" key={`${index}-${category}`}>{category}</div>
      ))}
      {rows.flat().map((cell) => {
        const key = `${cell.column}-${cell.row}`;
        const targeted = cursor?.column === cell.column && cursor?.row === cell.row;
        const className = `clue-cell${cell.value == null ? ' blank' : ''}${targeted ? ' keyboard-target' : ''}`;
        if (cell.value == null || !cell.selectable) {
          return <div className={className} key={key}>{cell.value == null ? '' : formatScore(cell.value)}</div>;
        }
        return (
          <button
            className={className}
            key={key}
            type="button"
            onClick={() => onSelect(cell.column, cell.row)}
          >
            {formatScore(cell.value)}
          </button>
        );
      })}
    </div>
  );
}

function Countdown() {
  return <p className="countdown">Answer is...</p>;
}

function AnswerForm({ onAnswer, onSkip }) {
  const [text, setText] = useState('');
  const [choice, setChoice] = useState('submit');

  function onSubmit(event) {
    event.preventDefault();
    onAnswer(text);
  }

  function onKeyDown(event) {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      setChoice('skip');
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      setChoice('submit');
      return;
    }
    if (event.key === 'Enter' && choice === 'skip') {
      event.preventDefault();
      onSkip();
    }
  }

  return (
    <form onSubmit={onSubmit} onKeyDown={onKeyDown}>
      <label htmlFor="answer">Your answer</label>
      <input id="answer" value={text} onChange={(event) => setText(event.target.value)} autoComplete="off" autoFocus />
      <div className="actions">
        <button type="submit" className={choice === 'submit' ? 'chosen' : undefined}>Submit</button>
        <button type="button" className={choice === 'skip' ? 'secondary chosen' : 'secondary'} onClick={onSkip}>Skip</button>
      </div>
    </form>
  );
}

function WagerForm({ maxWager, onWager }) {
  const [amount, setAmount] = useState('');

  function onSubmit(event) {
    event.preventDefault();
    onWager(Number(amount));
  }

  return (
    <form onSubmit={onSubmit}>
      <label htmlFor="wager">Your bet</label>
      <input
        id="wager"
        inputMode="numeric"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        autoComplete="off"
        autoFocus
        required
      />
      <p>Bet from 0 to {maxWager}.</p>
      <button type="submit">Submit bet</button>
    </form>
  );
}

function correctLabel(player) {
  if (player.correctTotal == null) return `${player.correctCount} correct`;
  return `${player.correctCount} correct this round, ${player.correctTotal} total`;
}

function NextGameForm({ pending, onNext }) {
  const [url, setUrl] = useState('');

  function onSubmit(event) {
    event.preventDefault();
    onNext(url);
  }

  return (
    <form onSubmit={onSubmit}>
      <label htmlFor="next-url">J-Archive URL</label>
      <input
        id="next-url"
        type="url"
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        placeholder="https://j-archive.com/showgame.php?game_id=8491"
        autoComplete="off"
        autoFocus
        required
      />
      <div className="actions centered">
        <button type="submit" disabled={pending}>{pending ? 'Checking the page…' : 'Start next game'}</button>
      </div>
    </form>
  );
}

function ClueCategory({ session }) {
  if (!session.active?.category) return null;
  return <p className="clue-category">{session.active.category}</p>;
}

function QuestionView({ session, review, setReview, onJudge, onContinue }) {
  const showingAnswer = review === 'answer' && session.active.answer;
  return (
    <div className="prompt">
      <ClueCategory session={session} />
      {(session.phase === 'reveal' || session.phase === 'scored') && (
        <div className="review-toggle">
          <button type="button" aria-pressed={review === 'question'} onClick={() => setReview('question')}>Question</button>
          <button type="button" aria-pressed={review === 'answer'} onClick={() => setReview('answer')}>Answer</button>
        </div>
      )}
      <p className="question-text">{showingAnswer ? session.active.answer : session.active.question}</p>
      {showingAnswer && session.yourAnswer && (
        <p className="your-answer">Your answer: {session.yourAnswer}</p>
      )}
      {session.phase === 'countdown' && <Countdown />}
      {session.yourAction === 'judge' && (
        <div
          className="actions centered judge"
          onKeyDown={(event) => {
            const buttons = [...event.currentTarget.querySelectorAll('button')];
            if (event.key === 'Enter') {
              event.preventDefault();
              const active = document.activeElement;
              (buttons.includes(active) ? active : buttons[0])?.click();
              return;
            }
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
            event.preventDefault();
            const index = buttons.indexOf(document.activeElement);
            const next = event.key === 'ArrowRight' ? index + 1 : index - 1;
            buttons[Math.min(buttons.length - 1, Math.max(0, index === -1 ? 0 : next))]?.focus();
          }}
        >
          <button type="button" onClick={() => onJudge(true)} autoFocus>Correct</button>
          <button type="button" className="secondary" onClick={() => onJudge(false)}>Incorrect</button>
        </div>
      )}
      {session.yourAction === 'continue' && session.phase === 'scored' && (
        <button type="button" onClick={onContinue}>Continue</button>
      )}
    </div>
  );
}

export function Game({ session, error, pending, onSelect, onWager, onAnswer, onSkip, onJudge, onContinue, onLeave, onNext }) {
  const [review, setReview] = useState('answer');
  const [cursor, setCursor] = useState({ column: 1, row: 1 });
  const lastClue = useRef(null);
  const wasChoosing = useRef(false);
  const clueKey = session.active ? `${session.active.column}-${session.active.row}-${session.phase}` : session.phase;
  const choosing = session.phase === 'board' && session.yourAction === 'select';

  useEffect(() => {
    setReview('answer');
  }, [clueKey]);

  useEffect(() => {
    if (session.active?.column && session.active?.row) {
      lastClue.current = { column: session.active.column, row: session.active.row };
    }
  }, [session.active]);

  useEffect(() => {
    if (choosing && !wasChoosing.current) {
      setCursor(startingQuestion(session, lastClue.current));
    }
    wasChoosing.current = choosing;
  }, [choosing, session]);

  useEffect(() => {
    function onKeyDown(event) {
      const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
      if (typing) return;
      if (event.repeat && event.key === 'Enter') return;

      if (choosing && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault();
        setCursor((current) => moveCursor(session, current, event.key));
        return;
      }

      if (event.key !== 'Enter') return;
      if (choosing) {
        event.preventDefault();
        const cell = cellAt(session, cursor.column, cursor.row);
        if (cell?.selectable) onSelect(cell.column, cell.row);
        return;
      }
      if (session.yourAction === 'continue' && !(event.target instanceof HTMLButtonElement)) {
        event.preventDefault();
        onContinue();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [choosing, cursor, onContinue, onSelect, session]);

  return (
    <div className="stage">
      <header className="stage-header">
        {session.phase === 'board' && <h1>{session.roundName}</h1>}
        <div className="header-tools">
          <p className="invite">Invitation code {session.sessionId}</p>
          <button type="button" className="leave" aria-label="Leave game" onClick={onLeave}>
            <DoorIcon />
          </button>
        </div>
      </header>
      {session.phase === 'board' && <Board session={session} onSelect={onSelect} cursor={choosing ? cursor : null} />}
      {session.phase === 'wager' && (
        <div className="prompt">
          {session.roundName === 'Final Jeopardy' ? (
            <>
              <h1>Final Jeopardy</h1>
              <ClueCategory session={session} />
            </>
          ) : <h1>Daily Double</h1>}
          <WagerForm maxWager={session.maxWager} onWager={onWager} />
        </div>
      )}
      {session.phase === 'question' && (
        <div className="prompt">
          <ClueCategory session={session} />
          <p className="question-text">{session.active?.question}</p>
          {session.yourAction === 'answer' && <AnswerForm onAnswer={onAnswer} onSkip={onSkip} />}
        </div>
      )}
      {(session.phase === 'countdown' || session.phase === 'reveal' || session.phase === 'scored') && (
        <QuestionView
          session={session}
          review={review}
          setReview={setReview}
          onJudge={onJudge}
          onContinue={onContinue}
        />
      )}
      {session.phase === 'summary' && (
        <div className="prompt">
          <h1>{session.roundName}</h1>
          <ol className="summary">
            {[...session.players].sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id)).map((player) => (
              <li key={player.id}>
                {player.rank}. {playerLabel(session.players, player)} — {formatScore(player.score)} — {correctLabel(player)}
              </li>
            ))}
          </ol>
          {session.yourAction === 'continue' && (
            <button type="button" onClick={onContinue}>Continue</button>
          )}
        </div>
      )}
      {session.phase === 'complete' && (
        <div className="prompt">
          <h1>Next game</h1>
          <p>Enter another J-Archive URL to start a new game for everyone still here.</p>
          <NextGameForm pending={pending} onNext={onNext} />
          <div className="actions centered">
            <button type="button" className="secondary" onClick={onLeave} disabled={pending}>Leave</button>
          </div>
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      <ScoreBar players={session.players} />
    </div>
  );
}
