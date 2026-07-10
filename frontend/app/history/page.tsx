'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatAddress, formatTimestamp } from '@/lib/utils';
import { Clock, Search, ExternalLink, ArrowRight, RefreshCw } from 'lucide-react';

interface ScanRecord {
  address: string;
  verdict: string;
  consensus: string;
  confidence: number | null;
  timestamp: string;
  txHash: string | null;
}

export default function HistoryPage() {
  const router = useRouter();
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAddress, setFilterAddress] = useState('');
  const [filterVerdict, setFilterVerdict] = useState('ALL');

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const data = await api.getRecentScans(40);
      // Reverse so latest scans appear first
      const ordered = [...data].reverse();
      setScans(
        ordered.map(s => ({
          address: s.address,
          verdict: s.verdict,
          consensus: s.consensusVotes || s.consensus || '3/3',
          confidence: s.confidence ?? null,
          timestamp: s.timestamp,
          txHash: s.txHash,
        }))
      );
    } catch (err) {
      console.error('Failed to load scan history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const filteredScans = scans.filter(s => {
    const matchesAddress = s.address.toLowerCase().includes(filterAddress.trim().toLowerCase());
    const matchesVerdict = filterVerdict === 'ALL' || s.verdict === filterVerdict;
    return matchesAddress && matchesVerdict;
  });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 border-b border-border">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary flex items-center gap-2">
            <Clock size={20} className="text-accent" /> Scan History Ledger
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Browse and inspect previous smart contract audits submitted to the network.
          </p>
        </div>
        <button
          onClick={fetchHistory}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-border bg-bg-secondary hover:bg-bg-tertiary transition-all text-xs font-mono text-text-secondary"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          Sync Logs
        </button>
      </div>

      {/* Filters row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search by contract address (0x...)"
            value={filterAddress}
            onChange={(e) => setFilterAddress(e.target.value)}
            className="w-full bg-bg-secondary border border-border rounded-lg pl-10 pr-4 py-2 font-mono text-xs text-text-primary focus:border-accent"
          />
          <Search size={14} className="absolute left-3.5 top-3 text-text-muted" />
        </div>
        
        <select
          value={filterVerdict}
          onChange={(e) => setFilterVerdict(e.target.value)}
          className="bg-bg-secondary border border-border rounded-lg px-4 py-2 text-xs font-mono text-text-secondary focus:border-accent"
        >
          <option value="ALL">All Verdicts</option>
          <option value="SAFE">Safe</option>
          <option value="RISKY">Risky</option>
          <option value="SCAM">Scam</option>
        </select>
      </div>

      {/* History table */}
      <Card title="Historical Audit Logs" padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-border text-text-muted">
                <th className="px-5 py-3.5 font-medium">Timestamp</th>
                <th className="px-5 py-3.5 font-medium">Contract Address</th>
                <th className="px-5 py-3.5 font-medium">Consensus Verdict</th>
                <th className="px-5 py-3.5 font-medium">Agreement</th>
                <th className="px-5 py-3.5 font-medium">Confidence</th>
                <th className="px-5 py-3.5 font-medium">Verification Hash</th>
                <th className="px-5 py-3.5 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-text-muted animate-pulse">
                    Querying ledger archive...
                  </td>
                </tr>
              ) : filteredScans.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-text-muted">
                    No scan records found matching filters.
                  </td>
                </tr>
              ) : (
                filteredScans.map((scan, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-bg-secondary/25 transition-colors">
                    <td className="px-5 py-3.5 text-text-muted whitespace-nowrap">
                      {formatTimestamp(scan.timestamp)}
                    </td>
                    <td className="px-5 py-3.5 text-text-secondary select-all font-semibold">
                      {scan.address}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge label={scan.verdict} variant="verdict" />
                    </td>
                    <td className="px-5 py-3.5 text-text-secondary">
                      {scan.consensus}
                    </td>
                    <td className="px-5 py-3.5 text-text-primary font-medium">
                      {scan.confidence != null ? `${scan.confidence}%` : <span className="text-text-muted/40">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-text-muted">
                      {scan.txHash ? (
                        <a
                          href={`https://testnet.arcscan.app/tx/${scan.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent hover:underline flex items-center gap-0.5"
                        >
                          {formatAddress(scan.txHash, 8, 6)} <ExternalLink size={10} />
                        </a>
                      ) : (
                        <span className="text-text-muted/40">Off-chain</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={() => router.push(`/scan/${scan.address}`)}
                        className="text-accent hover:underline inline-flex items-center gap-1"
                      >
                        Inspect <ArrowRight size={12} />
                      </button>
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
