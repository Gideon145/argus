'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatAddress, formatTimestamp } from '@/lib/utils';
import { Clock, ExternalLink, RefreshCw } from 'lucide-react';

interface ScanRecord {
  address: string;
  verdict: string;
  timestamp: string;
  txHash: string | null;
}

export default function HistoryPage() {
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const [userScans, patrolScans] = await Promise.all([
        api.getRecentScans(50),
        api.getPatrolLog(50),
      ]);

      // Build a map of address+time → txHash from patrol data
      const txMap = new Map<string, string>();
      (patrolScans || []).forEach((p: any) => {
        const key = `${(p.address || '').toLowerCase()}|${p.time || p.timestamp || ''}`;
        if (p.txHash) txMap.set(key, p.txHash);
      });

      // Merge: prefer patrol txHash, fallback to scan's own txHash
      const merged = [...(userScans || [])].map((s: any) => {
        const key = `${(s.address || '').toLowerCase()}|${s.timestamp || ''}`;
        return {
          address: s.address,
          verdict: s.verdict,
          timestamp: s.timestamp,
          txHash: txMap.get(key) || s.txHash || null,
        };
      });

      // Also add patrol scans that aren't duplicates
      (patrolScans || []).forEach((p: any) => {
        const exists = merged.some(m =>
          m.address.toLowerCase() === (p.address || '').toLowerCase() &&
          m.timestamp === (p.time || p.timestamp || '')
        );
        if (!exists) {
          merged.push({
            address: p.address,
            verdict: p.verdict,
            timestamp: p.time || p.timestamp,
            txHash: p.txHash || null,
          });
        }
      });

      // Sort by time descending
      merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setScans(merged.slice(0, 50));
    } catch (err) {
      console.error('Failed to load scan history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 15000); // refresh every 15s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between py-4 border-b border-border">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary flex items-center gap-2">
            <Clock size={20} className="text-accent" /> Recent Scans
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Live feed of the last 50 contract audits. Verdicts are settled on-chain.
          </p>
        </div>
        <button
          onClick={fetchHistory}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-border bg-bg-secondary hover:bg-bg-tertiary transition-all text-xs font-mono text-text-secondary"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-border text-text-muted">
                <th className="px-5 py-3 font-medium w-28">Time</th>
                <th className="px-5 py-3 font-medium">Contract</th>
                <th className="px-5 py-3 font-medium w-20">Verdict</th>
                <th className="px-5 py-3 font-medium w-32 text-right">TX</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-5 py-16 text-center text-text-muted animate-pulse">
                    Loading recent scans...
                  </td>
                </tr>
              ) : scans.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-16 text-center text-text-muted">
                    No scans yet.
                  </td>
                </tr>
              ) : (
                scans.map((scan, i) => (
                  <tr key={i} className="border-b border-border/40 hover:bg-bg-secondary/30 transition-colors">
                    <td className="px-5 py-3 text-text-muted whitespace-nowrap">
                      {formatTimestamp(scan.timestamp)}
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-text-secondary select-all">{scan.address}</span>
                    </td>
                    <td className="px-5 py-3">
                      <Badge label={scan.verdict} variant="verdict" />
                    </td>
                    <td className="px-5 py-3 text-right">
                      {scan.txHash ? (
                        <a
                          href={`https://testnet.arcscan.app/tx/${scan.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent hover:underline inline-flex items-center gap-1"
                        >
                          {formatAddress(scan.txHash, 6, 4)} <ExternalLink size={10} />
                        </a>
                      ) : (
                        <span className="text-text-muted/30">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
