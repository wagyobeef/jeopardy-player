import { useEffect, useState } from 'react';

function formatScore(score) {
  return score.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

function playerLabel(players, player) {
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

function Board({ session, onSelect }) {
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
        if (cell.value == null) return <div className="clue-cell blank" key={key} />;
        if (!cell.selectable) return <div className="clue-cell" key={key}>{formatScore(cell.value)}</div>;
        return (
          <button
            className="clue-cell"
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

  function onSubmit(event) {
    event.preventDefault();
    onAnswer(text);
  }

  return (
    <form onSubmit={onSubmit}>
      <label htmlFor="answer">Your answer</label>
      <input id="answer" value={text} onChange={(event) => setText(event.target.value)} autoComplete="off" />
      <div className="actions">
        <button type="submit">Submit</button>
        <button type="button" className="secondary" onClick={onSkip}>Skip</button>
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
        required
      />
      <p>Bet from 0 to {maxWager}.</p>
      <button type="submit">Submit bet</button>
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
        <div className="actions centered">
          <button type="button" onClick={() => onJudge(true)}>Correct</button>
          <button type="button" className="secondary" onClick={() => onJudge(false)}>Incorrect</button>
        </div>
      )}
      {session.yourAction === 'continue' && session.phase === 'scored' && (
        <button type="button" onClick={onContinue}>Continue</button>
      )}
    </div>
  );
}

export function Game({ session, error, onSelect, onWager, onAnswer, onSkip, onJudge, onContinue, onLeave }) {
  const [review, setReview] = useState('answer');
  const clueKey = session.active ? `${session.active.column}-${session.active.row}-${session.phase}` : session.phase;

  useEffect(() => {
    setReview('answer');
  }, [clueKey]);

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
      {session.phase === 'board' && <Board session={session} onSelect={onSelect} />}
      {session.phase === 'wager' && (
        <div className="prompt">
          <h1>Daily Double</h1>
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
                {player.rank}. {playerLabel(session.players, player)} — {formatScore(player.score)} — {player.correctCount} correct
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
          <h1>Final Jeopardy</h1>
          <p>Final Jeopardy is not ready yet.</p>
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      <ScoreBar players={session.players} />
    </div>
  );
}
