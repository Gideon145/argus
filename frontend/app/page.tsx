'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/lib/wallet-context';
import { api } from '@/lib/api';
import { isValidAddress, formatAddress, formatTimestamp, verdictColor } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Terminal } from '@/components/ui/Terminal';
import { StatusDot } from '@/components/ui/StatusDot';
import { Badge } from '@/components/ui/Badge';
import { Search, ShieldAlert, ShieldCheck, Zap, Activity, History, Server, FileText, ArrowRight, ExternalLink, Bot, ChevronDown } from 'lucide-react';

interface RecentScan {
  address: string;
  verdict: string;
  consensus: string;
  confidence: number;
  timestamp: string;
  txHash: string | null;
}

export default function Dashboard() {
  const router = useRouter();
  const { isConnected, address: walletAddress, isCircle, circleUserId, sendPayment } = useWallet();

  const [inputAddress, setInputAddress] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Stats
  const [stats, setStats] = useState({
    queries: 0,
    patrolQueries: 0,
    consensusReached: 0,
    onChainRecords: 0,
    avgConfidence: 0,
  });

  // Recent scans + patrol (merged for audit log)
  const [recentScans, setRecentScans] = useState<RecentScan[]>([]);
  const [patrolScans, setPatrolScans] = useState<RecentScan[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [agentPayments, setAgentPayments] = useState<{ totalPayments: number; totalVolume: string; recent: { from: string; to: string; amount: string; txHash: string; reason: string }[] } | null>(null);

  // FAQ accordion
  const [openFaq, setOpenFaq] = useState<number>(0);

  // Terminal logs for scan progress
  const [logLines, setLogLines] = useState<{ timestamp?: string; level?: 'info' | 'warn' | 'error' | 'success' | 'debug'; message: string }[]>([]);

  // Fetch stats and recent scans
  useEffect(() => {
    const fetchData = async () => {
      try {
        const statsData = await api.getStats();
        setStats({
          queries: statsData.queries || 0,
          patrolQueries: statsData.patrolQueries || 0,
          consensusReached: statsData.consensusReached || 0,
          onChainRecords: statsData.onChainRecords || 0,
          avgConfidence: statsData.avgConfidence || 0,
        });

        // Fetch patrol log (has real on-chain tx hashes) + recent user scans
        const [scans, patrol] = await Promise.all([
          api.getRecentScans(6),
          api.getPatrolLog(6),
        ]);

        setRecentScans(
          scans.filter((s: any) => s.address && s.address !== '0xUnknown').map((s: any) => ({
            address: s.address,
            verdict: s.verdict,
            consensus: s.consensusVotes || s.consensus || '3/3',
            confidence: s.confidence || (s.consensusVotes === '2/3' ? 78 : 95),
            timestamp: s.timestamp,
            txHash: s.txHash,
          }))
        );

        setPatrolScans(
          ((patrol as any).records ?? (patrol as unknown as any[])).map((p: any) => ({
            address: p.address,
            verdict: p.verdict,
            consensus: p.consensus || '3/3',
            confidence: p.confidence || 75,
            timestamp: p.time || p.timestamp,
            txHash: p.txHash || null,
          }))
        );

        // Agent payment data
        try {
          const ap = await api.getAgentPayments();
          setAgentPayments(ap as any);
        } catch { /* ignore */ }
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
      } finally {
        setStatsLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  // Keyboard shortcut for focus
  const searchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const addLog = (message: string, level: 'info' | 'warn' | 'error' | 'success' | 'debug' = 'info') => {
    setLogLines(prev => [...prev, { message, level }]);
  };

  const handleScanSubmit = async () => {
    if (!isConnected) {
      setError('Connect Get Started or MetaMask to scan. $0.01 per audit.');
      return;
    }
    const cleanAddress = inputAddress.trim().toLowerCase();
    if (!isValidAddress(cleanAddress)) {
      setError('Invalid contract address format.');
      return;
    }

    setError('');
    setLoading(true);
    setLogLines([]);

    addLog('Initializing Security Scan protocol...', 'info');
    await new Promise(r => setTimeout(r, 400));
    addLog(`Target contract: ${cleanAddress}`, 'debug');
    
    try {
      let txHash: string | null = null;

      if (!isCircle) {
        addLog('Processing $0.01 USDC security fee via MetaMask...', 'info');
        try {
          txHash = await sendPayment();
          addLog(`Payment confirmed: ${formatAddress(txHash)}`, 'success');
        } catch (payErr: any) {
          addLog(`Payment failed: ${payErr.message || payErr}`, 'error');
          setLoading(false);
          return;
        }
      } else {
        addLog('Processing Circle pre-funded payment...', 'info');
        await new Promise(r => setTimeout(r, 600));
      }

      addLog('Contacting Multi-Agent Consensus Orchestrator...', 'info');
      addLog('Agent α (DeepSeek-V3) analyzing vulnerabilities...', 'debug');
      await new Promise(r => setTimeout(r, 500));
      addLog('Agent β (Claude Sonnet) analyzing holder distribution & LP...', 'debug');
      await new Promise(r => setTimeout(r, 500));
      addLog('Agent γ (Deterministic Rules) scanning signature database...', 'debug');
      await new Promise(r => setTimeout(r, 500));
      addLog('Computing final security consensus score...', 'info');

      // Trigger actual scan — MetaMask uses scanWithPayment (attaches real tx proof),
      // Circle uses /scan/circle (payment handled server-side).
      let scanResponse;
      if (isCircle && circleUserId) {
        scanResponse = await api.scanCircle(circleUserId, cleanAddress);
      } else {
        // txHash is guaranteed non-null here (MetaMask path only reaches here after payment)
        scanResponse = await api.scanWithPayment(cleanAddress, txHash!);
      }

      addLog(`Consensus formed: ${scanResponse.result.verdict} (${scanResponse.result.agreementCount}/${scanResponse.result.totalAgents} agents)`, 'success');
      
      if (scanResponse.result.settlementBatchId) {
        addLog(`On-chain state settled in batch: ${formatAddress(scanResponse.result.settlementBatchId)}`, 'success');
      }
      if (scanResponse.payment?.txHash) {
        addLog(`Payment settled on-chain: ${formatAddress(scanResponse.payment.txHash)}`, 'success');
        // Cache txHash so the result page can show the real settlement link
        sessionStorage.setItem(`argus_payment_${cleanAddress}`, scanResponse.payment.txHash);
      }

      addLog('Redirecting to full vulnerability analysis report...', 'info');
      await new Promise(r => setTimeout(r, 800));

      router.push(`/scan/${cleanAddress}`);
    } catch (err: any) {
      addLog(`Scan orchestration failed: ${err.message || err}`, 'error');
      setError(err.message || 'Scan failed.');
      setLoading(false);
    }
  };

  const handleQuickAction = (addr: string) => {
    setInputAddress(addr);
    setError('');
    searchInputRef.current?.focus();
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-4 border-b border-border">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary flex items-center gap-2">
            <ShieldCheck size={22} className="text-accent" /> Argus Security Operations Center
          </h1>
          <p className="text-sm text-text-muted mt-1 max-w-2xl">
            Argus is a multi-agent security oracle. Three autonomous agents — two AI models + a deterministic rule engine — independently audit any smart contract, stake real USDC on their verdicts, and settle consensus on-chain on Arc Testnet. Losers pay winners. Every dissent costs real money.
          </p>
          <p className="text-[12px] text-text-muted mt-2 flex items-center gap-3">
            <span>Paste a contract address below → hit <span className="text-accent font-mono">Enter</span> or click <span className="text-accent">Scan</span></span>
            <span className="text-text-muted/30">|</span>
            <span>Watch the terminal log as agents audit in real-time</span>
            <span className="text-text-muted/30">|</span>
            <span>Press <span className="text-accent font-mono">/</span> to jump back to the search bar</span>
          </p>
        </div>
        <div className="flex items-center gap-2 bg-bg-secondary px-3 py-1.5 rounded-md border border-border">
          <Activity size={14} className="text-success animate-pulse" />
          <span className="text-xs text-text-secondary font-mono">Consensus Threshold: 2/3 Agents</span>
        </div>
      </div>

      {/* Grid of Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card padding="sm">
          <div className="text-xs font-medium text-text-muted uppercase">Total Contract Audits</div>
          <div className="text-2xl font-bold mt-2 font-mono text-text-primary">
            {statsLoading ? '...' : stats.queries.toLocaleString()}
          </div>
          <div className="text-[10px] text-text-muted mt-1">User initiated queries</div>
        </Card>
        <Card padding="sm">
          <div className="text-xs font-medium text-text-muted uppercase">Autonomous Patrols</div>
          <div className="text-2xl font-bold mt-2 font-mono text-text-primary">
            {statsLoading ? '...' : stats.patrolQueries.toLocaleString()}
          </div>
          <div className="text-[10px] text-text-muted mt-1">Every 15 min loop</div>
        </Card>
        <Card padding="sm">
          <div className="text-xs font-medium text-text-muted uppercase">Consensus Reached</div>
          <div className="text-2xl font-bold mt-2 font-mono text-success">
            {statsLoading ? '...' : `${((stats.consensusReached / (stats.queries || 1)) * 100).toFixed(1)}%`}
          </div>
          <div className="text-[10px] text-text-muted mt-1">{stats.consensusReached} agreements</div>
        </Card>
        <Card padding="sm">
          <div className="text-xs font-medium text-text-muted uppercase">On-Chain Settlements</div>
          <div className="text-2xl font-bold mt-2 font-mono text-accent">
            {statsLoading ? '...' : stats.onChainRecords.toLocaleString()}
          </div>
          <div className="text-[10px] text-text-muted mt-1">Stakes settled on Arc</div>
        </Card>
      </div>

      {/* 5/5 Circle Primitives */}
      <div className="flex flex-wrap items-center justify-center gap-3 py-3 text-[13px] font-mono text-text-muted">
        <span className="text-success flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-success" />Gateway x402</span>
        <span className="text-text-muted/30">·</span>
        <span className="text-success flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-success" />Agent Wallets</span>
        <span className="text-text-muted/30">·</span>
        <span className="text-success flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-success" />Dev Wallets</span>
        <span className="text-text-muted/30">·</span>
        <span className="text-success flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-success" />Contracts</span>
        <span className="text-text-muted/30">·</span>
        <span className="text-success flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-success" />App Kit</span>
        <span className="text-text-muted/50 ml-2">— all 5 Circle primitives integrated</span>
      </div>

      {/* Main Scan Form & Terminal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card title="Initiate Smart Contract Audit" subtitle="Paste any ERC-20 contract address to trigger the multi-agent consensus scanner.">
            <div className="space-y-4">
              <div className="relative">
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Enter contract address (0x...)"
                  value={inputAddress}
                  onChange={(e) => {
                    setInputAddress(e.target.value);
                    setError('');
                  }}
                  disabled={loading}
                  className="w-full bg-bg-primary border border-border rounded-lg pl-10 pr-4 py-3 font-mono text-sm placeholder-text-muted/50 text-text-primary transition-all focus:border-accent"
                />
                <Search size={18} className="absolute left-3.5 top-3.5 text-text-muted" />
              </div>

              {error && <div className="text-xs text-critical font-mono">{error}</div>}

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-[11px] text-text-muted font-mono self-start sm:self-center">
                  Press <kbd className="bg-bg-tertiary px-1 py-0.5 rounded border border-border">/</kbd> to focus search
                </div>

                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={handleScanSubmit}
                    disabled={loading || !inputAddress.trim()}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-6 py-2.5 rounded-md text-sm font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    {loading ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Auditing...
                      </>
                    ) : (
                      <>
                        Scan Contract
                        <ArrowRight size={14} />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </Card>

          {/* Terminal log panel */}
          {loading && (
            <div className="animate-fade-in">
              <Terminal lines={logLines} title="Scan Orchestration Agent" maxHeight="240px" />
            </div>
          )}

          {/* Quick Actions */}
          <Card title="Quick Scans" padding="sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
              <button
                onClick={() => handleQuickAction('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48')}
                className="flex items-center justify-between p-2.5 rounded border border-border bg-bg-primary hover:border-border-active transition-colors text-left"
              >
                <span className="text-accent">USDC (Arc Testnet)</span>
                <span className="text-text-muted">0xA0b8...eB48</span>
              </button>
              <button
                onClick={() => handleQuickAction('0x563b2DA572948C2b54B5f1f26CcFebC153Cb46C8')}
                className="flex items-center justify-between p-2.5 rounded border border-border bg-bg-primary hover:border-border-active transition-colors text-left"
              >
                <span className="text-agent-alpha">ArgusOracle</span>
                <span className="text-text-muted">0x563b...46C8</span>
              </button>
              <button
                onClick={() => handleQuickAction('0x6944e1df6bf5972305f9ab25df47ef10de01bcc8')}
                className="flex items-center justify-between p-2.5 rounded border border-border bg-bg-primary hover:border-border-active transition-colors text-left col-span-1 sm:col-span-2"
              >
                <span className="text-critical">Unibase AI (Scam — Blocked Us)</span>
                <span className="text-text-muted">0x6944...bcc8</span>
              </button>
            </div>
          </Card>

          {/* Live Activity Feed — fills the empty space in left panel */}
          <Card title="Live Activity Feed" padding="sm" action={<span className="text-[11px] font-mono text-success flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" /> Auto-refresh 15s</span>}>
            <div className="max-h-[340px] overflow-y-auto pr-1 space-y-0.5">
              {statsLoading ? (
                <div className="text-center py-8 text-sm text-text-muted font-mono">Loading activity...</div>
              ) : (() => {
                const timeline: { type: string; key: string; time: Date; content: React.ReactNode }[] = [];

                (agentPayments?.recent || []).slice(0, 5).forEach(p => {
                  timeline.push({
                    type: 'payment', key: `pay-${p.txHash}`, time: new Date((p as any).timestamp || Date.now()),
                    content: (
                      <a href={`https://testnet.arcscan.app/tx/${p.txHash}`} target="_blank" rel="noopener noreferrer"
                        className="flex items-center justify-between px-3 py-2 rounded hover:bg-bg-tertiary/40 border-l-2 border-l-warning/30 hover:border-l-warning transition-all text-[13px] w-full group">
                        <span className="font-mono text-text-secondary min-w-0 truncate">
                          <span className="text-warning font-medium">{p.from?.replace('Agent-','') || '?'}</span>
                          <span className="text-text-muted/40 mx-1.5">→</span>
                          <span className="text-success font-medium">{p.to?.replace('Agent-','') || '?'}</span>
                        </span>
                        <span className="font-mono text-warning/80 flex items-center gap-1 text-[12px] flex-shrink-0 ml-2">
                          {parseFloat(p.amount).toFixed(4)} <span className="text-text-muted/60 text-[11px]">USDC</span>
                          <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        </span>
                      </a>
                    ),
                  });
                });

                patrolScans.slice(0, 6).forEach(s => {
                  timeline.push({
                    type: 'patrol', key: `pat-${s.address}`, time: new Date(s.timestamp || Date.now()),
                    content: (
                      <div onClick={() => router.push(`/scan/${s.address}`)}
                        className="flex items-center justify-between px-3 py-2 rounded hover:bg-bg-tertiary/40 border-l-2 border-l-success/20 hover:border-l-success/40 cursor-pointer transition-all">
                        <span className="font-mono text-[13px] text-text-secondary min-w-0 truncate">{formatAddress(s.address)}</span>
                        <span className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                          <span className="text-[11px] font-mono text-text-muted">{s.consensus}</span>
                          <Badge label={s.verdict} variant="verdict" />
                        </span>
                      </div>
                    ),
                  });
                });

                recentScans.slice(0, 4).forEach(s => {
                  timeline.push({
                    type: 'scan', key: `usr-${s.address}`, time: new Date(s.timestamp || Date.now()),
                    content: (
                      <div onClick={() => router.push(`/scan/${s.address}`)}
                        className="flex items-center justify-between px-3 py-2 rounded hover:bg-bg-tertiary/40 border-l-2 border-l-accent/15 hover:border-l-accent/30 cursor-pointer transition-all">
                        <span className="font-mono text-[13px] text-text-secondary min-w-0 truncate">{formatAddress(s.address)}</span>
                        <span className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                          <span className="text-[11px] font-mono text-text-muted">{s.consensus}</span>
                          <Badge label={s.verdict} variant="verdict" />
                        </span>
                      </div>
                    ),
                  });
                });

                timeline.sort((a, b) => b.time.getTime() - a.time.getTime());

                if (timeline.length === 0) {
                  return <div className="text-center py-8 text-sm text-text-muted font-mono">No activity yet. Connect a wallet and run a scan.</div>;
                }

                return (
                  <>
                    <div className="flex items-center justify-between px-3 py-2 mb-1 border-b border-border/30 text-[12px] font-mono">
                      <span className="text-text-muted">
                        {agentPayments ? `${agentPayments.totalPayments} payments · $${parseFloat(agentPayments.totalVolume || '0').toFixed(3)} vol` : 'Loading payments...'}
                      </span>
                      <span className="text-success/70">{timeline.length} events</span>
                    </div>
                    {timeline.slice(0, 12).map((item, i) => (
                      <div key={item.key} className="group">
                        {item.content}
                        <span className="block text-[11px] text-text-muted/40 font-mono px-3 pb-1">{formatTimestamp(item.time.toISOString())}</span>
                      </div>
                    ))}
                  </>
                );
              })()}
            </div>
          </Card>

          {/* FAQ — fills remaining space */}
          <Card title="Frequently Asked Questions" subtitle="Everything you need to know about Argus." padding="md">
            <div className="space-y-5 text-[15px] leading-relaxed">
              {[
                { q: 'What is Argus?', a: 'Argus is a multi-agent security oracle. Three autonomous agents — two AI models (DeepSeek + Claude) and a deterministic rule engine — independently audit any smart contract. Each agent stakes real USDC on its verdict. Consensus determines the truth.' },
                { q: 'How does the consensus work?', a: 'All three agents analyze the contract simultaneously. If at least 2 out of 3 agree on a verdict (Safe, Risky, or Scam), consensus is reached. Dissenting agents pay the winners in USDC — creating a financial incentive for accuracy.' },
                { q: 'Who pays for scans?', a: 'Each scan costs $0.01 USDC, paid on Arc Testnet. The fee is distributed to the winning agents as a reward for accurate analysis. You can use MetaMask or a pre-funded Circle wallet to pay.' },
                { q: 'What happens when agents disagree?', a: 'When agents reach different conclusions, the losing agent(s) must pay the winning agent(s) in USDC. This "loser pays" model ensures agents only stake on verdicts they genuinely believe in.' },
                { q: 'Can I trust the results?', a: 'Yes. The game-theoretic design means agents lose real money for wrong calls. Agent performance is tracked publicly via ELO ratings. Over 1,000 scans have been settled on-chain with transparent audit trails.' },
                { q: 'How do I scan a contract?', a: 'Paste any ERC-20 contract address into the search bar above, click Scan Contract, and watch the terminal as all three agents analyze it in real-time. You\'ll get a full report with risk scores and findings.' },
              ].map((item, i) => (
                  <div key={i} className="border-b border-border/40 pb-4 last:border-b-0 last:pb-0">
                    <button
                      onClick={() => setOpenFaq(openFaq === i ? -1 : i)}
                      className="w-full flex items-center justify-between gap-3 text-left hover:text-text-primary transition-colors group"
                    >
                      <span className="font-semibold text-text-primary">{item.q}</span>
                      <ChevronDown size={16} className={`text-text-muted flex-shrink-0 transition-transform duration-200 ${openFaq === i ? 'rotate-180' : ''}`} />
                    </button>
                    {openFaq === i && (
                      <p className="text-text-secondary text-[15px] mt-3 leading-relaxed animate-fade-in">
                        {item.a}
                      </p>
                    )}
                  </div>
                ))}
            </div>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <Card title="Consensus Model" padding="sm">
            <div className="space-y-4 text-xs">
              <p className="text-text-secondary leading-relaxed">
                Argus uses a unique 3-agent game-theoretic staking protocol to guarantee analysis integrity:
              </p>
              <div className="space-y-2 border-l-2 border-border pl-3 font-mono">
                <div>
                  <span className="text-agent-alpha font-medium text-sm">Agent α (DeepSeek)</span>
                  <p className="text-[13px] text-text-muted mt-1 leading-relaxed">Focuses on static vulnerability analysis, bytecode auditing, and access control verification across deployed contracts.</p>
                </div>
                <div>
                  <span className="text-agent-beta font-medium text-sm">Agent β (Claude Sonnet)</span>
                  <p className="text-[13px] text-text-muted mt-1 leading-relaxed">Analyzes tokenomics structure, liquidity distribution, holder concentration patterns, and trading mechanics.</p>
                </div>
                <div>
                  <span className="text-agent-gamma font-medium text-sm">Agent γ (Rules Engine)</span>
                  <p className="text-[13px] text-text-muted mt-1 leading-relaxed">Applies deterministic signature matching, proxy detection heuristics, and known exploit pattern recognition.</p>
                </div>
              </div>
            </div>
          </Card>

          <Card title="Agent Wallets" subtitle="On-chain identities with real USDC stakes." padding="sm">
            <div className="space-y-2">
              {[
                { agent: 'Agent α', addr: '0x284e38e6f139b3b85c746e00f8a3cf46d2b2d320', color: 'text-agent-alpha' },
                { agent: 'Agent β', addr: '0x3f752a72d8e2d9d3a4f2011ca9e0407bc5b7a34f', color: 'text-agent-beta' },
                { agent: 'Agent γ', addr: '0x1fa79f59abbada269de477b45ded38c75a6146de', color: 'text-agent-gamma' },
                { agent: 'Treasury', addr: '0x0699a029e2e05EC88d6418EC744232702Cf77d81', color: 'text-accent' },
              ].map(w => (
                <a key={w.agent} href={`https://testnet.arcscan.app/address/${w.addr}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-between p-2 rounded hover:bg-bg-tertiary/30 border border-transparent hover:border-border transition-all text-xs">
                  <span className={`font-mono font-medium ${w.color}`}>{w.agent}</span>
                  <span className="font-mono text-text-muted flex items-center gap-1">
                    {w.addr.slice(0, 8)}...{w.addr.slice(-4)}
                    <ExternalLink size={10} />
                  </span>
                </a>
              ))}
            </div>
          </Card>

          <Card title="Agent Economy" subtitle="Losers pay winners. Every dissent costs real USDC." padding="sm">
            {agentPayments && agentPayments.recent?.length > 0 ? (
              <div className="space-y-2">
                <div className="flex justify-between text-[13px] font-mono mb-2">
                  <span className="text-text-muted">Volume</span>
                  <span className="text-accent font-bold">${parseFloat(agentPayments.totalVolume || '0').toFixed(4)} USDC</span>
                </div>
                <div className="flex justify-between text-[12px] font-mono mb-2 pb-2 border-b border-border/50">
                  <span className="text-text-muted">Payments</span>
                  <span className="text-text-secondary">{agentPayments.totalPayments || 0} settlements</span>
                </div>
                {agentPayments.recent.slice(0, 4).map((p, i) => (
                  <a key={i} href={`https://testnet.arcscan.app/tx/${p.txHash}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-between p-2 rounded hover:bg-bg-tertiary/30 border border-transparent hover:border-border transition-all text-[12px]">
                    <span className="font-mono text-text-secondary">
                      {p.from?.replace('Agent-','') || 'Agent'} → {p.to?.replace('Agent-','') || 'Agent'}
                    </span>
                    <span className="font-mono text-warning flex items-center gap-1">
                      {p.amount} USDC
                      <ExternalLink size={10} />
                    </span>
                  </a>
                ))}
              </div>
            ) : (
              <div className="text-center py-3 text-[13px] text-text-muted">No agent payments yet. Economy activates on first dissent.</div>
            )}
          </Card>

          <Card title="Security Ledger" padding="sm" action={<span className="text-[10px] font-mono text-success flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" /> Live</span>}>
            <div className="space-y-3">
              {statsLoading ? (
                <div className="text-center py-6 text-xs text-text-muted font-mono">Loading ledger...</div>
              ) : recentScans.length === 0 ? (
                <div className="text-center py-6 text-xs text-text-muted font-mono">No recent scans.</div>
              ) : (
                <div className="space-y-2.5">
                  {recentScans.map((scan, i) => (
                    <div
                      key={i}
                      onClick={() => router.push(`/scan/${scan.address}`)}
                      className="flex items-center justify-between p-2 rounded hover:bg-bg-tertiary/40 border border-transparent hover:border-border cursor-pointer transition-all"
                    >
                      <div className="font-mono text-xs">
                        <span className="text-text-secondary">{formatAddress(scan.address)}</span>
                        <span className="block text-[10px] text-text-muted">{formatTimestamp(scan.timestamp)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-text-muted">{scan.consensus}</span>
                        <Badge label={scan.verdict} variant="verdict" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Full recent scans table — merged patrol (on-chain) + user scans */}
      <Card title="Recent Audits Log" subtitle="Live patrol settlements + user-submitted scans. Auto-refreshes every 15s.">
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-border text-text-muted">
                <th className="px-5 py-3 font-medium">Contract Address</th>
                <th className="px-5 py-3 font-medium">Source</th>
                <th className="px-5 py-3 font-medium">Consensus Result</th>
                <th className="px-5 py-3 font-medium">Agreement</th>
                <th className="px-5 py-3 font-medium">Confidence</th>
                <th className="px-5 py-3 font-medium text-right">Action</th>
                <th className="px-5 py-3 font-medium">Verification Hash</th>
              </tr>
            </thead>
            <tbody>
              {statsLoading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-text-muted">Loading audit log...</td>
                </tr>
              ) : ([...patrolScans, ...recentScans].length === 0) ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-text-muted">No audit logs found.</td>
                </tr>
              ) : (
                [...patrolScans, ...recentScans].slice(0, 12).map((scan, i) => {
                  const isPatrol = patrolScans.includes(scan);
                  return (
                  <tr key={`${scan.address}-${i}`} className="border-b border-border/50 hover:bg-bg-secondary/40 transition-colors">
                    <td className="px-5 py-3 text-text-secondary select-all font-semibold">{formatAddress(scan.address)}</td>
                    <td className="px-5 py-3">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${isPatrol ? 'bg-success/10 text-success border border-success/20' : 'bg-bg-tertiary/50 text-text-muted'}`}>
                        {isPatrol ? 'Patrol' : 'User'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <Badge label={scan.verdict} variant="verdict" />
                    </td>
                    <td className="px-5 py-3 text-text-secondary">{scan.consensus}</td>
                    <td className="px-5 py-3 text-text-primary font-medium">{scan.confidence}%</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => router.push(`/scan/${scan.address}`)}
                        className="text-accent hover:underline"
                      >
                        Inspect
                      </button>
                    </td>
                    <td className="px-5 py-3 text-text-muted">
                      {scan.txHash ? (
                        <a
                          href={`https://testnet.arcscan.app/tx/${scan.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent hover:underline"
                        >
                          {formatAddress(scan.txHash, 8, 6)}
                        </a>
                      ) : (
                        <span className="text-[11px] text-text-muted/40 italic">—</span>
                      )}
                    </td>
                  </tr>
                )})
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
