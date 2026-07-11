'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { StatusDot } from '@/components/ui/StatusDot';
import { formatAddress } from '@/lib/utils';
import { Shield, Clock, Eye, AlertTriangle, ArrowRight, ExternalLink, RefreshCw, Radio, Link2, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface PatrolRecord {
  address: string;
  verdict: string;
  consensus: string;
  confidence: number;
  time: string;
  agentCount: number;
  winningAgents: string[];
  losingAgents: string[];
  txHash?: string;
}

interface PatrolStatus {
  running: boolean;
  patrolsCompleted: number;
  watchlistSize: number;
  userHistoryPool: number;
  effectiveCoverage: number;
  intervalMs: number;
}

export default function PatrolPage() {
  const router = useRouter();
  const [log, setLog] = useState<PatrolRecord[]>([]);
  const [totalPatrols, setTotalPatrols] = useState(0);
  const [status, setStatus] = useState<PatrolStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [logData, statusData] = await Promise.all([
        api.getPatrolLog(20),
        api.getPatrolStatus(),
      ]);
      setLog(logData.records);
      setTotalPatrols(logData.total);
      setStatus(statusData);
      setLastRefresh(new Date());
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Failed to fetch patrol logs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000); // refresh every 15s for high responsiveness
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 border-b border-border">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary flex items-center gap-2">
            <Shield size={20} className="text-accent" /> Autonomous Security Patrol
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Agents scan target contracts autonomously, validating signatures and staking USDC on-chain.
          </p>
        </div>
        {status?.running && (
          <span className="flex items-center gap-1.5 text-xs bg-success/5 text-success border border-success/15 px-3 py-1 rounded-full font-medium">
            <StatusDot status="online" /> ACTIVE PATROL LOOP
          </span>
        )}
      </div>

      {/* Overview/How it works */}
      <Card title="How Autonomous Patrol Works" padding="sm">
        <div className="space-y-3 text-[13px] text-text-muted leading-relaxed">
          <p className="flex items-start gap-2">
            <Radio size={14} className="text-accent flex-shrink-0 mt-0.5" />
            <span><strong className="text-text-secondary">Watchlist Loop:</strong> The server maintains a persistent registry of verified and unverified tokens. Every 15 minutes, the next token in the loop is audited by Agent α, Agent β, and Agent γ.</span>
          </p>
          <p className="flex items-start gap-2">
            <Link2 size={14} className="text-warning flex-shrink-0 mt-0.5" />
            <span><strong className="text-text-secondary">Game-Theoretic Stake Settlements:</strong> Agent actions require collateral staking. When consensus resolves, losing agents have their staked USDC slashed and redistributed to the winning agents on-chain.</span>
          </p>
          <p className="flex items-start gap-2">
            <ShieldCheck size={14} className="text-success flex-shrink-0 mt-0.5" />
            <span><strong className="text-text-secondary">Zero-Gas Oracle Integration:</strong> Verification verdicts and updating ELO scores are automatically written to the ArgusOracle contract on Arc Testnet, creating an immutable on-chain blacklist security index.</span>
          </p>
        </div>
      </Card>

      {/* Stats bar */}
      {status && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card padding="sm">
            <span className="text-[12px] uppercase font-mono text-text-muted">Total Patrols</span>
            <span className="text-2xl font-bold block mt-1 font-mono">{totalPatrols}</span>
          </Card>
          <Card padding="sm">
            <span className="text-[12px] uppercase font-mono text-text-muted">Coverage Pool</span>
            <span className="text-2xl font-bold block mt-1 font-mono">{status.effectiveCoverage}</span>
          </Card>
          <Card padding="sm">
            <span className="text-[12px] uppercase font-mono text-text-muted">Loop Interval</span>
            <span className="text-2xl font-bold block mt-1 font-mono">
              {Math.round(status.intervalMs / 60000)}m
            </span>
          </Card>
          <Card padding="sm">
            <span className="text-[12px] uppercase font-mono text-text-muted">Last Updated</span>
            <span className="text-sm font-semibold block mt-2 text-text-secondary">
              {lastRefresh ? lastRefresh.toLocaleTimeString() : 'Pending'}
            </span>
          </Card>
        </div>
      )}

      {/* Main feed panel */}
      <Card title="Active Watchlist Feed" subtitle="Real-time log of autonomous agent verification activities.">
        {loading && (
          <div className="text-center py-12 text-xs font-mono text-text-muted animate-pulse">
            Querying patrol database...
          </div>
        )}

        {error && (
          <div className="flex items-center justify-between p-3 rounded bg-critical/5 border border-critical/15 text-xs text-critical font-mono mb-4">
            <span>Failed to load patrol log: {error}</span>
            <button onClick={fetchData} className="underline hover:text-critical/85">Retry</button>
          </div>
        )}

        {!loading && !error && log.length === 0 && (
          <div className="text-center py-12 text-xs font-mono text-text-muted space-y-2">
            <Shield size={32} className="mx-auto text-text-muted/30" />
            <p>No autonomous logs found in the ledger. Running scheduler loop...</p>
          </div>
        )}

        {!loading && !error && log.length > 0 && (
          <div className="space-y-3">
            {log.map((record, i) => (
              <div
                key={i}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-bg-primary border border-border hover:border-border-active transition-all"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-semibold text-text-secondary select-all">
                      {record.address}
                    </span>
                    <Badge label={record.verdict} variant="verdict" />
                  </div>

                  <div className="text-xs font-mono text-text-muted space-y-1">
                    <p>Consensus: {record.consensus} ({record.confidence}% confidence)</p>
                    {record.winningAgents.length > 0 && (
                      <p className="text-success/90">
                        Winners: {record.winningAgents.join(', ')}
                      </p>
                    )}
                    {record.losingAgents.length > 0 && (
                      <p className="text-critical/90">
                        Losers: {record.losingAgents.join(', ')} (Stake slash settled)
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0 border-t sm:border-t-0 border-border/40 pt-2 sm:pt-0 font-mono text-xs">
                  <span className="text-text-muted flex items-center gap-1">
                    <Clock size={12} /> {record.time?.slice(11, 19) || '00:00:00'}
                  </span>
                  
                  <div className="flex items-center gap-3">
                    {record.txHash ? (
                      <a
                        href={`https://testnet.arcscan.app/tx/${record.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:underline flex items-center gap-0.5"
                      >
                        Tx <ExternalLink size={10} />
                      </a>
                    ) : (
                      <span className="text-text-muted/40">Local Proof</span>
                    )}

                    <button
                      onClick={() => router.push(`/scan/${record.address}`)}
                      className="text-text-secondary hover:text-text-primary hover:underline flex items-center gap-0.5"
                    >
                      Report <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
