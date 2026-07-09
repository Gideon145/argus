'use client';

interface StatusDotProps {
  status: 'online' | 'offline' | 'pending' | 'warning';
  size?: 'sm' | 'md';
  label?: string;
}

const STATUS_COLORS = {
  online:  '#22C55E',
  offline: '#EF4444',
  pending: '#F59E0B',
  warning: '#F59E0B',
};

export function StatusDot({ status, size = 'sm', label }: StatusDotProps) {
  const color = STATUS_COLORS[status];
  const dim = size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5';
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`${dim} rounded-full flex-shrink-0 ${status === 'online' || status === 'pending' ? 'animate-pulse-dot' : ''}`}
        style={{ backgroundColor: color }}
      />
      {label && <span className="text-xs text-text-secondary">{label}</span>}
    </span>
  );
}
