import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import Scoreboard from '../components/Scoreboard';
import { playWin } from '../lib/sound';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function GameOver({ state, actions }) {
  const { teams, settings, winnerTeamId, isHost, players } = state;
  const winner = teams.find((t) => t.id === winnerTeamId);
  const fired = useRef(false);

  const podium = [...players]
    .filter((p) => (p.points || 0) > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 3);

  // Celebration burst on mount.
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    playWin();
    const colors = winner ? [winner.color, '#F4E8D8', '#E8A33D'] : ['#E8A33D', '#2EC4B6'];
    const burst = (opts) => confetti({ disableForReducedMotion: true, colors, ...opts });
    burst({ particleCount: 120, spread: 90, startVelocity: 45, origin: { y: 0.6 } });
    setTimeout(() => burst({ particleCount: 60, angle: 60, spread: 70, origin: { x: 0 } }), 200);
    setTimeout(() => burst({ particleCount: 60, angle: 120, spread: 70, origin: { x: 1 } }), 350);
  }, [winner]);

  return (
    <div className="app-shell mx-auto flex w-full max-w-md flex-col px-4 py-8">
      <div className="mb-6 mt-6 text-center">
        <div className="mb-3 animate-countPop text-7xl">🏆</div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-sand/40">Winner</div>
        <div
          className="animate-popIn font-display text-5xl"
          style={{ color: winner ? winner.color : '#F4E8D8', textShadow: winner ? `0 0 30px ${winner.color}` : 'none' }}
        >
          {winner ? winner.name : 'Game over'}
        </div>
        <div className="mt-1 text-sand/50">first to {settings.targetScore} points</div>
      </div>

      {podium.length > 0 && (
        <div className="card-soft mb-5 p-4">
          <div className="mb-2.5 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-sand/35">Top guessers</div>
          <div className="flex items-end justify-center gap-4">
            {podium.map((p, i) => (
              <div key={p.id} className="animate-riseIn text-center" style={{ animationDelay: `${i * 90}ms` }}>
                <div className="text-3xl">{MEDALS[i]}</div>
                <div className="mt-1 max-w-[5.5rem] truncate font-display text-sand">{p.name}</div>
                <div className="tabnum text-sm text-brass-bright">{p.points} pts</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Scoreboard teams={teams} target={settings.targetScore} activeTeamId={winnerTeamId} />

      <div className="mt-auto space-y-2 pt-8">
        {isHost ? (
          <button onClick={actions.restart} className="btn-primary w-full py-4 text-xl">↺ Play again · same teams</button>
        ) : (
          <div className="text-center text-sand/45">
            <span className="animate-pulseGlow font-display">Waiting for the host to start a rematch…</span>
          </div>
        )}
        <button onClick={actions.leave} className="btn-ghost w-full py-3 text-base">✕ Leave room</button>
      </div>
    </div>
  );
}
