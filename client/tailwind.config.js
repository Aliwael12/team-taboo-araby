/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Lalezar: chunky poster type, first-class Arabic. Logo, titles, word cards, big numbers.
        display: ['Lalezar', 'system-ui', 'sans-serif'],
        // Rubik Variable: rounded, friendly, full Arabic support. Everything else.
        sans: ['"Rubik Variable"', 'system-ui', 'sans-serif'],
      },
      colors: {
        night: {
          950: '#120D0B',
          900: '#1B1512',
          800: '#241C17',
          700: '#2F251E',
        },
        sand: '#F4E8D8',
        brass: {
          DEFAULT: '#E8A33D',
          bright: '#FFC46B',
        },
        teal: '#2EC4B6',
        mint: '#5FD68A',
        amber: '#FFC53D',
        rose: '#F25477',
        chili: '#E4572E',
      },
      boxShadow: {
        card: '0 12px 32px -14px rgba(0,0,0,0.65), inset 0 1px 0 rgba(244,232,216,0.06)',
        'glow-brass': '0 0 24px -6px rgba(232,163,61,0.6)',
        'glow-teal': '0 0 24px -6px rgba(46,196,182,0.6)',
        'glow-mint': '0 0 24px -6px rgba(95,214,138,0.6)',
        'glow-amber': '0 0 24px -6px rgba(255,197,61,0.6)',
        'glow-rose': '0 0 24px -6px rgba(242,84,119,0.6)',
        'glow-chili': '0 0 28px -4px rgba(228,87,46,0.7)',
      },
      backgroundImage: {
        'brass-teal': 'linear-gradient(135deg, #FFC46B 0%, #E8A33D 55%, #2EC4B6 100%)',
        'brass-solid': 'linear-gradient(135deg, #FFC46B 0%, #E8A33D 100%)',
        'teal-solid': 'linear-gradient(135deg, #4FE0D1 0%, #2EC4B6 100%)',
        sheen: 'linear-gradient(180deg, rgba(244,232,216,0.16) 0%, rgba(244,232,216,0) 45%)',
      },
      keyframes: {
        // single transform-only ambient drift for the backdrop glow (GPU-cheap)
        driftGlow: {
          '0%,100%': { transform: 'translate(-50%,-50%) translate(0,0) scale(1)' },
          '50%': { transform: 'translate(-50%,-50%) translate(4vw,-3vh) scale(1.12)' },
        },
        popIn: { '0%': { transform: 'scale(0.85)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        riseIn: { '0%': { transform: 'translateY(10px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        countPop: { '0%': { transform: 'scale(0.4)', opacity: '0' }, '55%': { transform: 'scale(1.12)', opacity: '1' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        screenIn: { '0%': { opacity: '0', transform: 'translateY(8px) scale(0.995)' }, '100%': { opacity: '1', transform: 'translateY(0) scale(1)' } },
        pulseGlow: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.45' } },
        pulseEdge: { '0%,100%': { opacity: '0.35' }, '50%': { opacity: '0.85' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        sweep: { '0%': { transform: 'scaleX(0)' }, '100%': { transform: 'scaleX(1)' } },
      },
      animation: {
        driftGlow: 'driftGlow 36s ease-in-out infinite',
        popIn: 'popIn 0.28s cubic-bezier(0.34,1.56,0.64,1)',
        riseIn: 'riseIn 0.35s ease-out both',
        countPop: 'countPop 0.5s cubic-bezier(0.34,1.56,0.64,1)',
        screenIn: 'screenIn 0.32s ease-out both',
        pulseGlow: 'pulseGlow 1.4s ease-in-out infinite',
        pulseEdge: 'pulseEdge 1s ease-in-out infinite',
        shimmer: 'shimmer 2.5s linear infinite',
        sweep: 'sweep 0.6s cubic-bezier(0.34,1.56,0.64,1) both',
      },
    },
  },
  plugins: [],
};
