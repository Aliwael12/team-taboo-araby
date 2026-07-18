import { useEffect, useState } from 'react';

// Circular countdown ring with a neon glow.
// Self-ticking: derives the remaining seconds from the server's `deadline`
// (epoch ms, corrected by `offset`) so only THIS component re-renders each
// tick — the rest of the app stays untouched.
export default function Timer({ deadline, total, offset = 0, size = 96 }) {
  const calc = () =>
    deadline == null ? null : Math.max(0, Math.ceil((deadline - (Date.now() + offset)) / 1000));
  const [r, setR] = useState(calc);

  useEffect(() => {
    setR(calc());
    if (deadline == null) return;
    const id = setInterval(() => setR(calc()), 500);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline, offset]);

  const shown = r == null ? total : r;
  const frac = total > 0 ? Math.max(0, Math.min(1, (shown || 0) / total)) : 0;
  const stroke = Math.max(6, Math.round(size * 0.085));
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const danger = shown != null && shown <= 10;
  const color = danger ? '#fb7185' : '#22d3ee';
  const gid = `tg-${size}`;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 overflow-visible">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={danger ? '#fb7185' : '#a855f7'} />
            <stop offset="100%" stopColor={danger ? '#f43f5e' : '#22d3ee'} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={`url(#${gid})`}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - frac)}
          style={{
            transition: 'stroke-dashoffset 1s linear',
            filter: `drop-shadow(0 0 6px ${color})`,
          }}
        />
      </svg>
      <div
        className={`absolute inset-0 flex items-center justify-center font-display font-bold tabnum ${
          danger ? 'text-neon-red animate-pulseGlow' : 'text-white'
        }`}
        style={{ fontSize: size * 0.34 }}
      >
        {shown == null ? '—' : shown}
      </div>
    </div>
  );
}
