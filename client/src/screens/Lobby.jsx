import { useState } from 'react';
import Share from '../components/Share';

// A player token. Tapping the body runs the main action (assign/select);
// the host also gets a small ✕ to kick that player out of the room.
function PlayerPill({ label, you, selected, ring, boxShadow, disabled, canKick, onMain, onKick, mainTitle }) {
  const base = selected
    ? 'bg-neon-amber text-ink-950 shadow-glow-amber'
    : you
      ? 'bg-white text-ink-950'
      : 'bg-white/10 text-white';
  return (
    <span
      className={`inline-flex animate-popIn items-center rounded-full text-sm font-medium ${base} ${ring ? 'ring-1 ring-white/40' : ''}`}
      style={boxShadow ? { boxShadow } : undefined}
    >
      <button
        disabled={disabled}
        onClick={onMain}
        title={mainTitle || ''}
        className={`py-1.5 pl-3 ${canKick ? 'pr-1.5' : 'pr-3'} ${disabled ? '' : 'active:scale-95'}`}
      >
        {label}{you ? ' (you)' : ''}
      </button>
      {canKick && (
        <button
          onClick={onKick}
          title="Kick from room"
          className="mr-1 grid h-5 w-5 place-items-center rounded-full opacity-50 transition hover:bg-red-500/40 hover:text-red-100 hover:opacity-100 active:scale-90"
        >
          ✕
        </button>
      )}
    </span>
  );
}

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
        <h1 className="font-display text-3xl font-black">Lobby</h1>
        <div className="flex items-center gap-2">
          <span className="chip bg-white/[0.06] text-white/60">
            <span className="h-2 w-2 rounded-full bg-neon-green shadow-glow-green" /> {players.length} player{players.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => actions.leave()}
            className="chip border border-white/10 bg-white/[0.05] text-white/70 active:scale-95"
          >
            ✕ Leave
          </button>
        </div>
      </div>

      <Share code={code} />

      {!isHost && (
        <div className="glass-soft mt-4 p-4 text-center">
          {yourTeam ? (
            <div className="text-lg">
              You're on{' '}
              <span className="font-display font-bold" style={{ color: yourTeam.color, textShadow: `0 0 16px ${yourTeam.color}` }}>
                {yourTeam.name}
              </span>
            </div>
          ) : (
            <div className="text-white/50">Waiting for the host to put you on a team…</div>
          )}
        </div>
      )}

      {/* Teams */}
      <div className="mt-4 space-y-3">
        {teams.map((t) => {
          const count = t.playerIds.length;
          const ready = count >= 2;
          return (
            <div key={t.id} className="glass overflow-hidden p-0">
              <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${t.color}, transparent)` }} />
              <div className="p-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: t.color, boxShadow: `0 0 10px ${t.color}` }} />
                    {isHost ? (
                      <input
                        defaultValue={t.name}
                        onBlur={(e) => e.target.value.trim() && actions.renameTeam(t.id, e.target.value.trim())}
                        className="w-36 min-w-0 rounded-lg bg-transparent px-1 font-display text-lg font-bold outline-none focus:bg-white/10"
                      />
                    ) : (
                      <span className="truncate font-display text-lg font-bold">{t.name}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`chip text-xs ${ready ? 'bg-neon-green/15 text-neon-green' : 'bg-white/[0.06] text-white/45'}`}>
                      {ready ? '✓ ready' : `${count}/2`}
                    </span>
                    {isHost && teams.length > 2 && (
                      <button onClick={() => actions.removeTeam(t.id)} className="px-1 text-white/35 active:scale-90">✕</button>
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
                      className="chip border-2 border-dashed border-white/25 text-white/70 active:scale-95"
                    >
                      ＋ place {nameOf(selected)}
                    </button>
                  )}
                  {count === 0 && !selected && <span className="py-1 text-sm text-white/25">No players yet</span>}
                </div>
              </div>
            </div>
          );
        })}

        {isHost && teams.length < 8 && (
          <button onClick={actions.addTeam} className="w-full rounded-2xl border-2 border-dashed border-white/15 py-3 text-white/50 transition active:scale-[0.99] hover:border-white/25">
            ＋ Add team
          </button>
        )}
      </div>

      {/* Unassigned players */}
      {unassigned.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35">
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
            <label className="glass-soft p-3.5">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-white/40">Win at</div>
              <div className="flex items-baseline gap-1">
                <input
                  type="number" min={10} max={200} step={2} defaultValue={settings.targetScore}
                  onChange={(e) => actions.setSettings({ targetScore: Number(e.target.value) })}
                  className="w-full bg-transparent font-display text-3xl font-bold outline-none"
                />
                <span className="text-sm text-white/40">pts</span>
              </div>
            </label>
            <label className="glass-soft p-3.5">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-white/40">Per turn</div>
              <div className="flex items-baseline gap-1">
                <input
                  type="number" min={15} max={120} step={5} defaultValue={settings.turnSeconds}
                  onChange={(e) => actions.setSettings({ turnSeconds: Number(e.target.value) })}
                  className="w-full bg-transparent font-display text-3xl font-bold outline-none"
                />
                <span className="text-sm text-white/40">sec</span>
              </div>
            </label>
          </div>

          <button disabled={!canStart.ok} onClick={actions.startGame} className="btn-lime w-full py-4 text-lg">
            {canStart.ok ? '▶  Start game' : canStart.reason}
          </button>
        </div>
      ) : (
        <div className="mt-6 text-center text-white/45">
          <span className="animate-pulseGlow font-display">Waiting for the host to start…</span>
        </div>
      )}
    </div>
  );
}
