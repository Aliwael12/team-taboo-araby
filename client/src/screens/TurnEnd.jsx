import Scoreboard from '../components/Scoreboard';
import { TitleCard } from './Turn';

// Between-turn reveal: all 5 words, who got them, points earned, and who's up next.
export default function TurnEnd({ state }) {
  const { turn, teams, settings, nextUp } = state;
  if (!turn) return null;
  const gained = turn.words.reduce((s, w) => s + (w.points || 0), 0);
  const gotCount = turn.words.filter((w) => w.solved).length;

  return (
    <div className="app-shell mx-auto flex w-full max-w-md flex-col px-4 py-6">
      <div className="mb-4 text-center">
        <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-sand/40">Time's up</div>
        <div className="mt-0.5 font-display text-4xl" style={{ color: turn.teamColor, textShadow: `0 0 22px ${turn.teamColor}` }}>
          {turn.teamName}
        </div>
        <div className="mt-1 inline-flex items-center gap-2 text-sand/60">
          <span className="chip bg-mint/15 font-bold text-mint">+{gained} pts</span>
          <span className="text-sm">{gotCount}/{turn.total} words</span>
        </div>
      </div>

      <div className="mb-6 space-y-2">
        {turn.words.map((w, i) => (
          <div
            key={i}
            className={`flex animate-riseIn items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${
              w.solved ? 'border-mint/25 bg-mint/[0.08]' : 'border-sand/[0.07] bg-sand/[0.03]'
            }`}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <TitleCard display={w.display} solved={false} dim={!w.solved} size="sm" />
            {w.solved ? (
              <div className="text-right">
                <span className="font-display text-mint">
                  +{w.points} {w.points === 1 && <span className="text-amber">spelling</span>}
                </span>
                {w.solvedByName && <span className="block text-xs text-sand/45">by {w.solvedByName}</span>}
              </div>
            ) : (
              <span className="text-sm text-sand/35">missed</span>
            )}
          </div>
        ))}
      </div>

      <div className="mt-auto">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-sand/35">Scores</div>
        <Scoreboard teams={teams} target={settings.targetScore} activeTeamId={turn.teamId} />

        {nextUp && (
          <div className="card-soft mt-4 flex items-center justify-center gap-2 px-4 py-3 text-center">
            <span className="text-xs uppercase tracking-[0.2em] text-sand/40">Up next</span>
            <span className="h-2 w-2 rounded-full" style={{ background: nextUp.teamColor, boxShadow: `0 0 8px ${nextUp.teamColor}` }} />
            <span className="font-display text-lg text-sand">{nextUp.describerName}</span>
            <span className="text-sand/40">·</span>
            <span className="font-display text-lg" style={{ color: nextUp.teamColor }}>{nextUp.teamName}</span>
          </div>
        )}
      </div>
    </div>
  );
}
