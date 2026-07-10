'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { formatAddress, formatTimestamp, verdictColor } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { StatusDot } from '@/components/ui/StatusDot';
import { ExternalLink, RefreshCw, ShieldCheck, Activity } from 'lucide-react';
import type { PatrolRecord } from '@/lib/types';

const VERDICT_FILTERS = ['ALL', 'SAFE', 'RISKY', 'SCAM'] as const;
type VerdictFilter = (typeof VERDICT_FILTERS)[number];

export default function HistoryPage() {
  const router = useRouter();
  const [records, setRecords] = useState<PatrolRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<VerdictFilter>('ALL');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      // Patrol log is the ONLY source with real on-chain txHashes.
      // User debug scans do NOT generate individual txHashes.
      const data = await api.getPatrolLog(100);
      setRecords(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to fetch patrol log:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 30000);
    return () => clearInterval(interval);
  }, []);

  const filtered = filter === 'ALL'
    ? records
    : records.filter(r => r.verdict === filter);

  const verdictCounts = records.reduce((acc, r) => {
    acc[r.verdict] = (acc[r.verdict] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 border-b border-border">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary flex items-center gap-2">
            <Activity size={20} className="text-accent" /> Autonomous Patrol History
          </h1>
          <p className="text-sm text-text-muted mt-1 max-w-2xl">
            On-chain settled verdicts from the autonomous patrol loop. Every entry has a real Arc Testnet transaction hash.
            User debug scans are excluded — they route through the ArgusOracle contract, not individual transactions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-[11px] text-text-muted font-mono">
              Updated {formatTimestamp(lastUpdated.toISOString())}
            </span>
          )}
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-border bg-bg-secondary hover:bg-bg-tertiary text-xs font-medium text-text-secondary transition-all disabled:opacity-50"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Patrols', value: records.length, color: 'text-text-primary' },
          { label: 'Safe', value: verdictCounts['SAFE'] || 0, color: 'text-success' },
          { label: 'Risky', value: verdictCounts['RISKY'] || 0, color: 'text-warning' },
          { label: 'Scam', value: verdictCounts['SCAM'] || 0, color: 'text-critical' },
        ].map(stat => (
          <Card key={stat.label} padding="sm">
            <div className="text-xs font-medium text-text-muted uppercase">{stat.label}</div>
            <div className={`text-2xl font-bold mt-2 font-mono ${stat.color}`}>
              {loading ? '...' : stat.value}
            </div>
          </Card>
        ))}
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-text-muted font-mono">Filter:</span>
        {VERDICT_FILTERS.map(v => (
          <button
            key={v}
            onClick={() => setFilter(v)}
            className={`px-3 py-1 rounded-full text-xs font-mono font-medium transition-all border ${
              filter === v
                ? 'bg-accent/10 border-accent/30 text-accent'
                : 'border-border text-text-muted hover:text-text-secondary hover:border-border-active'
            }`}
          >
            {v === 'ALL' ? `All (${records.length})` : `${v} (${verdictCounts[v] || 0})`}
          </button>
        ))}
        <span className="ml-auto flex items-center gap-1.5 text-[11px] font-mono text-success">
          <StatusDot status="online" />
          Auto-refresh 30s
        </span>
      </div>

      {/* Main table */}
      <Card
        title="Patrol Scan Log"
        subtitle="Autonomous agent scans with real on-chain settlement transactions."
        action={
          <span className="text-[11px] font-mono text-success flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" /> Live
          </span>
        }
      >
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-border text-text-muted">
                <th className="px-5 py-3 font-medium">#</th>
                <th className="px-5 py-3 font-medium">Contract Address</th>
                <th className="px-5 py-3 font-medium">Verdict</th>
                <th className="px-5 py-3 font-medium">Consensus</th>
                <th className="px-5 py-3 font-medium">Confidence</th>
                <th className="px-5 py-3 font-medium">Time</th>
                <th className="px-5 py-3 font-medium">Settlement Tx</th>
                <th className="px-5 py-3 font-medium text-right">Report</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-text-muted">
                    <RefreshCw size={20} className="animate-spin mx-auto mb-2" />
                    Loading patrol history...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center">
                    <ShieldCheck size={32} className="text-success mx-auto mb-2" />
                    <p className="text-text-muted">
                      {filter === 'ALL' ? 'No patrol records found.' : `No ${filter} verdicts in patrol log.`}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((record, i) => (
                  <tr
                    key={`${record.address}-${i}`}
                    className="border-b border-border/50 hover:bg-bg-secondary/40 transition-colors"
                  >
                    <td className="px-5 py-3 text-text-muted/60">{i + 1}</td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => router.push(`/scan/${record.address}`)}
                        className="text-text-secondary hover:text-accent transition-colors font-semibold"
                      >
                        {formatAddress(record.address)}
                      </button>
                    </td>
                    <td className="px-5 py-3">
                      <Badge label={record.verdict} variant="verdict" />
                    </td>
                    <td className="px-5 py-3 text-text-secondary">{record.consensus || `${record.agentCount}/3`}</td>
                    <td className="px-5 py-3">
                      <span
                        className="font-medium"
                        style={{ color: verdictColor(record.verdict) }}
                      >
                        {record.confidence}%
                      </span>
                    </td>
                    <td className="px-5 py-3 text-text-muted">
                      {formatTimestamp(record.time)}
                    </td>
                    <td className="px-5 py-3">
                      {record.txHash ? (
                        <a
                          href={`https://testnet.arcscan.app/tx/${record.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent hover:underline flex items-center gap-1"
                        >
                          {formatAddress(record.txHash, 8, 6)}
                          <ExternalLink size={10} />
                        </a>
                      ) : (
                        <span className="text-text-muted/40 italic text-[11px]">Pending</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => router.push(`/scan/${record.address}`)}
                        className="text-accent hover:underline"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border/50 text-[11px] text-text-muted font-mono flex items-center justify-between">
            <span>Showing {filtered.length} of {records.length} patrol records</span>
            <span>
              {records.filter(r => r.txHash).length} confirmed on-chain ·{' '}
              {records.filter(r => !r.txHash).length} pending
            </span>
          </div>
        )}
      </Card>
    </div>
  );
}
