import { useState } from 'react';

// Landing screen: create a new game, or join by code (prefilled from an invite).
export default function Home({ initialCode, onCreate, onJoin, error, busy }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState(initialCode || '');
  const [mode, setMode] = useState(initialCode ? 'join' : 'choose'); // choose | create | join

  const canCreate = name.trim().length > 0;
  const canJoin = name.trim().length > 0 && code.trim().length >= 3;

  return (
    <div className="app-shell flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        {/* Hero */}
        <div className="mb-9 text-center">
          <div className="mb-3 inline-flex h-20 w-20 items-center justify-center rounded-[1.5rem] bg-violet-cyan text-4xl shadow-glow-violet">
            🎯
          </div>
          <h1 className="font-display text-[2.75rem] font-black leading-none tracking-tight">
            Team&nbsp;
            <span className="bg-violet-cyan bg-clip-text text-transparent" style={{ WebkitTextFillColor: 'transparent' }}>
              Taboo
            </span>
          </h1>
          <p className="mt-3 text-white/55">Describe the words. Beat the clock.<br />Win as a team.</p>
        </div>

        <div className="glass p-5">
          <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">Your name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Alex"
            maxLength={20}
            className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3.5 text-lg outline-none transition focus:border-neon-violet/60 focus:ring-2 focus:ring-neon-violet/30 placeholder:text-white/30"
          />

          {mode !== 'create' && (
            <>
              <label className="mb-1.5 mt-4 block text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">Room code</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="ABCD"
                maxLength={6}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3.5 text-center text-2xl font-bold uppercase tracking-[0.4em] outline-none transition focus:border-neon-cyan/60 focus:ring-2 focus:ring-neon-cyan/30 placeholder:tracking-[0.4em] placeholder:text-white/25"
              />
            </>
          )}

          {error && (
            <div className="mt-3 animate-popIn rounded-xl border border-neon-red/30 bg-neon-red/15 px-4 py-2.5 text-center text-sm text-neon-red">
              {error}
            </div>
          )}

          <div className="mt-5 space-y-2.5">
            {mode === 'create' ? (
              <>
                <button disabled={!canCreate || busy} onClick={() => onCreate(name.trim())} className="btn-primary w-full py-4 text-lg">
                  {busy ? 'Creating…' : '🎉 Create game'}
                </button>
                <button onClick={() => setMode('choose')} className="w-full py-2 text-sm text-white/45">← Back</button>
              </>
            ) : mode === 'join' ? (
              <>
                <button disabled={!canJoin || busy} onClick={() => onJoin(name.trim(), code.trim())} className="btn-lime w-full py-4 text-lg">
                  {busy ? 'Joining…' : '🚀 Join game'}
                </button>
                {!initialCode && (
                  <button onClick={() => setMode('choose')} className="w-full py-2 text-sm text-white/45">← Back</button>
                )}
              </>
            ) : (
              <>
                <button onClick={() => setMode('create')} className="btn-primary w-full py-4 text-lg">🎉 Host a new game</button>
                <button onClick={() => setMode('join')} className="btn-ghost w-full py-4 text-lg">🔑 Join with a code</button>
              </>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-white/30">4+ players · 2+ teams · plays on any phone</p>
      </div>
    </div>
  );
}
