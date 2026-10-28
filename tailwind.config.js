/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        geometric: ['"Century Gothic"', 'Questrial', '"Plus Jakarta Sans"', 'sans-serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        neu: {
          base: 'var(--bg-neu)',
          dark: 'var(--shadow-dark)',
          light: 'var(--shadow-light)',
          text: 'var(--text-primary)',
          muted: 'var(--text-muted)',
          accent: 'var(--neu-accent)',
        },
      },
    },
  },
  plugins: [],
};
