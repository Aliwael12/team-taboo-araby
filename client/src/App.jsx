import { useMemo } from 'react';
import { useGame, codeFromUrl } from './lib/useGame';
import Backdrop from './components/Backdrop';
import Home from './screens/Home';
import Lobby from './screens/Lobby';
import Countdown from './screens/Countdown';
import Turn from './screens/Turn';
import TurnEnd from './screens/TurnEnd';
import GameOver from './screens/GameOver';

export default function App() {
  const game = useGame();
  const urlCode = useMemo(() => codeFromUrl(), []);
  const { state, status, connected } = game;

  const actions = {
    addTeam: game.addTeam,
    removeTeam: game.removeTeam,
    assignPlayer: game.assignPlayer,
    renameTeam: game.renameTeam,
    setSettings: game.setSettings,
    startGame: game.startGame,
    restart: game.restart,
    submitGuess: game.submitGuess,
    onGuessResult: game.onGuessResult,
  };

  // Tint the backdrop with the active team's color when a game is running.
  const tint = state && state.turn ? state.turn.teamColor : null;

  let body;
  let key = 'home';
  if (status !== 'inroom' || !state) {
    body = (
      <Home
        initialCode={urlCode}
        onCreate={game.createGame}
        onJoin={game.joinGame}
        error={game.error}
        busy={status === 'joining'}
      />
    );
  } else {
    key = state.phase + (state.turn ? ':' + state.turn.index : '');
    switch (state.phase) {
      case 'lobby':
        body = <Lobby state={state} actions={actions} />;
        break;
      case 'countdown':
        body = <Countdown state={state} />;
        break;
      case 'turn':
        body = <Turn state={state} remaining={game.remaining} actions={actions} />;
        break;
      case 'turnEnd':
        body = <TurnEnd state={state} />;
        break;
      case 'gameOver':
        body = <GameOver state={state} actions={actions} />;
        break;
      default:
        body = <Loading />;
    }
  }

  return (
    <>
      <Backdrop tint={tint} />
      <div key={key} className="animate-screenIn">
        {body}
      </div>
      <ConnectionBadge connected={connected} />
    </>
  );
}

function Loading() {
  return (
    <div className="app-shell flex items-center justify-center text-white/40">
      <div className="animate-pulseGlow font-display">Loading…</div>
    </div>
  );
}

function ConnectionBadge({ connected }) {
  if (connected) return null;
  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full border border-neon-red/40 bg-neon-red/20 px-4 py-1.5 text-sm font-semibold text-white backdrop-blur-md">
      ● Reconnecting…
    </div>
  );
}
