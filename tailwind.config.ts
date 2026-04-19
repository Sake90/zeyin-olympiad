import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        zeyin: {
          bg:     '#06100f',
          card:   '#0c1a19',
          border: '#0f2422',
          teal:   '#1ec8c8',
          teal2:  '#0fa8a8',
          pink:   '#d4145a',
          pink2:  '#e8206e',
          orange: '#f47920',
        },
        cab: {
          bg:      '#0a0d14',
          card:    '#111520',
          text:    '#e8eaf0',
          muted:   '#6b7280',
          green:   '#22c55e',
          teal:    '#1ec8c8',
          teal2:   '#0fa8a8',
          magenta: '#d4145a',
          orange:  '#f47920',
        },
      },
      fontFamily: {
        unbounded: ['var(--font-unbounded)', 'system-ui', 'sans-serif'],
        geologica: ['var(--font-geologica)', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        cabFadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        cabPulse: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(30,200,200,0.5)' },
          '50%':      { boxShadow: '0 0 0 8px rgba(30,200,200,0)' },
        },
      },
      animation: {
        'cab-fade-up': 'cabFadeUp 0.35s ease both',
        'cab-pulse': 'cabPulse 1.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
export default config;
