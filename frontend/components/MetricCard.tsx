'use client';

interface Props {
  label: string;
  value: string;
}

export function MetricCard({ label, value }: Props) {
  return (
    <div className="bg-[#1a1a2e] border border-[#c9b37e]/10 rounded-lg p-4 text-center">
      <div className="text-xs text-[#8b7640]/60 tracking-wider mb-1">{label}</div>
      <div className="font-greek text-lg glow-gold">{value}</div>
    </div>
  );
}
