import Scoreboard from '../components/Scoreboard';
import { TitleCard } from './Turn';

// Between-turn reveal: all 5 words, who got them, and points earned.
export default function TurnEnd({ state }) {
  const { turn, teams, settings } = state;
  if (!turn) return null;
  const gained = turn.words.reduce((s, w) => s + (w.points || 0), 0);
  const gotCount = turn.words.filter((w) => w.solved).length;

  return (
    <div className="app-shell mx-auto flex w-full max-w-md flex-col px-4 py-6">
      <div className="mb-4 text-center">
        <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/40">Time's up</div>
        <div className="mt-0.5 font-display text-3xl font-black" style={{ color: turn.teamColor, textShadow: `0 0 22px ${turn.teamColor}` }}>
          {turn.teamName}
        </div>
        <div className="mt-1 inline-flex items-center gap-2 text-white/60">
          <span className="chip bg-neon-green/15 font-bold text-neon-green">+{gained} pts</span>
          <span className="text-sm">{gotCount}/{turn.total} words</span>
        </div>
      </div>

      <div className="mb-6 space-y-2">
        {turn.words.map((w, i) => (
          <div
            key={i}
            className={`flex animate-riseIn items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${
              w.solved ? 'border-neon-green/25 bg-neon-green/[0.08]' : 'border-white/[0.07] bg-white/[0.03]'
            }`}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <TitleCard display={w.display} solved={false} dim={!w.solved} size="sm" />
            {w.solved ? (
              <div className="text-right">
                <span className="font-display font-bold text-neon-green">
                  +{w.points} {w.points === 1 && <span className="text-neon-amber">spelling</span>}
                </span>
                {w.solvedByName && <span className="block text-xs text-white/45">by {w.solvedByName}</span>}
              </div>
            ) : (
              <span className="text-sm text-white/35">missed</span>
            )}
          </div>
        ))}
      </div>

      <div className="mt-auto">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35">Scores</div>
        <Scoreboard teams={teams} target={settings.targetScore} activeTeamId={turn.teamId} />
        <div className="mt-4 text-center text-white/45">
          <span className="animate-pulseGlow font-display">Next turn starting…</span>
        </div>
      </div>
    </div>
  );
}
