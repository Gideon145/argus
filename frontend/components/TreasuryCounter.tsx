'use client';

interface Props {
  balance: string;
  queries: number;
}

export function TreasuryCounter({ balance, queries }: Props) {
  return (
    <div className="text-right">
      <div className="text-xs text-[#8b7640]/60 tracking-wider">TREASURY</div>
      <div className="font-greek text-lg glow-gold">${balance}</div>
      <div className="text-xs text-[#8b7640]/50">{queries} queries</div>
    </div>
  );
}
