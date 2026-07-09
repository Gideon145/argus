'use client';

import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  noBorder?: boolean;
}

export function Card({ children, title, subtitle, action, className = '', padding = 'md', noBorder }: CardProps) {
  const pad = padding === 'none' ? 'p-0' : padding === 'sm' ? 'p-4' : padding === 'lg' ? 'p-6' : 'p-5';
  return (
    <div className={`bg-bg-secondary rounded-lg ${noBorder ? '' : 'border border-border'} ${className}`}>
      {(title || action) && (
        <div className={`flex items-center justify-between ${pad} ${!noBorder ? 'border-b border-border' : ''}`}>
          <div>
            {title && <h3 className="text-sm font-semibold text-text-primary">{title}</h3>}
            {subtitle && <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>}
          </div>
          {action && <div className="flex items-center gap-2">{action}</div>}
        </div>
      )}
      <div className={pad}>{children}</div>
    </div>
  );
}
