import { useState } from 'react';
import { Game } from './Game.jsx';
import { useGameSession } from './useGameSession.js';

function ErrorText({ message }) {
  if (!message) return null;
  return <p className="error" role="alert">{message}</p>;
}

function Lobby({ game }) {
  const [code, setCode] = useState('');

  function onSubmit(event) {
    event.preventDefault();
    game.joinGame(code);
  }

  return (
    <main>
      <h1>Jeopardy Player</h1>
      <p>Create a game from an archived episode, or join one with an invitation code.</p>
      <form onSubmit={onSubmit}>
        <label htmlFor="invitation-code">Invitation code</label>
        <input
          id="invitation-code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          autoCapitalize="characters"
          autoComplete="off"
          required
        />
        <ErrorText message={game.error} />
        <div className="actions">
          <button type="submit" disabled={!game.connected || game.pending}>Join</button>
          <button type="button" className="secondary" onClick={game.showCreate} disabled={game.pending}>
            Create a new game
          </button>
        </div>
      </form>
    </main>
  );
}

function CreateGame({ game }) {
  const [url, setUrl] = useState('');

  function onSubmit(event) {
    event.preventDefault();
    game.createGame(url);
  }

  return (
    <main>
      <h1>New game</h1>
      <form onSubmit={onSubmit}>
        <label htmlFor="archive-url">J-Archive URL</label>
        <input
          id="archive-url"
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://j-archive.com/showgame.php?game_id=8491"
          autoComplete="off"
          required
        />
        <ErrorText message={game.error} />
        <div className="actions">
          <button type="submit" disabled={!game.connected || game.pending}>
            {game.pending ? 'Checking the page…' : 'Create game'}
          </button>
          <button type="button" className="secondary" onClick={game.showLobby} disabled={game.pending}>
            Back
          </button>
        </div>
      </form>
    </main>
  );
}

function Session({ game }) {
  if (!game.connected) {
    return <main><h1>Jeopardy Player</h1><p>Reconnecting…</p></main>;
  }
  return (
    <Game
      session={game.session}
      error={game.error}
      onSelect={game.selectQuestion}
      onWager={game.submitWager}
      onAnswer={game.submitAnswer}
      onSkip={game.skipAnswer}
      onJudge={game.reportCorrect}
      onContinue={game.continuePlay}
    />
  );
}

export function App() {
  const game = useGameSession();

  if (game.screen === 'restoring') {
    return <main><h1>Jeopardy Player</h1><p>Rejoining game…</p></main>;
  }
  if (game.screen === 'session' && game.session) return <Session game={game} />;
  if (game.screen === 'create') return <CreateGame game={game} />;
  return <Lobby game={game} />;
}
