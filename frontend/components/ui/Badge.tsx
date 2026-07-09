'use client';

import { VERDICT_CONFIG, SEVERITY_COLORS } from '@/lib/constants';

type BadgeVariant = 'verdict' | 'severity' | 'status';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
}

function getColors(label: string, variant: BadgeVariant) {
  const upper = label.toUpperCase();
  if (variant === 'verdict') {
    const config = VERDICT_CONFIG[upper];
    if (config) return { color: config.color, bg: config.bg, border: config.border };
  }
  if (variant === 'severity') {
    const color = SEVERITY_COLORS[upper];
    if (color) return { color, bg: `${color}10`, border: `${color}25` };
  }
  if (variant === 'status') {
    if (upper === 'ONLINE' || upper === 'ACTIVE' || upper === 'RUNNING') return { color: '#22C55E', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.15)' };
    if (upper === 'OFFLINE' || upper === 'ERROR') return { color: '#EF4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.15)' };
  }
  return { color: '#94A3B8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.15)' };
}

export function Badge({ label, variant = 'verdict', size = 'sm' }: BadgeProps) {
  const { color, bg, border } = getColors(label, variant);
  return (
    <span
      className={`inline-flex items-center font-medium tracking-wide uppercase rounded-md ${
        size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1'
      }`}
      style={{ color, backgroundColor: bg, border: `1px solid ${border}` }}
    >
      {label}
    </span>
  );
}
