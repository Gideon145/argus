'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL || 'http://localhost:3001';

interface StatsData {
  queries: number; consensusReached: number; onChainRecords: number; avgConfidence: number; status: string;
}
interface PoolData { total: number; assigned: number; available: number; }
interface TreasuryData { treasury: { address: string; balance: string }; funding: { address: string; balance: string }; stats: StatsData }
interface EloAgent { name: string; elo: number; accuracy: number; wins: number; losses: number; }
interface EloData { agents: EloAgent[]; }
interface PaymentData { totalPayments: number; totalVolume: string; recent: any[]; }

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl p-5 sm:p-6 border ${accent ? 'border-[#3CB878]/30 bg-[#3CB878]/[0.04]' : 'border-[#D4AF37]/10 bg-[#0E1423]'}`}>
      <p className="text-xs font-mono uppercase tracking-wider text-[#8A92A6]/60 mb-2">{label}</p>
      <p className={`text-3xl sm:text-4xl font-bold font-cinzel tracking-wider ${accent ? 'text-[#3CB878]' : 'text-[#F8F8F5]'}`}>{value}</p>
      {sub && <p className="text-xs font-mono text-[#8A92A6]/40 mt-1">{sub}</p>}
    </div>
  );
}

function AgentBar({ agent, rank }: { agent: EloAgent; rank: number }) {
  const colors = ['#7eb8da', '#D4AF37', '#b57ed8'];
  const barWidth = Math.min(100, Math.max(10, agent.accuracy));
  return (
    <div className="border border-[#D4AF37]/8 rounded-xl p-4 bg-[#0E1423]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-cinzel text-lg tracking-wider" style={{ color: colors[rank] }}>{agent.name}</span>
          <span className="text-xs font-mono text-[#8A92A6]/40">#{rank + 1}</span>
        </div>
        <span className="text-xs font-mono text-[#8A92A6]/60">{agent.wins}W / {agent.losses}L</span>
      </div>
      <div className="flex items-center justify-between text-sm mb-2">
        <span className="font-mono text-[#8A92A6]/60">ELO</span>
        <span className="font-mono text-[#F8F8F5] font-bold">{agent.elo}</span>
      </div>
      <div className="flex items-center justify-between text-sm mb-3">
        <span className="font-mono text-[#8A92A6]/60">Accuracy</span>
        <span className="font-mono" style={{ color: colors[rank] }}>{agent.accuracy}%</span>
      </div>
      <div className="w-full h-2 rounded-full bg-[#F8F8F5]/5">
        <motion.div className="h-2 rounded-full" style={{ background: colors[rank], width: `${barWidth}%` }}
          initial={{ width: 0 }} animate={{ width: `${barWidth}%` }} transition={{ duration: 1, ease: 'easeOut' }} />
      </div>
    </div>
  );
}

export default function StatsPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [pool, setPool] = useState<PoolData | null>(null);
  const [treasury, setTreasury] = useState<TreasuryData | null>(null);
  const [elo, setElo] = useState<EloData | null>(null);
  const [payments, setPayments] = useState<PaymentData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const poll = async () => {
      try {
        const [s, p, t, e, ap] = await Promise.all([
          fetch(`${AGENT_URL}/stats`).then(r => r.ok ? r.json() : null),
          fetch(`${AGENT_URL}/wallet/pool-stats`).then(r => r.ok ? r.json() : null),
          fetch(`${AGENT_URL}/treasury`).then(r => r.ok ? r.json() : null),
          fetch(`${AGENT_URL}/elo`).then(r => r.ok ? r.json() : null),
          fetch(`${AGENT_URL}/agent-payments`).then(r => r.ok ? r.json() : null),
        ]);
        if (s) setStats(s);
        if (p) setPool(p);
        if (t) setTreasury(t);
        if (e) setElo(e);
        if (ap) setPayments(ap);
        setError('');
      } catch {
        setError('Agent API unreachable. Retrying...');
      }
    };
    poll();
    const i = setInterval(poll, 15000);
    return () => clearInterval(i);
  }, []);

  return (
    <div className="min-h-screen bg-[#050816] text-[#F8F8F5]">
      <div className="fixed inset-0 z-0"><div className="starfield" /></div>
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        
        <header className="mb-10">
          <a href="/" className="font-cinzel text-sm text-[#D4AF37]/60 tracking-[0.2em] hover:text-[#D4AF37] transition-colors">← ARGUS</a>
          <h1 className="font-cinzel text-3xl sm:text-4xl font-bold tracking-wider text-[#D4AF37] mt-4">Live Stats</h1>
          <p className="text-sm text-[#8A92A6]/60 mt-2 font-mono">Every number is read directly from the agent API. Refreshes every 15 seconds.</p>
          {error && <p className="text-[#E85555] text-xs font-mono mt-3">{error}</p>}
        </header>

        {stats && (
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-10">
            <StatCard label="Scans" value={(stats.queries || 0).toString()} sub={`${stats.consensusReached || 0} consensus · ${stats.avgConfidence || 0}% avg`} accent />
            <StatCard label="Users" value={(pool?.assigned || 0).toString()} sub={`${pool?.available || 0} available · ${pool?.total || 0} pool`} />
            <StatCard label="Treasury" value={`$${parseFloat(treasury?.treasury?.balance || '0').toFixed(2)}`} sub="USDC · Arc testnet" />
            <StatCard label="Agent Payments" value={(payments?.totalPayments || 0).toString()} sub={`$${parseFloat(payments?.totalVolume || '0').toFixed(3)} volume`} />
          </section>
        )}

        {elo?.agents && (
          <section className="mb-10">
            <h2 className="font-cinzel text-lg tracking-wider text-[#D4AF37]/80 mb-4 uppercase">Agent Economy</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {elo.agents.slice(0, 3).map((a, i) => <AgentBar key={a.name} agent={a} rank={i} />)}
            </div>
          </section>
        )}

        {treasury && (
          <section className="mb-10">
            <h2 className="font-cinzel text-lg tracking-wider text-[#D4AF37]/80 mb-4 uppercase">On-Chain Addresses</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <a href={`https://testnet.arcscan.app/address/${treasury.treasury.address}`} target="_blank" rel="noopener noreferrer" 
                className="block border border-[#D4AF37]/10 rounded-xl p-4 bg-[#0E1423] hover:border-[#D4AF37]/30 transition-colors">
                <p className="text-xs font-mono uppercase tracking-wider text-[#8A92A6]/60 mb-1">Treasury</p>
                <p className="font-mono text-sm text-[#F8F8F5] break-all">{treasury.treasury.address}</p>
                <p className="text-xs font-mono text-[#3CB878] mt-1">${parseFloat(treasury.treasury.balance).toFixed(2)} USDC</p>
              </a>
              <a href={`https://testnet.arcscan.app/address/${treasury.funding.address}`} target="_blank" rel="noopener noreferrer"
                className="block border border-[#D4AF37]/10 rounded-xl p-4 bg-[#0E1423] hover:border-[#D4AF37]/30 transition-colors">
                <p className="text-xs font-mono uppercase tracking-wider text-[#8A92A6]/60 mb-1">Funding Wallet</p>
                <p className="font-mono text-sm text-[#F8F8F5] break-all">{treasury.funding.address}</p>
                <p className="text-xs font-mono text-[#3CB878] mt-1">${parseFloat(treasury.funding.balance).toFixed(2)} USDC</p>
              </a>
            </div>
          </section>
        )}

        {payments && (payments.totalPayments || 0) > 0 && (
          <section className="mb-10">
            <h2 className="font-cinzel text-lg tracking-wider text-[#D4AF37]/80 mb-4 uppercase">Recent Agent Payments</h2>
            <div className="space-y-2">
              {(payments.recent || []).slice(0, 6).map((p: any, i: number) => (
                <div key={i} className="border border-[#D4AF37]/8 rounded-lg p-3 bg-[#0E1423] flex items-center justify-between text-xs font-mono">
                  <span className="text-[#8A92A6]/60">{p.from} → {p.to}</span>
                  <span className="text-[#D4AF37]">{p.amount} USDC</span>
                  <a href={`https://testnet.arcscan.app/tx/${p.txHash}`} target="_blank" rel="noopener noreferrer" className="text-[#8A92A6]/40 hover:text-[#D4AF37]/60 transition-colors">View ↗</a>
                </div>
              ))}
            </div>
          </section>
        )}

        <footer className="text-center pt-8 border-t border-[#D4AF37]/5">
          <p className="text-xs font-mono text-[#8A92A6]/30">
            All data verifiable on-chain · <a href="https://argusarc.xyz" className="hover:text-[#D4AF37]/50 transition-colors">argusarc.xyz</a> · <a href="https://github.com/Gideon145/argus" className="hover:text-[#D4AF37]/50 transition-colors">GitHub</a>
          </p>
        </footer>
      </div>
    </div>
  );
}
