import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import Scoreboard from '../components/Scoreboard';

export default function GameOver({ state, actions }) {
  const { teams, settings, winnerTeamId, isHost } = state;
  const winner = teams.find((t) => t.id === winnerTeamId);
  const fired = useRef(false);

  // Celebration burst on mount.
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    const colors = winner ? [winner.color, '#ffffff', '#a855f7'] : ['#a855f7', '#22d3ee'];
    const burst = (opts) => confetti({ disableForReducedMotion: true, colors, ...opts });
    burst({ particleCount: 120, spread: 90, startVelocity: 45, origin: { y: 0.6 } });
    setTimeout(() => burst({ particleCount: 60, angle: 60, spread: 70, origin: { x: 0 } }), 200);
    setTimeout(() => burst({ particleCount: 60, angle: 120, spread: 70, origin: { x: 1 } }), 350);
  }, [winner]);

  return (
    <div className="app-shell mx-auto flex w-full max-w-md flex-col px-4 py-8">
      <div className="mb-8 mt-6 text-center">
        <div className="mb-3 animate-countPop text-7xl">🏆</div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/40">Winner</div>
        <div
          className="animate-popIn font-display text-4xl font-black"
          style={{ color: winner ? winner.color : '#fff', textShadow: winner ? `0 0 30px ${winner.color}` : 'none' }}
        >
          {winner ? winner.name : 'Game over'}
        </div>
        <div className="mt-1 text-white/50">first to {settings.targetScore} points</div>
      </div>

      <Scoreboard teams={teams} target={settings.targetScore} activeTeamId={winnerTeamId} />

      <div className="mt-auto pt-8">
        {isHost ? (
          <button onClick={actions.restart} className="btn-primary w-full py-4 text-lg">↺  Play again · same teams</button>
        ) : (
          <div className="text-center text-white/45">
            <span className="animate-pulseGlow font-display">Waiting for the host to start a rematch…</span>
          </div>
        )}
      </div>
    </div>
  );
}
