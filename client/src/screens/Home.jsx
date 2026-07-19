import { useState } from 'react';
import { unlockAudio } from '../lib/sound';

// Landing screen: create a new game, or join by code (prefilled from an invite).
export default function Home({ initialCode, onCreate, onJoin, error, busy }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState(initialCode || '');
  const [joinOpen, setJoinOpen] = useState(!!initialCode);
  const [howOpen, setHowOpen] = useState(false);

  const canCreate = name.trim().length > 0;
  const canJoin = name.trim().length > 0 && code.trim().length >= 3;

  const host = () => {
    unlockAudio();
    onCreate(name.trim());
  };
  const join = () => {
    unlockAudio();
    onJoin(name.trim(), code.trim());
  };

  return (
    <div className="app-shell flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        {/* Poster hero */}
        <div className="mb-9 text-center">
          <h1 className="font-display text-6xl leading-none text-sand text-glow-brass">Team Taboo</h1>
          <div className="mx-auto mt-2 h-[3px] w-40 origin-left animate-sweep rounded-full bg-brass-solid" />
          <p className="mt-4 text-sand/60">Describe the words. Beat the clock.<br />Win as a team.</p>
        </div>

        <div className="card p-5">
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.2em] text-sand/40">Your name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Alex"
            maxLength={20}
            className="w-full rounded-2xl border border-sand/10 bg-night-800 px-4 py-3.5 text-lg text-sand outline-none transition focus:border-brass/60 focus:ring-2 focus:ring-brass/30 placeholder:text-sand/30"
          />

          {error && (
            <div className="mt-3 animate-popIn rounded-xl border border-chili/30 bg-chili/15 px-4 py-2.5 text-center text-sm text-sand">
              {error}
            </div>
          )}

          <div className="mt-5 space-y-2.5">
            <button disabled={!canCreate || busy} onClick={host} className="btn-primary w-full py-4 text-xl">
              {busy ? 'Creating…' : '🎉 Host a game'}
            </button>
            <button onClick={() => setJoinOpen((v) => !v)} className="btn-ghost w-full py-4 text-xl">
              🔑 Join with a code
            </button>

            {joinOpen && (
              <div className="animate-riseIn space-y-2.5 pt-1">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  placeholder="ABCD"
                  maxLength={6}
                  autoFocus={!initialCode}
                  className="w-full rounded-2xl border border-sand/10 bg-night-800 px-4 py-3.5 text-center text-2xl tracking-[0.4em] text-sand outline-none transition focus:border-teal/60 focus:ring-2 focus:ring-teal/30 placeholder:tracking-[0.4em] placeholder:text-sand/25"
                />
                <button disabled={!canJoin || busy} onClick={join} className="btn-teal w-full py-4 text-xl">
                  {busy ? 'Joining…' : '🚀 Join game'}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4">
          <button
            onClick={() => setHowOpen((v) => !v)}
            className="w-full text-center text-xs font-semibold uppercase tracking-[0.2em] text-sand/35"
          >
            {howOpen ? '▴ Hide' : '▾ How to play'}
          </button>
          {howOpen && (
            <div className="animate-riseIn mt-2 space-y-1.5 rounded-2xl border border-sand/[0.06] bg-night-900/60 p-4 text-sm text-sand/60">
              <p>🎤 Your team's describer gets 5 words and 40 seconds — no saying the word!</p>
              <p>⌨️ Teammates type every guess (franco or عربي, both count) to score.</p>
              <p>🏆 Exact = +2, close spelling = +1. First team to the target wins.</p>
            </div>
          )}
        </div>

        <p className="mt-5 text-center text-xs text-sand/30">4+ players · 2+ teams · plays on any phone</p>
      </div>
    </div>
  );
}
