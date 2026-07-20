import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import Timer, { useRemainingSeconds } from '../components/Timer';
import ScoreStrip from '../components/ScoreStrip';
import { playExact, playClose, playWrong } from '../lib/sound';

export default function Turn({ state, clockOffset, actions }) {
  const role = state.turn ? state.turn.role : 'spectator';
  if (role === 'describer') return <DescriberView state={state} clockOffset={clockOffset} />;
  if (role === 'guesser') return <GuesserView state={state} clockOffset={clockOffset} actions={actions} />;
  return <SpectatorView state={state} clockOffset={clockOffset} />;
}

// Renders a title in both scripts (whichever are present). Franco headline in
// display type, Arabic beneath in RTL — or Arabic solo, RTL, when that's all
// there is.
export function TitleCard({ display, solved, dim = false, size = 'lg' }) {
  const fr = display && display.fr;
  const ar = display && display.ar;
  const main = fr || ar;
  const sub = fr && ar ? ar : null;
  const mainIsAr = !fr && ar;
  const mainSize = size === 'lg' ? 'text-3xl' : 'text-xl';
  const muted = solved || dim;
  return (
    <div className={`min-w-0 ${dim ? 'opacity-50' : ''}`}>
      <div
        dir={mainIsAr ? 'rtl' : 'auto'}
        className={`font-display ${mainSize} leading-tight ${solved ? 'text-sand/40 line-through' : 'text-sand'}`}
      >
        {main}
      </div>
      {sub && (
        <div dir="rtl" className={`mt-0.5 text-base leading-tight ${muted ? 'text-sand/25' : 'text-sand/55'}`}>
          {sub}
        </div>
      )}
    </div>
  );
}

// Mint +2 for an exact hit, amber +1 for a right-but-misspelled one.
function PointsBadge({ points }) {
  const close = points === 1;
  return (
    <span className={`chip shrink-0 text-sm font-bold ${close ? 'bg-amber/20 text-amber' : 'bg-mint/20 text-mint'}`}>
      +{points}
      {close ? ' ~' : ''}
    </span>
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
              ? { background: '#5FD68A', boxShadow: '0 0 10px #5FD68A' }
              : { background: 'rgba(244,232,216,0.1)' }
          }
        />
      ))}
    </div>
  );
}

// A soft chili glow that fades in around the screen edges — the visual half
// of the "last 10 seconds" cue (the audible half lives in <Timer/>).
function EdgeGlow({ active }) {
  if (!active) return null;
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 animate-pulseEdge"
      style={{ boxShadow: 'inset 0 0 90px -10px rgba(228,87,46,0.55)' }}
    />
  );
}

// ---- Describer: sees the 5 words, watches them get crossed off ----
function DescriberView({ state, clockOffset }) {
  const { turn, teams } = state;
  const total = state.settings.turnSeconds;
  const solved = turn.words.filter((w) => w.solved).length;
  const remaining = useRemainingSeconds(turn.deadline, clockOffset);
  const danger = remaining != null && remaining <= 10;

  return (
    <div className="app-shell relative mx-auto flex w-full max-w-md flex-col px-4 py-4">
      <EdgeGlow active={danger} />
      <div className="relative z-10 mb-3">
        <ScoreStrip teams={teams} activeTeamId={turn.teamId} />
      </div>

      <div className="relative z-10 mb-3 flex items-center justify-between">
        <div>
          <div className="chip bg-mint/15 text-mint">🎤 You're describing</div>
          <div className="mt-1 pl-1 text-sm text-sand/45">{solved}/{turn.total} guessed</div>
        </div>
        <Timer deadline={turn.deadline} total={total} offset={clockOffset} size={78} />
      </div>

      <div className="card-soft relative z-10 mb-3 px-4 py-2.5 text-center text-sm text-sand/70">
        Describe these to your team — <b className="text-sand">don't say the word!</b>
      </div>

      <div className="relative z-10 flex-1 space-y-2.5">
        {turn.words.map((w, i) => (
          <div
            key={i}
            className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 transition-all duration-300 ${
              w.solved ? 'animate-popIn border-mint/40 bg-mint/10' : 'border-sand/10 bg-night-800'
            }`}
            style={w.solved ? { boxShadow: '0 0 22px -8px #5FD68A' } : undefined}
          >
            <TitleCard display={w.display} solved={w.solved} />
            {w.solved ? <PointsBadge points={w.points} /> : <span className="text-2xl text-sand/15">؟</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// Height of the VISIBLE viewport — shrinks when the mobile keyboard opens.
// Sizing the guesser screen to this keeps the timer pinned on-screen and the
// input box sitting right above the keyboard instead of hidden behind it.
function useVisibleViewportHeight() {
  const [height, setHeight] = useState(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      setHeight(vv.height);
      // iOS "helpfully" scrolls the page to reveal a focused input, shoving
      // the timer off-screen — pin the page back to the top.
      if (window.scrollY) window.scrollTo(0, 0);
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);
  return height;
}

// ---- Guesser: scratchpad. Type a word, Enter to submit. Unlimited guesses. ----
function GuesserView({ state, clockOffset, actions }) {
  const { turn, teams } = state;
  const total = state.settings.turnSeconds;
  const [text, setText] = useState('');
  const [entries, setEntries] = useState([]); // { id, text, status } — status 'pending' until the server rules
  const [flash, setFlash] = useState(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const lastSubmitRef = useRef({ t: '', at: 0 });

  useEffect(() => {
    setEntries([]);
    setText('');
  }, [turn.index]);

  useEffect(() => {
    return actions.onGuessResult((payload) => {
      setEntries((prev) => {
        const i = prev.findIndex((e) => e.id === payload.id && e.status === 'pending');
        if (i === -1) return [...prev, { id: payload.id || `srv${prev.length}`, text: payload.text, status: payload.status }];
        const copy = [...prev];
        copy[i] = { ...copy[i], status: payload.status };
        return copy;
      });
      // 'upgrade' = a corrected retype of a misspelled hit — celebrate like an exact.
      if (payload.status === 'exact' || payload.status === 'close' || payload.status === 'upgrade') {
        const close = payload.status === 'close';
        setFlash(close ? 'close' : 'exact');
        setTimeout(() => setFlash(null), 500);
        try {
          if (navigator.vibrate) navigator.vibrate(close ? 15 : 30);
        } catch {}
        if (close) playClose();
        else playExact();
        confetti({
          particleCount: payload.status === 'exact' ? 28 : payload.status === 'upgrade' ? 18 : 12,
          spread: 60,
          startVelocity: 32,
          origin: { y: 0.75 },
          colors: close ? ['#FFC53D'] : ['#5FD68A', '#2EC4B6', '#FFC46B'],
          scalar: 0.8,
          disableForReducedMotion: true,
        });
      } else if (payload.status === 'none') {
        playWrong();
      }
    });
  }, [actions]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [entries.length]);

  // Mobile browsers routinely dismiss the on-screen keyboard as part of the
  // Enter/Send key's native behavior, even though preventDefault() below
  // stops the form from actually navigating — the blur happens independently
  // of our JS. Re-focusing immediately (and once more next frame, since some
  // browsers blur asynchronously right after the handler returns) keeps the
  // keyboard open across rapid-fire guesses instead of closing after every word.
  const keepKeyboardOpen = () => {
    inputRef.current?.focus();
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const submit = (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) {
      keepKeyboardOpen();
      return;
    }
    // Swallow accidental double-submits of the same word (double Enter taps).
    const now = Date.now();
    if (lastSubmitRef.current.t === t.toLowerCase() && now - lastSubmitRef.current.at < 700) {
      setText('');
      keepKeyboardOpen();
      return;
    }
    lastSubmitRef.current = { t: t.toLowerCase(), at: now };
    // Optimistic echo: show it instantly, reconcile when the server answers.
    const id = actions.submitGuess(t);
    setEntries((prev) => [...prev, { id, text: t, status: 'pending' }]);
    setText('');
    keepKeyboardOpen();
  };

  const solved = turn.solvedCount || 0;
  const viewportHeight = useVisibleViewportHeight();

  // Fixed-height column (not min-height): sized to the VISIBLE viewport so
  // when the keyboard opens the guess list shrinks — the timer stays pinned
  // at the top and the input box stays glued just above the keyboard.
  return (
    <div
      className="relative mx-auto flex w-full max-w-md flex-col overflow-hidden px-4"
      style={{
        height: viewportHeight ? `${viewportHeight}px` : '100dvh',
        paddingTop: 'max(env(safe-area-inset-top), 0.75rem)',
        paddingBottom: 'max(env(safe-area-inset-bottom), 0.5rem)',
      }}
    >
      {flash && (
        <div
          className="pointer-events-none fixed inset-0 -z-0 animate-popIn"
          style={{ background: `radial-gradient(circle at 50% 70%, ${flash === 'exact' ? '#5FD68A33' : '#FFC53D33'}, transparent 60%)` }}
        />
      )}
      <div className="mb-2">
        <ScoreStrip teams={teams} activeTeamId={turn.teamId} />
      </div>
      <div className="mb-2 flex items-center justify-between">
        <div>
          <div className="chip bg-teal/15 text-teal">⌨️ Guess the words</div>
          <div className="mt-1 pl-1 text-sm text-sand/45">
            <b className="text-sand/70">{turn.describerName}</b> is describing · {solved}/{turn.total} found
          </div>
        </div>
        <Timer deadline={turn.deadline} total={total} offset={clockOffset} size={64} />
      </div>

      <div className="mb-2">
        <ProgressDots total={turn.total} solved={solved} />
      </div>

      <div ref={listRef} className="no-scrollbar mb-2 min-h-0 flex-1 space-y-1.5 overflow-y-auto">
        {entries.length === 0 && (
          <div className="mt-6 px-6 text-center text-sm text-sand/35">
            Tap the box below and type each guess — hit&nbsp;<b className="text-sand/60">Enter</b> to send.
            <br />
            <b className="text-sand/60">franco or عربي — both count!</b> Unlimited tries.
          </div>
        )}
        {entries.map((e) => (
          <div key={e.id} className={`flex animate-popIn items-center justify-between rounded-xl px-3.5 py-2.5 text-sm ${statusStyle(e.status)}`}>
            <span className="truncate font-medium" dir="auto">{e.text}</span>
            <span className="ml-2 shrink-0 font-semibold">{statusLabel(e.status)}</span>
          </div>
        ))}
      </div>

      {/* No autoFocus: the keyboard only opens when the player taps the box.
          Once open, it's meant to stay open across every guess — see submit(). */}
      <form onSubmit={submit} className="flex shrink-0 gap-2 pt-1">
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="send"
          dir="auto"
          placeholder="Type a guess…"
          className="flex-1 rounded-2xl border border-sand/10 bg-night-800 px-4 py-3.5 text-lg text-sand outline-none transition focus:border-teal/60 focus:ring-2 focus:ring-teal/30 placeholder:text-sand/30"
        />
        {/* preventDefault keeps focus in the input so the keyboard stays open. */}
        <button type="submit" onPointerDown={(e) => e.preventDefault()} className="btn-teal px-6 text-xl">↵</button>
      </form>
    </div>
  );
}

// ---- Spectator (opposing team): watches the words + how each gets marked ----
function SpectatorView({ state, clockOffset }) {
  const { turn, teams } = state;
  const total = state.settings.turnSeconds;
  const words = turn.words || [];
  const solved = turn.solvedCount || 0;

  return (
    <div className="app-shell mx-auto flex w-full max-w-md flex-col px-4 py-4">
      <div className="mb-3">
        <ScoreStrip teams={teams} activeTeamId={turn.teamId} />
      </div>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="chip bg-night-800 text-sand/60" style={{ boxShadow: `0 0 16px -8px ${turn.teamColor}` }}>
            👀 Watching <b style={{ color: turn.teamColor }} className="ml-1">{turn.teamName}</b>
          </div>
          <div className="mt-1 pl-1 text-sm text-sand/45">
            <b className="text-sand/70">{turn.describerName}</b> is describing · {solved}/{turn.total} found
          </div>
        </div>
        <Timer deadline={turn.deadline} total={total} offset={clockOffset} size={66} />
      </div>

      <div className="flex-1 space-y-2.5">
        {words.map((w, i) => (
          <div
            key={i}
            className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 transition-all duration-300 ${
              w.solved ? 'animate-popIn border-mint/40 bg-mint/10' : 'border-sand/10 bg-night-800'
            }`}
            style={w.solved ? { boxShadow: '0 0 22px -8px #5FD68A' } : undefined}
          >
            <TitleCard display={w.display} solved={w.solved} />
            {w.solved ? <PointsBadge points={w.points} /> : <span className="text-2xl text-sand/15">؟</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function statusStyle(status) {
  switch (status) {
    case 'exact':
    case 'upgrade':
      return 'bg-mint/15 text-mint ring-1 ring-mint/30';
    case 'close':
      return 'bg-amber/15 text-amber ring-1 ring-amber/30';
    case 'duplicate':
    case 'inactive':
      return 'bg-sand/[0.04] text-sand/45';
    case 'pending':
      return 'bg-sand/[0.05] text-sand/40';
    default:
      return 'bg-sand/[0.05] text-sand/50';
  }
}
function statusLabel(status) {
  switch (status) {
    case 'exact':
      return '✅ +2';
    case 'upgrade':
      return '✅ +1 fixed';
    case 'close':
      return '🟡 +1 spelling';
    case 'duplicate':
      return 'already got';
    case 'pending':
      return '…';
    case 'inactive':
      return '⏱ turn over';
    case 'describer':
      return '—';
    default:
      return '❌';
  }
}
