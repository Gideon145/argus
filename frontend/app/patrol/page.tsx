'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL || 'http://localhost:3001';

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
  intervalMs: number;
}

const verdictBadge = (v: string) => {
  switch (v) {
    case 'SAFE': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    case 'RISKY': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    case 'SCAM': return 'bg-red-500/20 text-red-400 border-red-500/30';
    default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
  }
};

const verdictEmoji = (v: string) => {
  switch (v) {
    case 'SAFE': return '🟢';
    case 'RISKY': return '🟡';
    case 'SCAM': return '🔴';
    default: return '⚪';
  }
};

export default function PatrolPage() {
  const [log, setLog] = useState<PatrolRecord[]>([]);
  const [status, setStatus] = useState<PatrolStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [logRes, statusRes] = await Promise.all([
        fetch(`${AGENT_URL}/patrol-log?limit=20`),
        fetch(`${AGENT_URL}/patrol-status`),
      ]);
      if (logRes.ok) setLog(await logRes.json());
      if (statusRes.ok) setStatus(await statusRes.json());
      setLastRefresh(new Date());
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [fetchData]);

  const truncateAddr = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <div className="min-h-screen bg-[#050816] text-white font-mono">
      {/* Header */}
      <div className="max-w-3xl mx-auto px-4 pt-12 pb-6">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">🛡️</span>
            <h1 className="text-2xl font-bold tracking-tight">
              Argus Patrol
            </h1>
            {status?.running && (
              <span className="flex items-center gap-1.5 text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                LIVE
              </span>
            )}
          </div>
          <p className="text-slate-400 text-sm">
            Agents scan tokens autonomously — no human request needed.
            Every patrol writes a real on-chain verdict. Verifiable on ArcScan.
          </p>

          {/* Status bar */}
          {status && (
            <div className="flex flex-wrap gap-4 mt-4 text-xs text-slate-500">
              <span>Patrols: <b className="text-slate-300">{status.patrolsCompleted}</b></span>
              <span>Watchlist: <b className="text-slate-300">{status.watchlistSize} tokens</b></span>
              <span>Interval: <b className="text-slate-300">{Math.round(status.intervalMs / 60000)} min</b></span>
              {lastRefresh && (
                <span>Updated: {lastRefresh.toLocaleTimeString()}</span>
              )}
            </div>
          )}
        </motion.div>
      </div>

      {/* Patrol feed */}
      <div className="max-w-3xl mx-auto px-4 pb-16">
        {loading && (
          <div className="text-center text-slate-500 py-12">
            <span className="animate-pulse">Loading patrol log...</span>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm mb-4">
            Failed to load patrol data: {error}
            <button onClick={fetchData} className="ml-2 underline">Retry</button>
          </div>
        )}

        {!loading && !error && log.length === 0 && (
          <div className="text-center text-slate-500 py-12">
            <p className="text-lg mb-2">🛡️</p>
            <p>No patrols yet. The first autonomous scan runs within 15 minutes of server start.</p>
            <p className="text-xs mt-2 text-slate-600">
              Patrol interval: {status ? Math.round(status.intervalMs / 60000) : '~'} minutes
            </p>
          </div>
        )}

        <div className="space-y-3">
          {log.map((record, i) => (
            <motion.div
              key={`${record.time}-${i}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
              className="bg-[#0a0f1e] border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* Address + verdict */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-slate-300 font-medium text-sm truncate">
                      {truncateAddr(record.address)}
                    </span>
                    <a
                      href={`https://testnet.arcscan.app/address/${record.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-slate-600 hover:text-slate-400 shrink-0"
                    >
                      ↗
                    </a>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${verdictBadge(record.verdict)}`}>
                      {verdictEmoji(record.verdict)} {record.verdict}
                    </span>
                  </div>

                  {/* Consensus + agents */}
                  <div className="text-xs text-slate-500 space-y-0.5">
                    <span>
                      {record.consensus} consensus · {record.confidence}% confidence
                    </span>
                    {record.winningAgents.length > 0 && (
                      <div className="text-emerald-600">
                        Winners: {record.winningAgents.join(', ')}
                      </div>
                    )}
                    {record.losingAgents.length > 0 && (
                      <div className="text-red-600">
                        Losers: {record.losingAgents.join(', ')} (paid {record.winningAgents.length} agents)
                      </div>
                    )}
                  </div>
                </div>

                {/* Time + TX */}
                <div className="text-right shrink-0">
                  <div className="text-xs text-slate-600">{record.time?.slice(11, 19)}</div>
                  {record.txHash && (
                    <a
                      href={`https://testnet.arcscan.app/tx/${record.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:text-blue-400"
                    >
                      TX ↗
                    </a>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Bottom note */}
      <div className="max-w-3xl mx-auto px-4 pb-12">
        <div className="bg-[#0a0f1e] border border-slate-800 rounded-xl p-4 text-xs text-slate-500 space-y-1">
          <p>🛡️ <b className="text-slate-400">How patrol works:</b> Every 15 minutes, the server picks a token from the watchlist and runs the full 3-agent consensus pipeline. Agents stake real USDC. Losers pay winners. The verdict is written to the ArgusOracle contract on Arc — same as a user-paid scan, but initiated autonomously.</p>
          <p>🔗 <b className="text-slate-400">On-chain proof:</b> Each patrol creates a settlement batch on the <a href="https://testnet.arcscan.app/address/0x563b2DA572948C2b54B5f1f26CcFebC153Cb46C8" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-400">ArgusOracle contract</a>. TX count grows with every patrol — this is the same pattern that won Parry Protocol (35K+ TXs) and PROVUS (60K+ TXs) their hackathons.</p>
        </div>
      </div>
    </div>
  );
}
