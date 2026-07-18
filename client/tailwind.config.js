/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Outfit Variable"', 'ui-rounded', 'system-ui', 'sans-serif'],
        sans: ['"Inter Variable"', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: {
          950: '#07070c',
          900: '#0b0b14',
          850: '#10101d',
          800: '#161627',
          700: '#1f1f36',
        },
        neon: {
          violet: '#a855f7',
          purple: '#8b5cf6',
          cyan: '#22d3ee',
          blue: '#38bdf8',
          lime: '#a3e635',
          green: '#4ade80',
          pink: '#f472b6',
          amber: '#fbbf24',
          red: '#fb7185',
        },
      },
      boxShadow: {
        card: '0 10px 40px -12px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06)',
        'glow-violet': '0 0 24px -2px rgba(168,85,247,0.55)',
        'glow-cyan': '0 0 24px -2px rgba(34,211,238,0.55)',
        'glow-green': '0 0 24px -2px rgba(74,222,128,0.55)',
        'glow-amber': '0 0 24px -2px rgba(251,191,36,0.55)',
      },
      backgroundImage: {
        'violet-cyan': 'linear-gradient(135deg, #a855f7 0%, #22d3ee 100%)',
        'lime-cyan': 'linear-gradient(135deg, #a3e635 0%, #22d3ee 100%)',
        'sheen': 'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 45%)',
      },
      keyframes: {
        drift1: {
          '0%,100%': { transform: 'translate(0,0) scale(1)' },
          '50%': { transform: 'translate(8vw,6vh) scale(1.15)' },
        },
        drift2: {
          '0%,100%': { transform: 'translate(0,0) scale(1.1)' },
          '50%': { transform: 'translate(-10vw,-4vh) scale(0.95)' },
        },
        drift3: {
          '0%,100%': { transform: 'translate(0,0) scale(1)' },
          '50%': { transform: 'translate(6vw,-8vh) scale(1.2)' },
        },
        popIn: { '0%': { transform: 'scale(0.85)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        riseIn: { '0%': { transform: 'translateY(10px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        countPop: { '0%': { transform: 'scale(0.4)', opacity: '0' }, '55%': { transform: 'scale(1.12)', opacity: '1' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        screenIn: { '0%': { opacity: '0', transform: 'translateY(8px) scale(0.995)' }, '100%': { opacity: '1', transform: 'translateY(0) scale(1)' } },
        pulseGlow: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.45' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        wiggle: { '0%,100%': { transform: 'rotate(-2deg)' }, '50%': { transform: 'rotate(2deg)' } },
      },
      animation: {
        drift1: 'drift1 18s ease-in-out infinite',
        drift2: 'drift2 22s ease-in-out infinite',
        drift3: 'drift3 26s ease-in-out infinite',
        popIn: 'popIn 0.28s cubic-bezier(0.34,1.56,0.64,1)',
        riseIn: 'riseIn 0.35s ease-out both',
        countPop: 'countPop 0.5s cubic-bezier(0.34,1.56,0.64,1)',
        screenIn: 'screenIn 0.35s ease-out both',
        pulseGlow: 'pulseGlow 1.4s ease-in-out infinite',
        shimmer: 'shimmer 2.5s linear infinite',
        wiggle: 'wiggle 0.4s ease-in-out',
      },
    },
  },
  plugins: [],
};
