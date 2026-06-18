'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GuardianFigure from '@/components/GuardianFigure';

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL || 'http://localhost:3001';

interface AgentResult { name: string; verdict: string; confidence: number; reasoning: string; }
interface ScanResult {
  result?: {
    verdict: string; confidence: string; consensus: string;
    agreementCount: number; totalAgents: number;
    winningAgents: string[]; losingAgents: string[];
    settlementBatchId: string; agents: AgentResult[];
  };
  error?: string;
}

const AGENT_META: Record<string, { label: string; model: string; color: string; checks: string[] }> = {
  'Agent-α': { label: 'Agent α', model: 'DeepSeek-V3', color: '#7eb8da', checks: ['Ownership scan', 'Proxy detection', 'Honeypot check', 'Access control', 'Upgradeability'] },
  'Agent-β': { label: 'Agent β', model: 'Claude Sonnet 4', color: '#D4AF37', checks: ['Holder distribution', 'Whale concentration', 'LP structure', 'Trading patterns', 'Tax analysis'] },
  'Agent-γ': { label: 'Agent γ', model: 'Rule Engine', color: '#b57ed8', checks: ['Signature scan', 'Pattern match', 'Bytecode audit', 'Blacklist check', 'Known exploits'] },
};

const EXAMPLES = [
  { label: 'USDC', addr: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
  { label: 'SQUID (rugpull)', addr: '0x87230146E138d3F296a9D162A2Dd8098f322b125' },
  { label: 'WETH', addr: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' },
];

const LIVE_FEED = [
  { time: '2s ago', addr: '0x8f3c...2a1d', verdict: 'RISKY' as const, consensus: '2/3' },
  { time: '18s ago', addr: '0xb21a...7e3f', verdict: 'SAFE' as const, consensus: '3/3' },
  { time: '34s ago', addr: '0x4d9e...1b8c', verdict: 'RISKY' as const, consensus: '2/3' },
  { time: '51s ago', addr: '0xa745...9f02', verdict: 'SAFE' as const, consensus: '3/3' },
  { time: '1m ago', addr: '0x3c1d...6e8a', verdict: 'SCAM' as const, consensus: '3/3' },
];

const INTEL_FEED = [
  { text: 'Consensus recorded on-chain', time: '3s ago' },
  { text: 'Agent α flagged ownership risk', time: '12s ago' },
  { text: 'New verdict finalized', time: '27s ago' },
  { text: 'Liquidity anomaly detected', time: '41s ago' },
  { text: 'Transaction batch verified', time: '55s ago' },
  { text: 'Proxy upgrade risk identified', time: '1m ago' },
];

const SCAN_STEPS = [
  'Contract validated',
  'Argus Eye activated',
  'Agent α analyzing contract logic',
  'Agent β analyzing tokenomics',
  'Agent γ running deterministic checks',
  'Consensus forming',
  'Verdict ready',
];

export default function Home() {
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState('');
  const [scanStep, setScanStep] = useState(-1);
  const [completedChecks, setCompletedChecks] = useState<Record<string, number>>({});
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const scanTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => setMousePos({ x: (e.clientX / window.innerWidth - 0.5) * 20, y: (e.clientY / window.innerHeight - 0.5) * 20 });
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  const isValidAddress = (addr: string) => /^0x[a-fA-F0-9]{40}$/.test(addr);

  const handleScan = async () => {
    if (!isValidAddress(address)) { setError('Invalid address'); return; }
    setError(''); setLoading(true); setResult(null); setScanStep(0); setCompletedChecks({});

    // Step through scan progress
    let step = 0;
    scanTimerRef.current = setInterval(() => {
      step++;
      setScanStep(step);
      // Simulate individual agent check completions
      if (step >= 2 && step <= 4) {
        const agent = step === 2 ? 'Agent-α' : step === 3 ? 'Agent-β' : 'Agent-γ';
        const totalChecks = AGENT_META[agent]?.checks.length || 5;
        let check = 0;
        const checkTimer = setInterval(() => {
          check++;
          setCompletedChecks(prev => ({ ...prev, [agent]: check }));
          if (check >= totalChecks) clearInterval(checkTimer);
        }, 200);
      }
      if (step >= 7) {
        if (scanTimerRef.current) clearInterval(scanTimerRef.current);
      }
    }, 600);

    try {
      const start = performance.now();
      const res = await fetch(`${AGENT_URL}/debug/scan`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractAddress: address, chain: 'eth' }),
      });
      const data: ScanResult = await res.json();
      setResult(data);
      setScanStep(7);
    } catch { setError('Agent offline'); setScanStep(-1); }
    finally {
      if (scanTimerRef.current) clearInterval(scanTimerRef.current);
      setLoading(false);
    }
  };

  const selectExample = (addr: string) => { setAddress(addr); setError(''); };
  const verdictBadge = (v: string) => v === 'SAFE' ? 'badge-safe' : v === 'RISKY' ? 'badge-risky' : 'badge-scam';
  const verdictColor = (v: string) => v === 'SAFE' ? '#3CB878' : v === 'RISKY' ? '#E8A838' : '#E85555';
  const feedVerdictColor = (v: string) => v === 'SAFE' ? '#3CB878' : v === 'RISKY' ? '#E8A838' : '#E85555';
  const agents = result?.result?.agents || [];
  const consensus = result?.result;
  const scanProgress = scanStep >= 0 && scanStep < 7;

  return (
    <div className="min-h-screen bg-[#050816] text-[#F8F8F5] overflow-x-hidden">
      {/* Background layers */}
      <div className="fixed inset-0 z-0">
        <div className="starfield" />
        {/* Network nodes */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.03]" viewBox="0 0 1200 800" preserveAspectRatio="none">
          {Array.from({ length: 8 }, (_, i) => (
            <circle key={i} cx={100 + Math.random() * 1000} cy={50 + Math.random() * 700} r="2" fill="#D4AF37">
              <animate attributeName="opacity" values="0.2;0.6;0.2" dur={`${3 + Math.random() * 4}s`} repeatCount="indefinite" />
            </circle>
          ))}
          {Array.from({ length: 12 }, (_, i) => {
            const x1 = 100 + (i * 90) % 1100, y1 = 50 + (i * 70) % 750;
            const x2 = x1 + (Math.random() - 0.5) * 200, y2 = y1 + (Math.random() - 0.5) * 200;
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#D4AF37" strokeWidth="0.3"><animate attributeName="opacity" values="0.1;0.3;0.1" dur={`${4 + Math.random() * 5}s`} repeatCount="indefinite" /></line>;
          })}
        </svg>
        {/* Floating particles */}
        {Array.from({ length: 25 }, (_, i) => (
          <motion.div key={i} className="absolute rounded-full"
            style={{ width: 1 + Math.random() * 2, height: 1 + Math.random() * 2, background: Math.random() > 0.5 ? '#D4AF37' : '#7eb8da', left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, opacity: 0 }}
            animate={{ y: [-20, -120], opacity: [0, 0.5, 0], x: [0, (Math.random() - 0.5) * 30] }}
            transition={{ duration: 3 + Math.random() * 5, repeat: Infinity, delay: Math.random() * 8, ease: 'easeInOut' }} />
        ))}
      </div>

      {/* Guardian parallax */}
      <motion.div className="fixed inset-0 z-0 pointer-events-none" animate={{ x: mousePos.x * 0.4, y: mousePos.y * 0.4 }} transition={{ type: 'spring', stiffness: 40, damping: 30 }}>
        <GuardianFigure />
      </motion.div>

      <div className="relative z-10 min-h-screen flex flex-col">

        {/* Top bar */}
        <header className="border-b border-[#D4AF37]/10 px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <motion.span className="font-cinzel text-2xl tracking-[0.25em] text-[#D4AF37]" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8 }}>
              ARGUS
            </motion.span>
            <span className="text-[#8A92A6]/40 text-xs font-cinzel tracking-[0.2em] hidden sm:inline">Τρεις οφθαλμοί. Μια κρίσις.</span>
          </div>
          <div className="flex items-center gap-6 text-xs font-mono text-[#8A92A6]/60">
            <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#3CB878] animate-pulse" />Arc Testnet</span>
            <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#D4AF37] animate-pulse" />3 Agents Active</span>
          </div>
        </header>

        <main className="flex-1 max-w-6xl mx-auto w-full px-6 pt-10 pb-8">

          {/* Hero + Search */}
          <motion.div className="text-center mb-8" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.3 }}>
            <div className="relative inline-block mb-4">
              <motion.h1 className="font-cinzel text-8xl md:text-9xl font-bold tracking-[0.2em] text-[#D4AF37] select-none"
                initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.2, ease: 'easeOut' }}>
                ARGUS
              </motion.h1>
              <motion.div className="absolute inset-0" initial={{ x: '-100%' }} animate={{ x: '200%' }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 8, ease: 'easeInOut' }}
                style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(212,175,55,0.12) 45%, rgba(255,255,255,0.2) 50%, rgba(212,175,55,0.12) 55%, transparent 100%)', pointerEvents: 'none' }} />
            </div>
            <motion.p className="text-[#8A92A6] text-xl md:text-2xl tracking-[0.3em] font-cinzel mb-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
              Τρεις οφθαλμοί. Μια κρίσις.
            </motion.p>
            <motion.p className="text-[#8A92A6]/70 text-base max-w-xl mx-auto leading-relaxed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>
              Three independent intelligence systems analyze every token contract. Each stakes real capital on its verdict. Consensus determines the truth.
            </motion.p>

            {/* Search */}
            <motion.div className="mt-8 max-w-2xl mx-auto" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 }}>
              <div className="flex gap-3">
                <motion.div className="flex-1 relative" whileHover={{ scale: 1.01 }}>
                  <input type="text" placeholder="Paste token contract address..." value={address}
                    onChange={(e) => { setAddress(e.target.value); setError(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && handleScan()} disabled={loading}
                    className="input-gold w-full bg-[#0E1423] border border-[#D4AF37]/30 rounded-xl px-5 py-5 font-mono text-base text-[#F8F8F5] placeholder-[#8A92A6]/40 disabled:opacity-50 transition-all duration-300 focus:border-[#D4AF37]/60 focus:shadow-[0_0_40px_rgba(212,175,55,0.1)]" autoFocus />
                  {loading && <motion.div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none" initial={{ x: '-100%' }} animate={{ x: '100%' }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}>
                    <div className="w-20 h-full bg-gradient-to-r from-transparent via-[#D4AF37]/10 to-transparent" /></motion.div>}
                </motion.div>
                <motion.button onClick={handleScan} disabled={loading || !isValidAddress(address)}
                  className="bg-[#D4AF37]/10 border border-[#D4AF37]/40 rounded-xl px-8 py-5 font-cinzel text-sm text-[#D4AF37] tracking-wider uppercase hover:bg-[#D4AF37]/20 hover:shadow-[0_0_40px_rgba(212,175,55,0.2)] disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-300 min-w-[140px] relative overflow-hidden"
                  whileHover={!loading && isValidAddress(address) ? { scale: 1.03 } : {}}
                  whileTap={!loading && isValidAddress(address) ? { scale: 0.97 } : {}}
                >
                  {loading ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-[#D4AF37]/30 border-t-[#D4AF37] rounded-full animate-spin" /></span> : 'SCAN'}
                </motion.button>
              </div>
              <div className="flex items-center justify-center gap-4 mt-3">
                {EXAMPLES.map(ex => <motion.button key={ex.label} onClick={() => selectExample(ex.addr)} className="text-xs font-mono text-[#8A92A6]/50 hover:text-[#D4AF37]/80 transition-colors" whileHover={{ scale: 1.05 }}>{ex.label}</motion.button>)}
                {error && <span className="text-[#E85555] text-xs font-mono">{error}</span>}
              </div>
            </motion.div>
          </motion.div>

          {/* Scan progress */}
          <AnimatePresence>
            {scanProgress && (
              <motion.div className="mb-8 max-w-2xl mx-auto" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                <div className="bg-[#0E1423] border border-[#D4AF37]/10 rounded-2xl p-6">
                  <p className="font-cinzel text-xs text-[#D4AF37] tracking-wider mb-4 uppercase">Analysis Protocol Active</p>
                  <div className="space-y-2">
                    {SCAN_STEPS.map((step, i) => {
                      const done = i < scanStep;
                      const active = i === scanStep;
                      return (
                        <motion.div key={i} className={`flex items-center gap-3 text-xs font-mono ${done ? 'text-[#3CB878]' : active ? 'text-[#D4AF37]' : 'text-[#8A92A6]/30'}`}
                          initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${done ? 'bg-[#3CB878]' : active ? 'bg-[#D4AF37] animate-pulse' : 'bg-[#8A92A6]/20'}`} />
                          <span className="flex-1">{step}</span>
                          {done && <span className="text-[10px]">✓</span>}
                          {active && <span className="w-16 h-3 bg-[#D4AF37]/10 rounded-full overflow-hidden"><motion.div className="h-full bg-[#D4AF37]/30 rounded-full" initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 0.6, ease: 'easeInOut' }} /></span>}
                        </motion.div>
                      );
                    })}
                  </div>
                  {/* Per-agent checks */}
                  {Object.entries(completedChecks).map(([agent, count]) => {
                    const meta = AGENT_META[agent];
                    if (!meta) return null;
                    return (
                      <div key={agent} className="mt-3 pt-3 border-t border-[#D4AF37]/5">
                        <p className="text-[10px] font-mono mb-1.5" style={{ color: meta.color }}>{meta.label} — {meta.model}</p>
                        <div className="flex flex-wrap gap-1">
                          {meta.checks.map((check, j) => (
                            <motion.span key={j} className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${j < count ? 'bg-[#3CB878]/10 text-[#3CB878]' : 'bg-[#F8F8F5]/3 text-[#8A92A6]/30'}`}
                              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: j * 0.1 }}>
                              {j < count ? '✓' : '○'} {check}
                            </motion.span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Results */}
          <AnimatePresence>
            {!loading && !scanProgress && consensus && (
              <motion.div className="space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>
                {/* Consensus header */}
                <motion.div className="bg-[#0E1423] border rounded-2xl p-6 relative overflow-hidden"
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
                  style={{ borderColor: consensus.verdict === 'SAFE' ? 'rgba(60,184,120,0.3)' : consensus.verdict === 'RISKY' ? 'rgba(232,168,56,0.3)' : 'rgba(232,85,85,0.3)' }}>
                  {/* Pulse ring on verdict */}
                  <motion.div className="absolute inset-0 rounded-2xl" initial={{ boxShadow: `0 0 0px ${verdictColor(consensus.verdict)}` }}
                    animate={{ boxShadow: [`0 0 0px ${verdictColor(consensus.verdict)}00`, `0 0 40px ${verdictColor(consensus.verdict)}15`, `0 0 0px ${verdictColor(consensus.verdict)}00`] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }} />
                  <div className="relative flex items-center justify-between">
                    <div className="flex items-center gap-5">
                      <motion.span className="font-cinzel text-4xl tracking-wider" style={{ color: verdictColor(consensus.verdict) }} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}>
                        {consensus.agreementCount}/{consensus.totalAgents}
                      </motion.span>
                      <div>
                        <p className="font-mono text-xs text-[#8A92A6] tracking-wider uppercase">Consensus</p>
                        <motion.p className="font-cinzel text-2xl tracking-wider" style={{ color: verdictColor(consensus.verdict) }} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
                          {consensus.verdict}
                        </motion.p>
                      </div>
                      {/* Vote indicators */}
                      <div className="flex gap-2 ml-4">
                        {['Agent-α', 'Agent-β', 'Agent-γ'].map((name, i) => {
                          const meta = AGENT_META[name];
                          const agreed = consensus.winningAgents.includes(name);
                          return (
                            <motion.div key={name} className="w-3 h-3 rounded-full" style={{ background: agreed ? meta.color : '#1a1a2e', boxShadow: agreed ? `0 0 8px ${meta.color}` : 'none' }}
                              initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.4 + i * 0.1, type: 'spring' }} />
                          );
                        })}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-xs text-[#8A92A6]">{consensus.winningAgents.join(', ')} agreed</p>
                      {consensus.settlementBatchId && (
                        <motion.p className="font-mono text-xs text-[#3CB878] mt-1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
                          Verified on-chain · {consensus.settlementBatchId.slice(0, 14)}...
                        </motion.p>
                      )}
                    </div>
                  </div>
                </motion.div>

                {/* Agent panels */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {agents.map((agent, i) => {
                    const meta = AGENT_META[agent.name] || { label: agent.name, model: '', color: '#8A92A6', checks: [] };
                    const won = consensus.winningAgents.includes(agent.name);
                    return (
                      <motion.div key={agent.name} className="bg-[#0E1423] border rounded-2xl overflow-hidden group"
                        initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.15, duration: 0.5 }}
                        whileHover={{ borderColor: meta.color + '50', y: -2 }} style={{ borderColor: won ? `${meta.color}25` : 'rgba(138,146,166,0.08)' }}>
                        <motion.div className="h-1" style={{ background: won ? verdictColor(agent.verdict) : '#1a1a2e' }} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.5 + i * 0.15, duration: 0.6 }} />
                        <div className="p-5">
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: meta.color }} />
                                <p className="font-cinzel text-sm tracking-wider" style={{ color: meta.color }}>{meta.label}</p>
                              </div>
                              <p className="text-[#8A92A6]/60 text-xs font-mono mt-0.5">{meta.model}</p>
                            </div>
                            <motion.span className={`font-cinzel text-xs px-3 py-1 rounded-full uppercase tracking-wider ${verdictBadge(agent.verdict)}`}
                              initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.6 + i * 0.1 }}>
                              {agent.verdict}
                            </motion.span>
                          </div>
                          <div className="mb-4">
                            <div className="flex justify-between text-xs font-mono mb-1.5">
                              <span className="text-[#8A92A6]/60">Confidence</span>
                              <motion.span style={{ color: meta.color }}>{agent.confidence}%</motion.span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-[#F8F8F5]/5">
                              <motion.div className="h-1.5 rounded-full" style={{ background: verdictColor(agent.verdict) }} initial={{ width: 0 }} animate={{ width: `${agent.confidence}%` }} transition={{ delay: 0.7 + i * 0.1, duration: 1, ease: 'easeOut' }} />
                            </div>
                          </div>
                          <p className="text-[#8A92A6]/80 text-sm leading-relaxed">{agent.reasoning}</p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* ArcScan link */}
                {consensus.settlementBatchId && (
                  <motion.div className="text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>
                    <a href={`https://testnet.arcscan.app/address/${address}`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-xs font-mono text-[#8A92A6]/40 hover:text-[#D4AF37]/60 transition-colors">
                      View on ArcScan →
                    </a>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Empty state */}
          {!loading && !scanProgress && !consensus && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl mx-auto">
              {/* Live scan feed */}
              <motion.div className="bg-[#0E1423] border border-[#D4AF37]/5 rounded-2xl p-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.5 }}>
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-2 h-2 rounded-full bg-[#3CB878] animate-pulse" />
                  <p className="font-mono text-[10px] text-[#8A92A6]/60 tracking-wider uppercase">Live Scan Activity</p>
                </div>
                <div className="space-y-1.5">
                  {LIVE_FEED.map((item, i) => (
                    <motion.div key={i} className="flex items-center gap-3 text-xs font-mono py-1.5 border-b border-[#D4AF37]/3 last:border-0"
                      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.6 + i * 0.1 }}>
                      <span className="text-[#8A92A6]/30 w-14 flex-shrink-0">{item.time}</span>
                      <span className="text-[#8A92A6]/50">{item.addr}</span>
                      <span className="text-[#8A92A6]/50">{item.consensus}</span>
                      <span className="uppercase tracking-wider font-cinzel text-[10px] ml-auto" style={{ color: feedVerdictColor(item.verdict) }}>{item.verdict}</span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              {/* Intelligence feed */}
              <motion.div className="bg-[#0E1423] border border-[#D4AF37]/5 rounded-2xl p-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.7 }}>
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-2 h-2 rounded-full bg-[#D4AF37] animate-pulse" />
                  <p className="font-mono text-[10px] text-[#8A92A6]/60 tracking-wider uppercase">Intelligence Feed</p>
                </div>
                <div className="space-y-1.5">
                  {INTEL_FEED.map((item, i) => (
                    <motion.div key={i} className="flex items-center gap-3 text-xs font-mono py-1.5 border-b border-[#D4AF37]/3 last:border-0"
                      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.8 + i * 0.1 }}>
                      <span className="text-[#8A92A6]/30 w-14 flex-shrink-0">{item.time}</span>
                      <span className="text-[#8A92A6]/50">{item.text}</span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </div>
          )}
        </main>

        <footer className="border-t border-[#D4AF37]/5 px-8 py-5 text-center">
          <p className="font-mono text-[10px] text-[#8A92A6]/20">ArgusOracle · 0x563b2DA572948C2b54B5f1f26CcFebC153Cb46C8 · Arc Testnet</p>
        </footer>
      </div>
    </div>
  );
}
