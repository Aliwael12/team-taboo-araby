import { useEffect, useRef, useState } from 'react';
import { playTick } from '../lib/sound';

// Shared "how many seconds are left" clock — used by Timer itself and by any
// screen that wants to react to the countdown (e.g. an edge-glow at ≤10s)
// without duplicating the deadline math or double-firing the tick sound
// (that side effect lives only inside <Timer/> below).
export function useRemainingSeconds(deadline, offset = 0) {
  const calc = () =>
    deadline == null ? null : Math.max(0, Math.ceil((deadline - (Date.now() + offset)) / 1000));
  const [r, setR] = useState(calc);
  useEffect(() => {
    setR(calc());
    if (deadline == null) return;
    const id = setInterval(() => setR(calc()), 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline, offset]);
  return r;
}

// Circular countdown ring — brass→teal while there's time, chili + pulsing
// edge-glow in the last 10s, with a quiet tick each second in the last 5.
// Self-ticking: derives the remaining seconds from the server's `deadline`
// (epoch ms, corrected by `offset`) so only THIS component re-renders each
// tick — the rest of the app stays untouched.
export default function Timer({ deadline, total, offset = 0, size = 96 }) {
  const calc = () =>
    deadline == null ? null : Math.max(0, Math.ceil((deadline - (Date.now() + offset)) / 1000));
  const [r, setR] = useState(calc);
  const lastTickRef = useRef(null);

  useEffect(() => {
    lastTickRef.current = null;
    const tick = () => {
      const v = calc();
      setR(v);
      if (v != null && v > 0 && v <= 5 && lastTickRef.current !== v) {
        lastTickRef.current = v;
        playTick();
      }
    };
    tick();
    if (deadline == null) return;
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline, offset]);

  const shown = r == null ? total : r;
  const frac = total > 0 ? Math.max(0, Math.min(1, (shown || 0) / total)) : 0;
  const stroke = Math.max(6, Math.round(size * 0.085));
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const danger = shown != null && shown <= 10;
  const color = danger ? '#E4572E' : '#2EC4B6';
  const gid = `tg-${size}`;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 overflow-visible">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={danger ? '#FF7A50' : '#FFC46B'} />
            <stop offset="100%" stopColor={danger ? '#E4572E' : '#2EC4B6'} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(244,232,216,0.1)" strokeWidth={stroke} fill="none" />
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
        className={`absolute inset-0 flex items-center justify-center font-display tabnum ${
          danger ? 'text-chili animate-pulseEdge' : 'text-sand'
        }`}
        style={{ fontSize: size * 0.36 }}
      >
        {shown == null ? '—' : shown}
      </div>
    </div>
  );
}
