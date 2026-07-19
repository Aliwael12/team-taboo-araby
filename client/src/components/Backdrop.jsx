// Fixed, GPU-cheap background: a night base, a faint khayamiya (tentmaker
// appliqué) star-and-lattice tile, ONE ambient glow that drifts via a
// transform-only animation (no blur re-paint per frame), and a top vignette
// for status-bar legibility. Tints toward the active team's color mid-game.
export default function Backdrop({ tint }) {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-night-950">
      {/* single drifting glow — brass/teal by default, shifts to the active team color */}
      <div
        className="absolute left-1/2 top-[38%] h-[70vmax] w-[70vmax] animate-driftGlow rounded-full blur-[70px] transition-[background] duration-1000"
        style={{
          background: tint
            ? `radial-gradient(circle, ${tint}33 0%, ${tint}00 70%)`
            : 'radial-gradient(circle, rgba(232,163,61,0.18) 0%, rgba(46,196,182,0.10) 45%, transparent 72%)',
        }}
      />

      {/* khayamiya star-and-lattice tile, ~4% sand opacity */}
      <svg className="absolute inset-0 h-full w-full opacity-[0.05]" preserveAspectRatio="none">
        <defs>
          <pattern id="khayamiya" width="80" height="80" patternUnits="userSpaceOnUse">
            {/* corner squares (combine across tiles into full diamonds-in-a-grid) */}
            <rect x="-8" y="-8" width="16" height="16" fill="none" stroke="#F4E8D8" strokeWidth="1.5" />
            <rect x="72" y="-8" width="16" height="16" fill="none" stroke="#F4E8D8" strokeWidth="1.5" />
            <rect x="-8" y="72" width="16" height="16" fill="none" stroke="#F4E8D8" strokeWidth="1.5" />
            <rect x="72" y="72" width="16" height="16" fill="none" stroke="#F4E8D8" strokeWidth="1.5" />
            {/* center star (rotated square) */}
            <path d="M40,10 L70,40 L40,70 L10,40 Z" fill="none" stroke="#F4E8D8" strokeWidth="1.5" />
            <path d="M40,24 L56,40 L40,56 L24,40 Z" fill="none" stroke="#F4E8D8" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#khayamiya)" />
      </svg>

      {/* top vignette so status bars / floating chips stay legible */}
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/45 to-transparent" />
    </div>
  );
}
