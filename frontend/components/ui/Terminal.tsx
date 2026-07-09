'use client';

import { useRef, useEffect } from 'react';

interface LogLine {
  timestamp?: string;
  level?: 'info' | 'warn' | 'error' | 'success' | 'debug';
  message: string;
}

interface TerminalProps {
  lines: LogLine[];
  title?: string;
  maxHeight?: string;
  className?: string;
  autoScroll?: boolean;
}

const LEVEL_COLORS: Record<string, string> = {
  info:    '#94A3B8',
  warn:    '#F59E0B',
  error:   '#EF4444',
  success: '#22C55E',
  debug:   '#64748B',
};

const LEVEL_LABELS: Record<string, string> = {
  info:    'INF',
  warn:    'WRN',
  error:   'ERR',
  success: 'OK ',
  debug:   'DBG',
};

function formatTime(ts?: string): string {
  if (ts) return ts;
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

export function Terminal({ lines, title = 'System Log', maxHeight = '320px', className = '', autoScroll = true }: TerminalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines, autoScroll]);

  return (
    <div className={`bg-[#0D1117] border border-border rounded-lg overflow-hidden ${className}`}>
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-[#0D1117]">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#EF4444]/60" />
          <span className="w-3 h-3 rounded-full bg-[#F59E0B]/60" />
          <span className="w-3 h-3 rounded-full bg-[#22C55E]/60" />
        </div>
        <span className="text-xs font-mono text-text-muted ml-2">{title}</span>
      </div>

      {/* Log content */}
      <div
        ref={scrollRef}
        className="overflow-y-auto font-mono text-[13px] leading-6 p-4 space-y-0"
        style={{ maxHeight }}
      >
        {lines.length === 0 ? (
          <div className="text-text-muted/40 text-center py-8">Waiting for events...</div>
        ) : (
          lines.map((line, i) => {
            const level = line.level || 'info';
            const color = LEVEL_COLORS[level];
            return (
              <div key={i} className="flex items-start gap-3 hover:bg-white/[0.02] px-1 -mx-1 rounded">
                <span className="text-text-muted/40 flex-shrink-0 select-none tabular-nums">
                  {formatTime(line.timestamp)}
                </span>
                <span className="flex-shrink-0 select-none" style={{ color }}>
                  {LEVEL_LABELS[level]}
                </span>
                <span className="text-text-secondary break-all">{line.message}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
