import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import Timer from '../components/Timer';

export default function Turn({ state, remaining, actions }) {
  const role = state.turn ? state.turn.role : 'spectator';
  if (role === 'describer') return <DescriberView state={state} remaining={remaining} />;
  if (role === 'guesser') return <GuesserView state={state} remaining={remaining} actions={actions} />;
  return <SpectatorView state={state} remaining={remaining} />;
}

// Renders a title in both scripts (whichever are present).
export function TitleCard({ display, solved, dim = false, size = 'lg' }) {
  const fr = display && display.fr;
  const ar = display && display.ar;
  const main = fr || ar;
  const sub = fr && ar ? ar : null;
  const mainIsAr = !fr && ar;
  const mainSize = size === 'lg' ? 'text-2xl' : 'text-lg';
  const muted = solved || dim;
  return (
    <div className={`min-w-0 ${dim ? 'opacity-50' : ''}`}>
      <div
        dir={mainIsAr ? 'rtl' : 'auto'}
        className={`font-display ${mainSize} font-bold leading-tight ${solved ? 'text-white/40 line-through' : ''}`}
      >
        {main}
      </div>
      {sub && (
        <div dir="rtl" className={`mt-0.5 text-base leading-tight ${muted ? 'text-white/25' : 'text-white/55'}`}>
          {sub}
        </div>
      )}
    </div>
  );
}

function ProgressDots({ total, solved }) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="h-2 flex-1 rounded-full transition-all duration-300"
          style={
            i < solved
              ? { background: '#4ade80', boxShadow: '0 0 10px #4ade80' }
              : { background: 'rgba(255,255,255,0.1)' }
          }
        />
      ))}
    </div>
  );
}

// ---- Describer: sees the 5 words, watches them get crossed off ----
function DescriberView({ state, remaining }) {
  const { turn } = state;
  const total = state.settings.turnSeconds;
  const solved = turn.words.filter((w) => w.solved).length;

  return (
    <div className="app-shell mx-auto flex w-full max-w-md flex-col px-4 py-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="chip bg-neon-lime/15 text-neon-lime">🎤 You're describing</div>
          <div className="mt-1 pl-1 text-sm text-white/45">{solved}/{turn.total} guessed</div>
        </div>
        <Timer remaining={remaining} total={total} size={78} />
      </div>

      <div className="glass-soft mb-3 px-4 py-2.5 text-center text-sm text-white/70">
        Describe these to your team — <b className="text-white">don't say the word!</b>
      </div>

      <div className="flex-1 space-y-2.5">
        {turn.words.map((w, i) => (
          <div
            key={i}
            className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 transition-all duration-300 ${
              w.solved
                ? 'animate-popIn border-neon-green/40 bg-neon-green/10'
                : 'border-white/10 bg-white/[0.05]'
            }`}
            style={w.solved ? { boxShadow: '0 0 22px -8px #4ade80' } : undefined}
          >
            <TitleCard display={w.display} solved={w.solved} />
            {w.solved ? (
              <span className="chip shrink-0 bg-neon-green/20 text-sm font-bold text-neon-green">
                +{w.points}{w.points === 1 ? ' ~' : ''}
              </span>
            ) : (
              <span className="text-2xl text-white/15">?</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Guesser: scratchpad. Type a word, Enter to submit. Unlimited guesses. ----
function GuesserView({ state, remaining, actions }) {
  const { turn } = state;
  const total = state.settings.turnSeconds;
  const [text, setText] = useState('');
  const [entries, setEntries] = useState([]); // { text, status }
  const [flash, setFlash] = useState(null);
  const listRef = useRef(null);

  useEffect(() => {
    setEntries([]);
    setText('');
  }, [turn.index]);

  useEffect(() => {
    return actions.onGuessResult((payload) => {
      setEntries((prev) => [...prev, { text: payload.text, status: payload.status }]);
      if (payload.status === 'exact' || payload.status === 'close') {
        setFlash(payload.status);
        setTimeout(() => setFlash(null), 500);
        try {
          if (navigator.vibrate) navigator.vibrate(payload.status === 'exact' ? 30 : 15);
        } catch {}
        confetti({
          particleCount: payload.status === 'exact' ? 28 : 12,
          spread: 60,
          startVelocity: 32,
          origin: { y: 0.75 },
          colors: payload.status === 'exact' ? ['#4ade80', '#22d3ee', '#a855f7'] : ['#fbbf24'],
          scalar: 0.8,
          disableForReducedMotion: true,
        });
      }
    });
  }, [actions]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [entries.length]);

  const submit = (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    actions.submitGuess(t);
    setText('');
  };

  const solved = turn.solvedCount || 0;

  return (
    <div className="app-shell mx-auto flex w-full max-w-md flex-col px-4 py-4">
      {flash && (
        <div
          className="pointer-events-none fixed inset-0 -z-0 animate-popIn"
          style={{ background: `radial-gradient(circle at 50% 70%, ${flash === 'exact' ? '#4ade8033' : '#fbbf2433'}, transparent 60%)` }}
        />
      )}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="chip bg-neon-cyan/15 text-neon-cyan">⌨️ Guess the words</div>
          <div className="mt-1 pl-1 text-sm text-white/45">
            <b className="text-white/70">{turn.describerName}</b> is describing · {solved}/{turn.total} found
          </div>
        </div>
        <Timer remaining={remaining} total={total} size={66} />
      </div>

      <div className="mb-3">
        <ProgressDots total={turn.total} solved={solved} />
      </div>

      <div ref={listRef} className="no-scrollbar mb-3 flex-1 space-y-1.5 overflow-y-auto">
        {entries.length === 0 && (
          <div className="mt-10 px-6 text-center text-sm text-white/35">
            Shout out guesses as single words — type each one and hit&nbsp;<b className="text-white/60">Enter</b>. Unlimited tries!
          </div>
        )}
        {entries.map((e, i) => (
          <div key={i} className={`flex animate-popIn items-center justify-between rounded-xl px-3.5 py-2.5 text-sm ${statusStyle(e.status)}`}>
            <span className="truncate font-medium">{e.text}</span>
            <span className="ml-2 shrink-0 font-semibold">{statusLabel(e.status)}</span>
          </div>
        ))}
      </div>

      <form onSubmit={submit} className="sticky bottom-0 flex gap-2 pt-1">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="send"
          placeholder="Type a guess…"
          className="flex-1 rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-4 text-lg outline-none transition focus:border-neon-cyan/60 focus:ring-2 focus:ring-neon-cyan/30 placeholder:text-white/30"
        />
        <button type="submit" className="btn-primary px-6 text-xl">↵</button>
      </form>
    </div>
  );
}

// ---- Spectator: other teams watch the clock + progress ----
function SpectatorView({ state, remaining }) {
  const { turn } = state;
  const total = state.settings.turnSeconds;
  const solved = turn.solvedCount || 0;
  return (
    <div className="app-shell mx-auto flex w-full max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="chip mb-6 bg-white/[0.06] text-white/60">👀 Spectating</div>
      <Timer remaining={remaining} total={total} size={128} />
      <div className="mt-6 font-display text-2xl font-black" style={{ color: turn.teamColor, textShadow: `0 0 22px ${turn.teamColor}` }}>
        {turn.teamName}'s turn
      </div>
      <div className="mt-1 text-white/55"><b className="text-white/80">{turn.describerName}</b> is describing</div>

      <div className="mt-7 flex gap-2">
        {Array.from({ length: turn.total }).map((_, i) => (
          <div
            key={i}
            className="h-3 w-9 rounded-full transition-all duration-300"
            style={i < solved ? { background: '#4ade80', boxShadow: '0 0 10px #4ade80' } : { background: 'rgba(255,255,255,0.1)' }}
          />
        ))}
      </div>
      <div className="mt-2 text-sm text-white/40">{solved}/{turn.total} words guessed</div>
      <div className="mt-9 text-xs text-white/30">Sit tight — your team is up soon.</div>
    </div>
  );
}

function statusStyle(status) {
  switch (status) {
    case 'exact':
      return 'bg-neon-green/15 text-neon-green ring-1 ring-neon-green/30';
    case 'close':
      return 'bg-neon-amber/15 text-neon-amber ring-1 ring-neon-amber/30';
    case 'duplicate':
      return 'bg-white/[0.04] text-white/45';
    default:
      return 'bg-white/[0.05] text-white/50';
  }
}
function statusLabel(status) {
  switch (status) {
    case 'exact':
      return '✅ +2';
    case 'close':
      return '🟡 +1 spelling';
    case 'duplicate':
      return 'already got';
    case 'describer':
      return '—';
    default:
      return '❌';
  }
}
