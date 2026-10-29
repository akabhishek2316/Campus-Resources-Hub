import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#14213D', soft: '#46536B', mute: '#7A869A' },
        bench: { DEFAULT: '#1B3F8B', dark: '#102A63', light: '#E8EFFC', line: '#C9D9F5' },
        paper: { DEFAULT: '#F2F5FA', card: '#FFFFFF', line: '#DCE3EE' },
        gold: { DEFAULT: '#E8A317', dark: '#B97F00', light: '#FFF4D6' },
        leaf: { DEFAULT: '#157347', light: '#E2F5EA' },
        amber2: { DEFAULT: '#9A6400', light: '#FFF1D6' },
        rust: { DEFAULT: '#B42318', light: '#FDECEA' },
        steel: { DEFAULT: '#6D4BC3', light: '#EEE9FB' },
      },
      fontFamily: {
        sans: ['var(--font-plex)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        mono: ['var(--font-plex-mono)', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};
export default config;
