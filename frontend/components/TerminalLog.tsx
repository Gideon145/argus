'use client';

interface Props {
  lines: string[];
}

export function TerminalLog({ lines }: Props) {
  return (
    <div className="bg-[#0a0a0f] border border-[#c9b37e]/10 rounded-lg p-4 font-mono text-xs">
      <div className="text-[#8b7640]/50 mb-2 tracking-wider">SYSTEM LOG</div>
      {lines.map((line, i) => (
        <div key={i} className="text-[#c9b37e]/50 py-0.5">
          <span className="text-[#8b7640]/30">{`[${String(i).padStart(2, '0')}] `}</span>
          {line}
        </div>
      ))}
    </div>
  );
}
