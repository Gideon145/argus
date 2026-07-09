import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        'bg-primary':    '#0B0F1A',
        'bg-secondary':  '#111827',
        'bg-tertiary':   '#1F2937',
        'border':        '#1E293B',
        'border-active': '#334155',
        'text-primary':  '#F1F5F9',
        'text-secondary':'#94A3B8',
        'text-muted':    '#64748B',
        'accent':        '#3B82F6',
        'accent-dim':    '#1D4ED8',
        'critical':      '#EF4444',
        'warning':       '#F59E0B',
        'medium-sev':    '#EAB308',
        'success':       '#22C55E',
        'agent-alpha':   '#7EB8DA',
        'agent-beta':    '#D4AF37',
        'agent-gamma':   '#B57ED8',
      },
    },
  },
  plugins: [],
};

export default config;
