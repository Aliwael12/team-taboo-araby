// Team scoreboard with glowing progress bars toward the target score.
export default function Scoreboard({ teams, target, activeTeamId, leaderGlow = true }) {
  const sorted = [...teams].sort((a, b) => b.score - a.score);
  const top = sorted.length ? sorted[0].score : 0;

  return (
    <div className="space-y-2.5">
      {sorted.map((t) => {
        const active = activeTeamId === t.id;
        const leading = leaderGlow && t.score === top && top > 0;
        return (
          <div
            key={t.id}
            className="glass-soft px-3.5 py-3 transition-all duration-300"
            style={active ? { boxShadow: `0 0 0 1.5px ${t.color}, 0 0 22px -6px ${t.color}` } : undefined}
          >
            <div className="flex items-center justify-between">
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className="h-3.5 w-3.5 shrink-0 rounded-full"
                  style={{ background: t.color, boxShadow: `0 0 10px ${t.color}` }}
                />
                <span className="truncate font-display font-semibold">{t.name}</span>
                {leading && <span className="text-xs">👑</span>}
              </div>
              <span className="font-display font-bold tabnum">
                {t.score}
                <span className="text-sm text-white/35">/{target}</span>
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(100, (t.score / target) * 100)}%`,
                  background: `linear-gradient(90deg, ${t.color}aa, ${t.color})`,
                  boxShadow: `0 0 12px ${t.color}`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
