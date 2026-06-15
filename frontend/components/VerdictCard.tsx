'use client';

interface Props {
  agent: string;
  verdict: 'SAFE' | 'RISKY' | 'SCAM' | 'PENDING';
  confidence: number;
  reasoning: string;
  stake: string;
  color: string;
}

const verdictColors: Record<string, string> = {
  SAFE: 'text-emerald-400',
  RISKY: 'text-amber-400',
  SCAM: 'text-red-400',
  PENDING: 'text-[#8b7640]',
};

export function VerdictCard({ agent, verdict, confidence, reasoning, stake, color }: Props) {
  return (
    <div className="bg-[#1a1a2e] border border-[#c9b37e]/10 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="font-greek text-sm tracking-wider" style={{ color }}>
          {agent}
        </span>
        <span className={`font-bold text-sm ${verdictColors[verdict]}`}>
          {verdict}
        </span>
      </div>
      <p className="text-xs text-[#8b7640]/70 mb-2">{reasoning}</p>
      <div className="flex justify-between text-xs text-[#8b7640]/50">
        <span>Confidence: {confidence}%</span>
        <span>Stake: ${(parseInt(stake) / 1_000_000).toFixed(2)} USDC</span>
      </div>
    </div>
  );
}
