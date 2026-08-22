'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { StatusDot } from '@/components/ui/StatusDot';
import { formatAddress } from '@/lib/utils';
import { Bot, Coins, Wallet, Landmark, TrendingUp, RefreshCw, ExternalLink } from 'lucide-react';

interface StatsData {
  queries: number;
  consensusReached: number;
  onChainRecords: number;
  avgConfidence: number;
  status: string;
}

interface PoolData {
  total: number;
  assigned: number;
  available: number;
}

interface TreasuryData {
  treasury: { address: string; balance: string };
  funding: { address: string; balance: string };
  stats: StatsData;
}

interface EloAgent {
  name: string;
  elo: number;
  accuracy: number;
  wins: number;
  losses: number;
}

interface EloData {
  agents: EloAgent[];
}

interface PaymentRecord {
  from: string;
  to: string;
  amount: string;
  txHash: string;
  timestamp: string;
  reason: string;
}

interface PaymentData {
  totalPayments: number;
  totalVolume: string;
  recent: PaymentRecord[];
}

export default function StatsPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [pool, setPool] = useState<PoolData | null>(null);
  const [treasury, setTreasury] = useState<TreasuryData | null>(null);
  const [elo, setElo] = useState<EloData | null>(null);
  const [payments, setPayments] = useState<PaymentData | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStats = async () => {
    try {
      const [s, p, t, e, ap] = await Promise.all([
        api.getStats(),
        api.getPoolStats(),
        api.getTreasury(),
        api.getElo(),
        api.getAgentPayments(),
      ]);
      
      setStats(s as any);
      setPool(p);
      setTreasury(t as any);
      setElo(e);
      setPayments(ap as any);
      setError('');
    } catch (err: any) {
      console.error(err);
      setError('Telemetry feed offline. Retrying connection...');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 15000);
    return () => clearInterval(interval);
  }, []);

  const agentColors = ['text-agent-alpha', 'text-agent-beta', 'text-agent-gamma'];
  const agentBorderColors = ['border-agent-alpha/20', 'border-agent-beta/20', 'border-agent-gamma/20'];
  const agentBgColors = ['bg-agent-alpha/5', 'bg-agent-beta/5', 'bg-agent-gamma/5'];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 border-b border-border">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary flex items-center gap-2">
            <TrendingUp size={20} className="text-accent" /> Network Analytics & Stats
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Real-time telemetry and financial records retrieved from the Argus consensus engine.
          </p>
        </div>
        <button
          onClick={() => {
            setLoading(true);
            fetchStats();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-border bg-bg-secondary hover:bg-bg-tertiary transition-all text-xs font-mono text-text-secondary"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Force Sync
        </button>
      </div>

      {error && (
        <div className="p-3 rounded bg-critical/5 border border-critical/15 text-xs text-critical font-mono">
          {error}
        </div>
      )}

      {/* Grid of stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card padding="sm">
            <span className="text-[13px] uppercase font-mono text-text-muted">Total Security Scans</span>
            <span className="text-3xl font-bold block mt-1 font-mono text-text-primary">
              {stats.queries}
            </span>
            <span className="text-[12px] font-mono text-text-muted block mt-1">
              Consensus: {stats.consensusReached} · {stats.avgConfidence}% conf
            </span>
          </Card>
          
          <Card padding="sm">
            <span className="text-[13px] uppercase font-mono text-text-muted">Assigned User Wallets</span>
            <span className="text-3xl font-bold block mt-1 font-mono text-text-primary">
              {pool?.assigned || 0}
            </span>
            <span className="text-[12px] font-mono text-text-muted block mt-1">
              Available: {pool?.available || 0} · Total: {pool?.total || 0}
            </span>
          </Card>

          <Card padding="sm">
            <span className="text-[13px] uppercase font-mono text-text-muted">Treasury Holdings</span>
            <span className="text-3xl font-bold block mt-1 font-mono text-success">
              ${parseFloat(treasury?.treasury?.balance || '0').toFixed(2)}
            </span>
            <span className="text-[12px] font-mono text-text-muted block mt-1">USDC on Arc Testnet</span>
          </Card>

          <Card padding="sm">
            <span className="text-[13px] uppercase font-mono text-text-muted">Economy Volume</span>
            <span className="text-3xl font-bold block mt-1 font-mono text-accent">
              ${parseFloat(payments?.totalVolume || '0').toFixed(3)}
            </span>
            <span className="text-[12px] font-mono text-text-muted block mt-1">
              Payments: {payments?.totalPayments || 0}
            </span>
          </Card>
        </div>
      )}

      {/* ELO Reputation Leaderboard */}
      {elo?.agents && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <Bot size={16} className="text-accent" />
            <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wider">
              Agent ELO Reputation & Performance
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {['Agent-α', 'Agent-β', 'Agent-γ']
              .map((name) => elo.agents.find((a) => a.name === name))
              .filter((a): a is EloAgent => !!a)
              .map((agent, i) => {
              const color = agentColors[i];
              const border = agentBorderColors[i];
              const bg = agentBgColors[i];
              
              return (
                <div
                  key={agent.name}
                  className={`border rounded-lg p-5 space-y-4 flex flex-col justify-between ${border} ${bg}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className={`text-base font-bold tracking-tight ${color}`}>{agent.name}</span>
                    </div>
                    <Badge label={`${agent.wins}W / ${agent.losses}L`} variant="status" />
                  </div>

                  <div className="space-y-3 font-mono text-xs">
                    <div className="flex justify-between">
                      <span className="text-text-muted">ELO Rating:</span>
                      <span className="text-text-primary font-bold">{agent.elo}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">Consensus Accuracy:</span>
                      <span className="text-text-primary font-bold">{agent.accuracy}%</span>
                    </div>
                    
                    <div className="w-full h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-1000"
                        style={{
                          backgroundColor: i === 0 ? '#7EB8DA' : i === 1 ? '#D4AF37' : '#B57ED8',
                          width: `${agent.accuracy}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* On-Chain Wallets */}
      {treasury && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <Coins size={16} className="text-accent" />
            <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wider">
              Settlement Address Registry
            </h2>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <a
              href={`https://testnet.arcscan.app/address/${treasury.treasury.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-4 rounded-lg bg-bg-secondary border border-border hover:border-border-active transition-all"
            >
              <div className="flex items-center justify-between text-xs font-mono text-text-muted mb-2">
                <span className="uppercase tracking-wider">Staking Treasury Vault</span>
                <ExternalLink size={12} />
              </div>
              <p className="font-mono text-xs text-text-secondary select-all break-all">
                {treasury.treasury.address}
              </p>
              <p className="text-xs font-mono text-success font-semibold mt-2">
                ${parseFloat(treasury.treasury.balance).toFixed(2)} USDC Locked
              </p>
            </a>

            <a
              href={`https://testnet.arcscan.app/address/${treasury.funding.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-4 rounded-lg bg-bg-secondary border border-border hover:border-border-active transition-all"
            >
              <div className="flex items-center justify-between text-xs font-mono text-text-muted mb-2">
                <span className="uppercase tracking-wider">Circle Faucet Reserve</span>
                <ExternalLink size={12} />
              </div>
              <p className="font-mono text-xs text-text-secondary select-all break-all">
                {treasury.funding.address}
              </p>
              <p className="text-xs font-mono text-success font-semibold mt-2">
                ${parseFloat(treasury.funding.balance).toFixed(2)} USDC Available
              </p>
            </a>
          </div>
        </div>
      )}

      {/* Recent Agent Staking Payments */}
      {payments && (payments.totalPayments || 0) > 0 && (
        <Card title="Staking Settlement History" subtitle="Recent nanopayment distributions transferred between winning/losing agents on-chain.">
          <div className="space-y-2.5">
            {payments.recent.slice(0, 8).map((p, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 rounded bg-bg-primary border border-border/80 font-mono text-xs"
              >
                <div className="space-y-1">
                  <span className="text-text-secondary font-semibold">
                    {p.from} → {p.to}
                  </span>
                  <span className="block text-[10px] text-text-muted">
                    {p.reason}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-success font-semibold">
                    +${parseFloat(p.amount).toFixed(5)} USDC
                  </span>
                  <a
                    href={`https://testnet.arcscan.app/tx/${p.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-text-muted hover:text-accent transition-colors"
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
