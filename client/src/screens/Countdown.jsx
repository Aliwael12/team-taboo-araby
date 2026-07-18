import { useEffect, useState } from 'react';

// Brief "get ready" screen before each turn. Server controls the real timing;
// this animates a 3-2-1 and tells each player their role for the turn.
export default function Countdown({ state }) {
  const { turn, youId } = state;
  const [n, setN] = useState(3);

  useEffect(() => {
    setN(3);
    const id = setInterval(() => setN((v) => (v > 1 ? v - 1 : v)), 1000);
    return () => clearInterval(id);
  }, [turn && turn.index]);

  if (!turn) return null;
  const youAreDescriber = turn.describerId === youId;
  const role = turn.role;

  let badge, headline, sub, accent;
  if (youAreDescriber) {
    badge = '🎤 Your turn';
    headline = "You're describing!";
    sub = 'Get your team to guess all 5 words';
    accent = '#a3e635';
  } else if (role === 'guesser') {
    badge = '⌨️ Get ready to guess';
    headline = `${turn.describerName} is describing`;
    sub = 'Type every word you can — fast!';
    accent = '#22d3ee';
  } else {
    badge = '👀 Spectating';
    headline = `${turn.teamName}'s turn`;
    sub = `${turn.describerName} is up`;
    accent = turn.teamColor;
  }

  return (
    <div className="app-shell flex flex-col items-center justify-center px-6 text-center">
      <div className="chip mb-4 animate-riseIn bg-white/[0.06] font-display text-white/80" style={{ boxShadow: `0 0 20px -6px ${accent}` }}>
        {badge}
      </div>
      <div className="mb-1 animate-riseIn text-sm font-semibold uppercase tracking-[0.3em] text-white/40">Next up</div>
      <div className="animate-riseIn font-display text-3xl font-black" style={{ color: turn.teamColor, textShadow: `0 0 26px ${turn.teamColor}` }}>
        {turn.teamName}
      </div>
      <div className="mb-8 mt-1 animate-riseIn font-display text-xl font-semibold">{headline}</div>

      <div className="relative flex h-40 w-40 items-center justify-center">
        <div className="absolute inset-0 rounded-full border border-white/10" />
        <div className="absolute inset-0 animate-pulseGlow rounded-full" style={{ boxShadow: `0 0 60px -10px ${accent}`, background: `radial-gradient(circle, ${accent}22, transparent 70%)` }} />
        <div key={n} className="animate-countPop font-display text-8xl font-black tabnum" style={{ textShadow: `0 0 30px ${accent}` }}>
          {n}
        </div>
      </div>

      <div className="mt-8 max-w-xs animate-riseIn text-white/55">{sub}</div>
    </div>
  );
}
