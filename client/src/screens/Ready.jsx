import { useEffect, useState } from 'react';

// Shown before each turn. The turn's describer taps Start to begin the clock;
// everyone else waits. If the describer is offline, the host can skip the turn.
export default function Ready({ state, actions }) {
  const { turn, youId, players, isHost } = state;
  const [starting, setStarting] = useState(false);

  // Re-arm the button for each new turn, and un-stick it if the server didn't
  // flip the phase (e.g. the tap raced a reconnect — it's queued and retried).
  useEffect(() => setStarting(false), [turn && turn.index]);
  useEffect(() => {
    if (!starting) return;
    const t = setTimeout(() => setStarting(false), 3000);
    return () => clearTimeout(t);
  }, [starting]);

  if (!turn) return null;
  const youAreDescriber = turn.describerId === youId;
  const role = turn.role;
  const accent = youAreDescriber ? '#a3e635' : role === 'guesser' ? '#22d3ee' : turn.teamColor;

  const describer = players.find((p) => p.id === turn.describerId);
  const describerOffline = !describer || !describer.connected;

  return (
    <div className="app-shell flex flex-col items-center justify-center px-6 text-center">
      <div
        className="chip mb-4 animate-riseIn bg-white/[0.06] font-display text-white/80"
        style={{ boxShadow: `0 0 20px -6px ${accent}` }}
      >
        {youAreDescriber ? '🎤 Your turn' : role === 'guesser' ? '⌨️ Get ready to guess' : '👀 Up next'}
      </div>

      <div className="mb-1 animate-riseIn text-sm font-semibold uppercase tracking-[0.3em] text-white/40">Next up</div>
      <div className="animate-riseIn font-display text-3xl font-black" style={{ color: turn.teamColor, textShadow: `0 0 26px ${turn.teamColor}` }}>
        {turn.teamName}
      </div>
      <div className="mb-8 mt-1 animate-riseIn font-display text-xl font-semibold">
        {youAreDescriber ? "You're describing!" : `${turn.describerName} is describing`}
      </div>

      {youAreDescriber ? (
        <>
          <button
            onClick={() => { setStarting(true); actions.startTurn(); }}
            disabled={starting}
            className="btn-lime animate-popIn px-10 py-5 text-2xl"
            style={{ boxShadow: `0 14px 44px -8px ${accent}` }}
          >
            {starting ? 'Starting…' : '▶ Start my turn'}
          </button>
          <div className="mt-6 max-w-xs animate-riseIn text-white/55">
            You'll get 5 words and {state.settings.turnSeconds} seconds. Describe them without saying the word — tap Start when your team's ready.
          </div>
        </>
      ) : (
        <>
          <div className="animate-pulseGlow font-display text-lg text-white/70">
            Waiting for {turn.describerName} to start…
          </div>
          <div className="mt-4 max-w-xs text-white/45">
            {role === 'guesser' ? 'Get your fingers ready — type every word you can guess!' : `Watch ${turn.teamName} take their turn.`}
          </div>
          {isHost && describerOffline && (
            <button onClick={actions.skipTurn} className="btn-ghost mt-8 px-6 py-3 text-base">
              ⏭ Skip turn — {turn.describerName} looks offline
            </button>
          )}
        </>
      )}
    </div>
  );
}
