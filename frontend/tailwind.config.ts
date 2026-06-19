import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        cinzel: ['Cinzel', 'serif'],
        garamond: ['EB Garamond', 'serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        'bg-abyss': '#050816',
        'bg-slate': '#0E1423',
        gold: '#D4AF37',
        'gold-dim': '#8B7640',
        'text-primary': '#F8F8F5',
        'text-muted': '#8A92A6',
        emerald: '#2D8A6E',
        amber: '#C2821A',
        crimson: '#B83535',
        'agent-alpha': '#7eb8da',
        'agent-beta': '#d4af37',
        'agent-gamma': '#b57ed8',
      },
    },
  },
  plugins: [],
};

export default config;
