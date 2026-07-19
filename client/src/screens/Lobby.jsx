import { useState } from 'react';
import Share from '../components/Share';
import PlayerPill from '../components/PlayerPill';

// Pre-game lobby. Host assigns players to teams, tweaks settings, and starts.
// Everyone else watches the teams fill up in real time.
export default function Lobby({ state, actions }) {
  const { isHost, teams, players, settings, canStart, code, youId } = state;
  const [selected, setSelected] = useState(null); // player being placed (host)
  const unassigned = players.filter((p) => !p.teamId);
  const you = players.find((p) => p.id === youId);
  const yourTeam = you && teams.find((t) => t.id === you.teamId);
  const nameOf = (id) => (players.find((p) => p.id === id) || {}).name || '?';
  const kick = (pid) => {
    if (window.confirm(`Kick ${nameOf(pid)} from the room?`)) {
      actions.kickPlayer(pid);
      if (selected === pid) setSelected(null);
    }
  };

  return (
    <div className="app-shell mx-auto flex w-full max-w-md flex-col px-4 py-5">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="font-display text-4xl text-sand">Lobby</h1>
        <div className="flex items-center gap-2">
          <span className="chip bg-night-800 text-sand/60">
            <span className="h-2 w-2 rounded-full bg-mint shadow-glow-mint" /> {players.length} player{players.length !== 1 ? 's' : ''}
          </span>
          <button onClick={() => actions.leave()} className="chip border border-sand/10 bg-night-800 text-sand/70 active:scale-95">
            ✕ Leave
          </button>
        </div>
      </div>

      <Share code={code} />

      {!isHost && (
        <div className="card-soft mt-4 p-4 text-center">
          {yourTeam ? (
            <div className="text-lg text-sand">
              You're on{' '}
              <span className="font-display" style={{ color: yourTeam.color, textShadow: `0 0 16px ${yourTeam.color}` }}>
                {yourTeam.name}
              </span>
            </div>
          ) : (
            <div className="text-sand/50">Waiting for the host to put you on a team…</div>
          )}
        </div>
      )}

      {/* Teams */}
      <div className="mt-4 space-y-3">
        {teams.map((t) => {
          const count = t.playerIds.length;
          const ready = count >= 2;
          return (
            <div key={t.id} className="card overflow-hidden p-0">
              <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${t.color}, transparent)` }} />
              <div className="p-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: t.color, boxShadow: `0 0 10px ${t.color}` }} />
                    {isHost ? (
                      <input
                        defaultValue={t.name}
                        onBlur={(e) => e.target.value.trim() && actions.renameTeam(t.id, e.target.value.trim())}
                        className="w-36 min-w-0 rounded-lg bg-transparent px-1 font-display text-xl text-sand outline-none focus:bg-sand/10"
                      />
                    ) : (
                      <span className="truncate font-display text-xl text-sand">{t.name}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`chip text-xs ${ready ? 'bg-mint/15 text-mint' : 'bg-night-800 text-sand/45'}`}>
                      {ready ? '✓ ready' : `${count}/2`}
                    </span>
                    {isHost && teams.length > 2 && (
                      <button onClick={() => actions.removeTeam(t.id)} className="px-1 text-sand/35 active:scale-90">✕</button>
                    )}
                  </div>
                </div>

                <div className="mt-2.5 flex min-h-[2.25rem] flex-wrap gap-2">
                  {t.playerIds.map((pid) => (
                    <PlayerPill
                      key={pid}
                      label={nameOf(pid)}
                      you={pid === youId}
                      boxShadow={pid !== youId ? `inset 0 0 0 1px ${t.color}55` : undefined}
                      disabled={!isHost}
                      canKick={isHost && pid !== youId}
                      onMain={() => isHost && actions.assignPlayer(pid, null)}
                      onKick={() => kick(pid)}
                      mainTitle={isHost ? 'Tap to remove from team' : ''}
                    />
                  ))}
                  {isHost && selected && (
                    <button
                      onClick={() => { actions.assignPlayer(selected, t.id); setSelected(null); }}
                      className="chip border-2 border-dashed border-sand/25 text-sand/70 active:scale-95"
                    >
                      ＋ place {nameOf(selected)}
                    </button>
                  )}
                  {count === 0 && !selected && <span className="py-1 text-sm text-sand/25">No players yet</span>}
                </div>
              </div>
            </div>
          );
        })}

        {isHost && (
          <div className="flex gap-2">
            {teams.length < 8 && (
              <button onClick={actions.addTeam} className="flex-1 rounded-2xl border-2 border-dashed border-sand/15 py-3 text-sand/50 transition active:scale-[0.99] hover:border-sand/25">
                ＋ Add team
              </button>
            )}
            {players.length >= 2 && (
              <button
                onClick={actions.autoTeams}
                className="flex-1 rounded-2xl border-2 border-dashed border-teal/30 py-3 text-teal transition active:scale-[0.99] hover:border-teal/50"
              >
                🎲 Auto teams
              </button>
            )}
          </div>
        )}
      </div>

      {/* Unassigned players */}
      {unassigned.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-sand/35">
            {isHost ? '① Tap a player  ② tap their team' : 'Not on a team yet'}
          </div>
          <div className="flex flex-wrap gap-2">
            {unassigned.map((p) => (
              <PlayerPill
                key={p.id}
                label={p.name}
                you={p.id === youId}
                selected={selected === p.id}
                ring={p.id === youId}
                disabled={!isHost}
                canKick={isHost && p.id !== youId}
                onMain={() => isHost && setSelected(selected === p.id ? null : p.id)}
                onKick={() => kick(p.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Host settings + start */}
      {isHost ? (
        <div className="mt-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="card-soft p-3.5">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-sand/40">Win at</div>
              <div className="flex items-baseline gap-1">
                <input
                  type="number" min={10} max={200} step={2} defaultValue={settings.targetScore}
                  onChange={(e) => actions.setSettings({ targetScore: Number(e.target.value) })}
                  className="w-full bg-transparent font-display text-3xl text-sand outline-none"
                />
                <span className="text-sm text-sand/40">pts</span>
              </div>
            </label>
            <label className="card-soft p-3.5">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-sand/40">Per turn</div>
              <div className="flex items-baseline gap-1">
                <input
                  type="number" min={15} max={120} step={5} defaultValue={settings.turnSeconds}
                  onChange={(e) => actions.setSettings({ turnSeconds: Number(e.target.value) })}
                  className="w-full bg-transparent font-display text-3xl text-sand outline-none"
                />
                <span className="text-sm text-sand/40">sec</span>
              </div>
            </label>
          </div>

          <button disabled={!canStart.ok} onClick={actions.startGame} className="btn-primary w-full py-4 text-xl">
            {canStart.ok ? '▶  Start game' : canStart.reason}
          </button>
        </div>
      ) : (
        <div className="mt-6 text-center text-sand/45">
          <span className="animate-pulseGlow font-display">Waiting for the host to start…</span>
        </div>
      )}
    </div>
  );
}
