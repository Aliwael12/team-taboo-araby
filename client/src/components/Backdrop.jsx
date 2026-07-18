// Fixed, animated gradient-mesh background. Slowly drifting blurred neon blobs
// over near-black, plus a faint grid — the signature "arcade" atmosphere.
export default function Backdrop({ tint }) {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-ink-950">
      <div
        className="absolute -left-[20%] -top-[15%] h-[55vh] w-[55vh] rounded-full bg-neon-violet/30 blur-[90px] animate-drift1"
      />
      <div
        className="absolute -right-[20%] top-[10%] h-[50vh] w-[50vh] rounded-full bg-neon-cyan/25 blur-[90px] animate-drift2"
      />
      <div
        className="absolute bottom-[-20%] left-[15%] h-[55vh] w-[55vh] rounded-full bg-neon-pink/20 blur-[100px] animate-drift3"
      />
      {tint && (
        <div
          className="absolute left-1/2 top-1/3 h-[60vh] w-[60vh] -translate-x-1/2 rounded-full blur-[110px] opacity-30 transition-colors duration-700"
          style={{ background: tint }}
        />
      )}
      {/* faint grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
          maskImage: 'radial-gradient(ellipse at 50% 40%, black 40%, transparent 85%)',
          WebkitMaskImage: 'radial-gradient(ellipse at 50% 40%, black 40%, transparent 85%)',
        }}
      />
      {/* top vignette for status-bar legibility */}
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/50 to-transparent" />
    </div>
  );
}
