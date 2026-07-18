import { useMemo } from 'react';
import { useGame, codeFromUrl } from './lib/useGame';
import Backdrop from './components/Backdrop';
import Home from './screens/Home';
import Lobby from './screens/Lobby';
import Ready from './screens/Ready';
import Turn from './screens/Turn';
import TurnEnd from './screens/TurnEnd';
import GameOver from './screens/GameOver';

export default function App() {
  const game = useGame();
  // Re-read each render so leaving/being kicked (which scrubs ?room=) returns
  // us to a clean home screen instead of the old room's prefilled join form.
  const urlCode = codeFromUrl();
  const { state, status, connected, clockOffset } = game;

  // Stable identity: screens subscribe to guess results in an effect keyed on
  // `actions`, so this must not change on every render.
  const actions = useMemo(
    () => ({
      addTeam: game.addTeam,
      removeTeam: game.removeTeam,
      assignPlayer: game.assignPlayer,
      kickPlayer: game.kickPlayer,
      renameTeam: game.renameTeam,
      setSettings: game.setSettings,
      startGame: game.startGame,
      startTurn: game.startTurn,
      skipTurn: game.skipTurn,
      restart: game.restart,
      submitGuess: game.submitGuess,
      onGuessResult: game.onGuessResult,
      leave: game.leave,
    }),
    [
      game.addTeam, game.removeTeam, game.assignPlayer, game.kickPlayer,
      game.renameTeam, game.setSettings, game.startGame, game.startTurn,
      game.skipTurn, game.restart, game.submitGuess, game.onGuessResult, game.leave,
    ]
  );

  const inGame = state && ['ready', 'turn', 'turnEnd'].includes(state.phase);

  // Tint the backdrop with the active team's color when a game is running.
  const tint = state && state.turn ? state.turn.teamColor : null;

  let body;
  let key = 'home:' + urlCode; // remount Home fresh when the room code is scrubbed
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
      case 'ready':
        body = <Ready state={state} actions={actions} />;
        break;
      case 'turn':
        body = <Turn state={state} clockOffset={clockOffset} actions={actions} />;
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
      {status === 'inroom' && inGame && (
        <button
          onClick={() => { if (window.confirm('Leave this room?')) game.leave(); }}
          className="fixed bottom-3 left-3 z-40 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-xs font-medium text-white/60 backdrop-blur-md active:scale-95"
        >
          ✕ Leave
        </button>
      )}
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
