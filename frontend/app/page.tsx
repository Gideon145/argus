'use client';

import { useState, useEffect, useRef } from 'react';

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL || 'http://localhost:3001';

interface AgentResult {
  name: string;
  verdict: string;
  confidence: number;
  reasoning: string;
}

interface ScanResult {
  query?: { contractAddress: string; chain: string };
  result?: {
    verdict: string;
    confidence: string;
    consensus: string;
    agreementCount: number;
    totalAgents: number;
    winningAgents: string[];
    losingAgents: string[];
    settlementBatchId: string;
    agents: AgentResult[];
  };
  error?: string;
}

const AGENT_META: Record<string, { label: string; model: string; color: string }> = {
  'Agent-α': { label: 'Agent α', model: 'DeepSeek-V3', color: '#7eb8da' },
  'Agent-β': { label: 'Agent β', model: 'Claude Sonnet 4', color: '#D4AF37' },
  'Agent-γ': { label: 'Agent γ', model: 'Rule Engine', color: '#b57ed8' },
};

const EXAMPLE_ADDRESSES = [
  { label: 'USDC', addr: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', chain: 'eth' },
  { label: 'SQUID (rugpull)', addr: '0x87230146E138d3F296a9D162A2Dd8098f322b125', chain: 'eth' },
  { label: 'WETH', addr: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', chain: 'eth' },
];

export default function Home() {
  const [address, setAddress] = useState('');
  const [chain, setChain] = useState('eth');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const isValidAddress = (addr: string) => /^0x[a-fA-F0-9]{40}$/.test(addr);

  const handleScan = async () => {
    if (!isValidAddress(address)) { setError('Invalid address'); return; }
    setError(''); setLoading(true); setResult(null); setElapsed(0);

    timerRef.current = setInterval(() => setElapsed(p => p + 100), 100);

    try {
      const start = performance.now();
      const res = await fetch(`${AGENT_URL}/debug/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractAddress: address, chain }),
      });
      const data: ScanResult = await res.json();
      setResult(data);
      // Record real scan time
      setElapsed(Math.round(performance.now() - start));
    } catch {
      setError('Agent offline. Start with: cd agent && npm run dev');
    } finally {
      if (timerRef.current) clearInterval(timerRef.current);
      setLoading(false);
    }
  };

  const selectExample = (addr: string, c: string) => {
    setAddress(addr);
    setChain(c);
    setError('');
  };

  const verdictBadge = (v: string) =>
    v === 'SAFE' ? 'badge-safe' : v === 'RISKY' ? 'badge-risky' : 'badge-scam';

  const verdictColor = (v: string) =>
    v === 'SAFE' ? '#3CB878' : v === 'RISKY' ? '#E8A838' : '#E85555';

  const agents = result?.result?.agents || [];
  const consensus = result?.result;

  return (
    <div className="min-h-screen bg-[#050816] text-[#F8F8F5]">
      {/* Starfield */}
      <div className="starfield" />

      <div className="relative z-10 min-h-screen flex flex-col">

        {/* === TOP BAR === */}
        <header className="border-b border-[#D4AF37]/10 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-cinzel text-lg tracking-[0.2em] text-[#D4AF37] glow-gold select-none">ARGUS</span>
            <span className="text-[#8A92A6]/40 text-[10px] font-cinzel tracking-wider hidden sm:inline">
              Τρεις οφθαλμοί. Μια κρίσις.
            </span>
          </div>
          <div className="flex items-center gap-4 text-[10px] font-mono text-[#8A92A6]/60">
            <span>Arc Testnet</span>
            <span className="w-1.5 h-1.5 rounded-full bg-[#3CB878] animate-pulse" />
            <span>Live</span>
          </div>
        </header>

        {/* === MAIN === */}
        <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-8">

          {/* Search — this IS the hero */}
          <div className="mb-8">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Paste token contract address..."
                value={address}
                onChange={(e) => { setAddress(e.target.value); setError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleScan()}
                disabled={loading}
                className="input-gold flex-1 bg-[#0E1423] border border-[#D4AF37]/20 rounded-lg px-4 py-3.5
                           font-mono text-sm text-[#F8F8F5] placeholder-[#8A92A6]/40
                           disabled:opacity-50 transition-all duration-300"
                autoFocus
              />
              <button
                onClick={handleScan}
                disabled={loading || !isValidAddress(address)}
                className="bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-lg px-5 py-3.5
                           font-cinzel text-xs text-[#D4AF37] tracking-wider uppercase
                           hover:bg-[#D4AF37]/20 hover:shadow-[0_0_25px_rgba(212,175,55,0.15)]
                           disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-300
                           min-w-[120px]"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-3 h-3 border-2 border-[#D4AF37]/30 border-t-[#D4AF37] rounded-full animate-spin" />
                    {(elapsed / 1000).toFixed(1)}s
                  </span>
                ) : 'Scan'}
              </button>
            </div>

            {/* Examples + errors */}
            <div className="flex items-center gap-3 mt-2">
              {EXAMPLE_ADDRESSES.map(ex => (
                <button
                  key={ex.label}
                  onClick={() => selectExample(ex.addr, ex.chain)}
                  className="text-[10px] font-mono text-[#8A92A6]/50 hover:text-[#D4AF37]/70 transition-colors"
                >
                  {ex.label}
                </button>
              ))}
              {error && <span className="text-[#E85555] text-[10px] font-mono ml-auto">{error}</span>}
            </div>
          </div>

          {/* === LOADING STATE === */}
          {loading && (
            <div className="bg-[#0E1423] border border-[#D4AF37]/5 rounded-xl p-8 text-center mb-8">
              <div className="w-8 h-8 mx-auto mb-3 border-2 border-[#D4AF37]/20 border-t-[#D4AF37] rounded-full animate-spin" />
              <p className="font-mono text-xs text-[#8A92A6]">
                Analyzing {(elapsed / 1000).toFixed(1)}s
              </p>
              <p className="font-mono text-[10px] text-[#8A92A6]/40 mt-1">
                DeepSeek-V3 · Claude Sonnet 4 · Rule Engine
              </p>
            </div>
          )}

          {/* === RESULTS === */}
          {!loading && consensus && (
            <div className="space-y-6">

              {/* Consensus header — first thing you see */}
              <div className="bg-[#0E1423] border rounded-xl p-5" style={{
                borderColor: consensus.verdict === 'SAFE' ? 'rgba(60,184,120,0.25)' :
                  consensus.verdict === 'RISKY' ? 'rgba(232,168,56,0.25)' : 'rgba(232,85,85,0.25)'
              }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="font-cinzel text-3xl tracking-wider" style={{ color: verdictColor(consensus.verdict) }}>
                      {consensus.agreementCount}/{consensus.totalAgents}
                    </span>
                    <div>
                      <p className="font-mono text-[10px] text-[#8A92A6] tracking-wider uppercase">Consensus</p>
                      <p className="font-cinzel text-xl tracking-wider" style={{ color: verdictColor(consensus.verdict) }}>
                        {consensus.verdict}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-[10px] text-[#8A92A6]">
                      {consensus.winningAgents.join(', ')} agreed
                    </p>
                    {consensus.settlementBatchId && (
                      <p className="font-mono text-[10px] text-[#3CB878] mt-0.5">
                        Verified on-chain · {consensus.settlementBatchId.slice(0, 12)}...
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Agent panels */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {agents.map((agent, i) => {
                  const meta = AGENT_META[agent.name] || { label: agent.name, model: '', color: '#8A92A6' };
                  const won = consensus.winningAgents.includes(agent.name);
                  return (
                    <div
                      key={agent.name}
                      className="panel-enter bg-[#0E1423] border rounded-xl overflow-hidden transition-all duration-300"
                      style={{
                        borderColor: won ? `${meta.color}20` : 'rgba(138,146,166,0.08)',
                        animationDelay: `${i * 0.1}s`,
                      }}
                    >
                      {/* Top verdict strip */}
                      <div className="h-1" style={{ background: won ? verdictColor(agent.verdict) : '#1a1a2e' }} />

                      <div className="p-4">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="font-cinzel text-xs tracking-wider" style={{ color: meta.color }}>{meta.label}</p>
                            <p className="text-[#8A92A6]/60 text-[10px] font-mono">{meta.model}</p>
                          </div>
                          <span className={`font-cinzel text-[10px] px-2 py-0.5 rounded-full uppercase ${verdictBadge(agent.verdict)}`}>
                            {agent.verdict}
                          </span>
                        </div>

                        {/* Confidence bar */}
                        <div className="mb-3">
                          <div className="flex justify-between text-[10px] font-mono mb-1">
                            <span className="text-[#8A92A6]/60">Confidence</span>
                            <span style={{ color: meta.color }}>{agent.confidence}%</span>
                          </div>
                          <div className="w-full h-[2px] rounded-full bg-[#F8F8F5]/5">
                            <div
                              className="h-[2px] rounded-full transition-all duration-1000 ease-out"
                              style={{
                                width: `${agent.confidence}%`,
                                background: verdictColor(agent.verdict),
                                transitionDelay: `${i * 0.2}s`,
                              }}
                            />
                          </div>
                        </div>

                        {/* Reasoning — visible by default */}
                        <p className="text-[#8A92A6]/70 text-xs leading-relaxed">
                          {agent.reasoning}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ArcScan link */}
              {consensus.settlementBatchId && (
                <div className="text-center">
                  <a
                    href={`https://testnet.arcscan.app/address/${address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-[10px] font-mono text-[#8A92A6]/40 hover:text-[#D4AF37]/60 transition-colors"
                  >
                    View on ArcScan →
                  </a>
                </div>
              )}
            </div>
          )}

          {/* === EMPTY STATE === */}
          {!loading && !consensus && (
            <div className="text-center py-12">
              <p className="font-mono text-xs text-[#8A92A6]/30">
                Enter a contract address to begin
              </p>
            </div>
          )}

        </main>

        {/* Footer */}
        <footer className="border-t border-[#D4AF37]/5 px-6 py-4 text-center">
          <p className="font-mono text-[10px] text-[#8A92A6]/20">
            ArgusOracle · 0x563b2DA572948C2b54B5f1f26CcFebC153Cb46C8 · Arc Testnet
          </p>
        </footer>
      </div>
    </div>
  );
}
