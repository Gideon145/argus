'use client';

import { useEffect, useState } from 'react';
import { QueryInput } from '@/components/QueryInput';
import { VerdictCard } from '@/components/VerdictCard';
import { TreasuryCounter } from '@/components/TreasuryCounter';
import { MetricCard } from '@/components/MetricCard';
import { TerminalLog } from '@/components/TerminalLog';

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL || 'http://localhost:3001';

export default function Home() {
  const [status, setStatus] = useState<any>({ queries: 0, consensusRate: '0', treasury: '0.00' });
  const [logs, setLogs] = useState<string[]>(['Argus standing by. Paste a contract address to begin.']);

  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`${AGENT_URL}/status`);
        const data = await res.json();
        setStatus(data);
      } catch {
        // Agent offline — keep last state
      }
    }, 2000);
    return () => clearInterval(poll);
  }, []);

  return (
    <main className="min-h-screen bg-[#0a0a0f] text-[#c9b37e]">
      {/* Header */}
      <header className="border-b border-[#c9b37e]/10 p-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-greek text-3xl tracking-[0.3em] glow-gold">ARGUS</h1>
            <p className="text-[#8b7640] text-sm tracking-[0.2em] mt-1">Τρεις οφθαλμοί. Μια κρίσις.</p>
          </div>
          <TreasuryCounter balance={status.treasury} queries={status.queries} />
        </div>
      </header>

      {/* Query Section */}
      <section className="max-w-5xl mx-auto p-6">
        <QueryInput onLog={(msg: string) => setLogs(prev => [...prev.slice(-6), msg])} />
      </section>

      {/* Metrics */}
      <section className="max-w-5xl mx-auto px-6 pb-6 grid grid-cols-3 gap-4">
        <MetricCard label="Total Queries" value={String(status.queries)} />
        <MetricCard label="Consensus Rate" value={`${status.consensusRate}%`} />
        <MetricCard label="Treasury" value={`$${status.treasury}`} />
      </section>

      {/* Terminal */}
      <section className="max-w-5xl mx-auto px-6 pb-12">
        <TerminalLog lines={logs} />
      </section>

      {/* Footer */}
      <footer className="border-t border-[#c9b37e]/10 p-4 text-center text-[#8b7640]/50 text-xs">
        Built on Arc · Settled on Arbitrum · Powered by Circle Gateway
      </footer>
    </main>
  );
}
