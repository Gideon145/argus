'use client';

import { useState } from 'react';

interface Props {
  onLog: (msg: string) => void;
}

export function QueryInput({ onLog }: Props) {
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!address.trim()) return;
    setLoading(true);
    onLog(`[Argus] Scanning ${address.slice(0, 10)}... — 3 agents analyzing`);

    // TODO: Wire to Gateway payment + orchestrator
    setTimeout(() => {
      onLog(`[Argus] Consensus reached — 2/3 agents agree. Verdict: SAFE`);
      setLoading(false);
    }, 2000);
  };

  return (
    <div className="flex gap-3">
      <input
        type="text"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="Paste token contract address..."
        className="flex-1 bg-[#1a1a2e] border border-[#c9b37e]/20 rounded px-4 py-3 text-[#c9b37e] placeholder-[#8b7640]/50 font-mono text-sm focus:outline-none focus:border-[#c9b37e]/50"
      />
      <button
        onClick={handleSubmit}
        disabled={loading || !address.trim()}
        className="font-greek bg-[#c9b37e]/10 border border-[#c9b37e]/30 rounded px-6 py-3 text-[#c9b37e] tracking-[0.15em] hover:bg-[#c9b37e]/20 disabled:opacity-30 transition-all"
      >
        {loading ? '...' : 'SCAN — $0.01'}
      </button>
    </div>
  );
}
