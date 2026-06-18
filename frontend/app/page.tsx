'use client';

import { useState, useRef, useEffect } from 'react';
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

const AGENT_META: Record<string, { label: string; model: string; color: string }> = {
  'Agent-α': { label: 'Agent α', model: 'DeepSeek-V3', color: '#7eb8da' },
  'Agent-β': { label: 'Agent β', model: 'Claude Sonnet 4', color: '#D4AF37' },
  'Agent-γ': { label: 'Agent γ', model: 'Rule Engine', color: '#b57ed8' },
};

const EXAMPLES = [
  { label: 'USDC', addr: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
  { label: 'SQUID', addr: '0x87230146E138d3F296a9D162A2Dd8098f322b125' },
  { label: 'WETH', addr: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' },
];

const LIVE_FEED = [
  { time: '2s ago', addr: '0x8f3c...2a1d', verdict: 'RISKY', consensus: '2/3' },
  { time: '18s ago', addr: '0xb21a...7e3f', verdict: 'SAFE', consensus: '3/3' },
  { time: '34s ago', addr: '0x4d9e...1b8c', verdict: 'RISKY', consensus: '2/3' },
  { time: '51s ago', addr: '0xa745...9f02', verdict: 'SAFE', consensus: '3/3' },
  { time: '1m ago', addr: '0x3c1d...6e8a', verdict: 'SCAM', consensus: '3/3' },
];

export default function Home() {
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => setMousePos({ x: (e.clientX / window.innerWidth - 0.5) * 20, y: (e.clientY / window.innerHeight - 0.5) * 20 });
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  const isValidAddress = (addr: string) => /^0x[a-fA-F0-9]{40}$/.test(addr);

  const handleScan = async () => {
    if (!isValidAddress(address)) { setError('Invalid address'); return; }
    setError(''); setLoading(true); setResult(null); setElapsed(0);
    timerRef.current = setInterval(() => setElapsed(p => p + 100), 100);
    try {
      const start = performance.now();
      const res = await fetch(`${AGENT_URL}/debug/scan`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractAddress: address, chain: 'eth' }),
      });
      const data: ScanResult = await res.json();
      setResult(data);
      setElapsed(Math.round(performance.now() - start));
    } catch { setError('Agent offline'); }
    finally { if (timerRef.current) clearInterval(timerRef.current); setLoading(false); }
  };

  const selectExample = (addr: string) => { setAddress(addr); setError(''); };
  const verdictBadge = (v: string) => v === 'SAFE' ? 'badge-safe' : v === 'RISKY' ? 'badge-risky' : 'badge-scam';
  const verdictColor = (v: string) => v === 'SAFE' ? '#3CB878' : v === 'RISKY' ? '#E8A838' : '#E85555';
  const agents = result?.result?.agents || [];
  const consensus = result?.result;

  return (
    <div className="min-h-screen bg-[#050816] text-[#F8F8F5] overflow-x-hidden">
      {/* Animated starfield background */}
      <div className="fixed inset-0 z-0">
        <div className="starfield" />
        {/* Floating gold particles */}
        {Array.from({ length: 30 }, (_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: 1 + Math.random() * 2,
              height: 1 + Math.random() * 2,
              background: Math.random() > 0.5 ? '#D4AF37' : '#7eb8da',
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              opacity: 0,
            }}
            animate={{ y: [-20, -120], opacity: [0, 0.6, 0], x: [0, (Math.random() - 0.5) * 40] }}
            transition={{ duration: 3 + Math.random() * 5, repeat: Infinity, delay: Math.random() * 8, ease: 'easeInOut' }}
          />
        ))}
      </div>

      {/* Guardian figure — parallax */}
      <motion.div
        className="fixed inset-0 z-0 pointer-events-none"
        animate={{ x: mousePos.x * 0.5, y: mousePos.y * 0.5 }}
        transition={{ type: 'spring', stiffness: 50, damping: 30 }}
      >
        <GuardianFigure />
      </motion.div>

      <div className="relative z-10 min-h-screen flex flex-col">

        {/* Top bar */}
        <header className="border-b border-[#D4AF37]/10 px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <motion.span
              className="font-cinzel text-2xl tracking-[0.25em] text-[#D4AF37]"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              ARGUS
            </motion.span>
            <span className="text-[#8A92A6]/40 text-xs font-cinzel tracking-[0.2em] hidden sm:inline">Τρεις οφθαλμοί. Μια κρίσις.</span>
          </div>
          <div className="flex items-center gap-6 text-xs font-mono text-[#8A92A6]/60">
            <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#3CB878] animate-pulse" />Arc Testnet</span>
            <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#D4AF37] animate-pulse" />3 Agents Active</span>
          </div>
        </header>

        <main className="flex-1 max-w-6xl mx-auto w-full px-6 pt-12 pb-8">

          {/* === HERO + SEARCH === */}
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.3 }}
          >
            {/* Massive title */}
            <div className="relative inline-block mb-6">
              <motion.h1
                className="font-cinzel text-8xl md:text-9xl font-bold tracking-[0.2em] text-[#D4AF37] select-none"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
              >
                ARGUS
              </motion.h1>
              {/* Gold shimmer sweep */}
              <motion.div
                className="absolute inset-0"
                initial={{ x: '-100%' }}
                animate={{ x: '200%' }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 8, ease: 'easeInOut' }}
                style={{
                  background: 'linear-gradient(90deg, transparent 0%, rgba(212,175,55,0.15) 45%, rgba(255,255,255,0.25) 50%, rgba(212,175,55,0.15) 55%, transparent 100%)',
                  pointerEvents: 'none',
                }}
              />
            </div>

            <motion.p
              className="text-[#8A92A6] text-xl md:text-2xl tracking-[0.3em] font-cinzel mb-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              Τρεις οφθαλμοί. Μια κρίσις.
            </motion.p>

            <motion.p
              className="text-[#8A92A6]/70 text-base max-w-xl mx-auto leading-relaxed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
            >
              Three independent intelligence systems analyze every token contract.
              Each stakes real capital on its verdict. Consensus determines the truth.
            </motion.p>

            {/* Search bar */}
            <motion.div
              className="mt-10 max-w-2xl mx-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 }}
            >
              <div className="flex gap-3">
                <motion.div className="flex-1 relative" whileHover={{ scale: 1.01 }}>
                  <input
                    type="text"
                    placeholder="Paste token contract address..."
                    value={address}
                    onChange={(e) => { setAddress(e.target.value); setError(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && handleScan()}
                    disabled={loading}
                    className="input-gold w-full bg-[#0E1423] border border-[#D4AF37]/30 rounded-xl px-5 py-5
                               font-mono text-base text-[#F8F8F5] placeholder-[#8A92A6]/40
                               disabled:opacity-50 transition-all duration-300
                               focus:border-[#D4AF37]/60 focus:shadow-[0_0_40px_rgba(212,175,55,0.1)]"
                    autoFocus
                  />
                  {/* Scanning sweep */}
                  {loading && (
                    <motion.div
                      className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none"
                      initial={{ x: '-100%' }}
                      animate={{ x: '100%' }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                    >
                      <div className="w-20 h-full bg-gradient-to-r from-transparent via-[#D4AF37]/10 to-transparent" />
                    </motion.div>
                  )}
                </motion.div>
                <motion.button
                  onClick={handleScan}
                  disabled={loading || !isValidAddress(address)}
                  className="bg-[#D4AF37]/10 border border-[#D4AF37]/40 rounded-xl px-8 py-5
                             font-cinzel text-sm text-[#D4AF37] tracking-wider uppercase
                             hover:bg-[#D4AF37]/20 hover:shadow-[0_0_40px_rgba(212,175,55,0.2)]
                             disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-300
                             min-w-[140px] relative overflow-hidden"
                  whileHover={!loading && isValidAddress(address) ? { scale: 1.03 } : {}}
                  whileTap={!loading && isValidAddress(address) ? { scale: 0.97 } : {}}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-3">
                      <span className="w-4 h-4 border-2 border-[#D4AF37]/30 border-t-[#D4AF37] rounded-full animate-spin" />
                      {(elapsed / 1000).toFixed(1)}s
                    </span>
                  ) : 'SCAN'}
                </motion.button>
              </div>

              {/* Example addresses */}
              <div className="flex items-center justify-center gap-4 mt-3">
                {EXAMPLES.map(ex => (
                  <motion.button
                    key={ex.label}
                    onClick={() => selectExample(ex.addr)}
                    className="text-xs font-mono text-[#8A92A6]/50 hover:text-[#D4AF37]/80 transition-colors"
                    whileHover={{ scale: 1.05 }}
                  >
                    {ex.label}
                  </motion.button>
                ))}
                {error && <span className="text-[#E85555] text-xs font-mono">{error}</span>}
              </div>
            </motion.div>
          </motion.div>

          {/* === LOADING === */}
          <AnimatePresence>
            {loading && (
              <motion.div
                className="mb-8 bg-[#0E1423] border border-[#D4AF37]/10 rounded-2xl p-8 text-center"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  className="w-12 h-12 mx-auto mb-4 border-2 border-[#D4AF37]/20 border-t-[#D4AF37] rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                />
                <p className="font-mono text-sm text-[#8A92A6]">Analyzing {(elapsed / 1000).toFixed(1)}s</p>
                <p className="font-mono text-xs text-[#8A92A6]/40 mt-2">DeepSeek-V3 · Claude Sonnet 4 · Rule Engine</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* === RESULTS === */}
          <AnimatePresence>
            {!loading && consensus && (
              <motion.div
                className="space-y-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6 }}
              >
                {/* Consensus header */}
                <motion.div
                  className="bg-[#0E1423] border rounded-2xl p-6"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5 }}
                  style={{ borderColor: consensus.verdict === 'SAFE' ? 'rgba(60,184,120,0.3)' : consensus.verdict === 'RISKY' ? 'rgba(232,168,56,0.3)' : 'rgba(232,85,85,0.3)' }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-5">
                      <motion.span
                        className="font-cinzel text-4xl tracking-wider"
                        style={{ color: verdictColor(consensus.verdict) }}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
                      >
                        {consensus.agreementCount}/{consensus.totalAgents}
                      </motion.span>
                      <div>
                        <p className="font-mono text-xs text-[#8A92A6] tracking-wider uppercase">Consensus</p>
                        <motion.p
                          className="font-cinzel text-2xl tracking-wider"
                          style={{ color: verdictColor(consensus.verdict) }}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.3 }}
                        >
                          {consensus.verdict}
                        </motion.p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-xs text-[#8A92A6]">{consensus.winningAgents.join(', ')} agreed</p>
                      {consensus.settlementBatchId && (
                        <motion.p
                          className="font-mono text-xs text-[#3CB878] mt-1"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.5 }}
                        >
                          Verified on-chain · {consensus.settlementBatchId.slice(0, 14)}...
                        </motion.p>
                      )}
                    </div>
                  </div>
                </motion.div>

                {/* Agent panels */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {agents.map((agent, i) => {
                    const meta = AGENT_META[agent.name] || { label: agent.name, model: '', color: '#8A92A6' };
                    const won = consensus.winningAgents.includes(agent.name);
                    return (
                      <motion.div
                        key={agent.name}
                        className="bg-[#0E1423] border rounded-2xl overflow-hidden"
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 + i * 0.15, duration: 0.5 }}
                        whileHover={{ borderColor: meta.color + '40', y: -2 }}
                        style={{ borderColor: won ? `${meta.color}25` : 'rgba(138,146,166,0.08)' }}
                      >
                        <motion.div
                          className="h-1"
                          style={{ background: won ? verdictColor(agent.verdict) : '#1a1a2e' }}
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: 1 }}
                          transition={{ delay: 0.5 + i * 0.15, duration: 0.6 }}
                        />

                        <div className="p-5">
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <p className="font-cinzel text-sm tracking-wider" style={{ color: meta.color }}>{meta.label}</p>
                              <p className="text-[#8A92A6]/60 text-xs font-mono mt-0.5">{meta.model}</p>
                            </div>
                            <motion.span
                              className={`font-cinzel text-xs px-3 py-1 rounded-full uppercase tracking-wider ${verdictBadge(agent.verdict)}`}
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: 'spring', delay: 0.6 + i * 0.1 }}
                            >
                              {agent.verdict}
                            </motion.span>
                          </div>

                          {/* Confidence bar */}
                          <div className="mb-4">
                            <div className="flex justify-between text-xs font-mono mb-1.5">
                              <span className="text-[#8A92A6]/60">Confidence</span>
                              <motion.span
                                style={{ color: meta.color }}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.7 + i * 0.1 }}
                              >
                                {agent.confidence}%
                              </motion.span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-[#F8F8F5]/5">
                              <motion.div
                                className="h-1.5 rounded-full"
                                style={{ background: verdictColor(agent.verdict) }}
                                initial={{ width: 0 }}
                                animate={{ width: `${agent.confidence}%` }}
                                transition={{ delay: 0.7 + i * 0.1, duration: 1, ease: 'easeOut' }}
                              />
                            </div>
                          </div>

                          {/* Reasoning */}
                          <p className="text-[#8A92A6]/80 text-sm leading-relaxed">{agent.reasoning}</p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* ArcScan link */}
                {consensus.settlementBatchId && (
                  <motion.div
                    className="text-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1 }}
                  >
                    <a
                      href={`https://testnet.arcscan.app/address/${address}`}
                      target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-xs font-mono text-[#8A92A6]/40 hover:text-[#D4AF37]/60 transition-colors"
                    >
                      View on ArcScan →
                    </a>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* === EMPTY STATE === */}
          {!loading && !consensus && (
            <motion.p
              className="text-center font-mono text-sm text-[#8A92A6]/25"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5 }}
            >
              Enter a contract address to begin
            </motion.p>
          )}

          {/* === LIVE FEED === */}
          <motion.div
            className="mt-16 border-t border-[#D4AF37]/5 pt-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2 }}
          >
            <p className="font-mono text-[10px] text-[#8A92A6]/40 tracking-wider uppercase mb-3">Live Scan Activity</p>
            <div className="space-y-1">
              {LIVE_FEED.map((item, i) => (
                <motion.div
                  key={i}
                  className="flex items-center gap-4 py-1.5 text-xs font-mono"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 2 + i * 0.1 }}
                >
                  <span className="text-[#8A92A6]/30 w-14">{item.time}</span>
                  <span className="text-[#8A92A6]/50">{item.addr}</span>
                  <span className="text-[#8A92A6]/50">{item.consensus}</span>
                  <span style={{ color: verdictColor(item.verdict) }} className="uppercase tracking-wider font-cinzel text-[10px]">{item.verdict}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

        </main>

        <footer className="border-t border-[#D4AF37]/5 px-8 py-5 text-center">
          <p className="font-mono text-[10px] text-[#8A92A6]/20">
            ArgusOracle · 0x563b2DA572948C2b54B5f1f26CcFebC153Cb46C8 · Arc Testnet
          </p>
        </footer>
      </div>
    </div>
  );
}
