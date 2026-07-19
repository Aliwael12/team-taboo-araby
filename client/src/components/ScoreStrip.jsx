// Compact one-line live scoreboard, pinned during a turn so every role
// (describer, guesser, spectator) always knows where the game stands.
export default function ScoreStrip({ teams, activeTeamId }) {
  const sorted = [...teams].sort((a, b) => b.score - a.score);
  return (
    <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-0.5">
      {sorted.map((t) => {
        const active = t.id === activeTeamId;
        return (
          <div
            key={t.id}
            className="flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-all duration-300"
            style={
              active
                ? { borderColor: `${t.color}80`, background: `${t.color}1f`, boxShadow: `0 0 14px -4px ${t.color}` }
                : { borderColor: 'rgba(244,232,216,0.08)', background: 'rgba(244,232,216,0.03)' }
            }
          >
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: t.color }} />
            <span className="max-w-[6rem] truncate text-sand/75">{t.name}</span>
            <span className="tabnum font-display text-sm text-sand">{t.score}</span>
          </div>
        );
      })}
    </div>
  );
}
