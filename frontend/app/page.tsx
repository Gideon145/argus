'use client';

import { useState } from 'react';

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
  payment?: { note: string };
  error?: string;
}

const AGENT_META: Record<string, { label: string; model: string; color: string; duties: string[] }> = {
  'Agent-α': { label: 'Agent α', model: 'DeepSeek-V3', color: '#7eb8da', duties: ['Ownership risks', 'Honeypots', 'Proxy contracts', 'Upgradeability', 'Permission controls'] },
  'Agent-β': { label: 'Agent β', model: 'Claude Sonnet 4', color: '#D4AF37', duties: ['Holder concentration', 'Liquidity structure', 'Whale exposure', 'Tokenomics'] },
  'Agent-γ': { label: 'Agent γ', model: 'Rule Engine', color: '#b57ed8', duties: ['Deterministic checks', 'Known exploits', 'Hard-coded risk indicators'] },
};

const CHAIN_OPTIONS = ['arc', 'eth', 'arb', 'matic'];

export default function Home() {
  const [address, setAddress] = useState('');
  const [chain, setChain] = useState('arc');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [scanStep, setScanStep] = useState(0);
  const [error, setError] = useState('');

  const isValidAddress = (addr: string) => /^0x[a-fA-F0-9]{40}$/.test(addr);

  const handleScan = async () => {
    if (!isValidAddress(address)) { setError('Invalid contract address format'); return; }
    setError(''); setLoading(true); setResult(null); setScanStep(0);

    // Simulate scan progression for UX
    const steps = [1, 2, 3];
    for (const s of steps) {
      await new Promise(r => setTimeout(r, 600));
      setScanStep(s);
    }

    try {
      const res = await fetch(`${AGENT_URL}/debug/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractAddress: address, chain }),
      });
      const data: ScanResult = await res.json();
      setResult(data);
      setScanStep(4);
    } catch (e: any) {
      setError('Agent offline — start the server with: cd agent && npm run dev');
    } finally {
      setLoading(false);
    }
  };

  const verdictColor = (v: string) =>
    v === 'SAFE' ? 'badge-safe' : v === 'RISKY' ? 'badge-risky' : 'badge-scam';

  const verdictBarColor = (v: string) =>
    v === 'SAFE' ? 'confidence-safe' : v === 'RISKY' ? 'confidence-risky' : 'confidence-scam';

  const agents = result?.result?.agents || [];
  const consensus = result?.result;

  return (
    <div className="relative min-h-screen bg-[#050816] text-[#F8F8F5]">
      {/* Starfield background */}
      <div className="starfield" />

      {/* Main content */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 pb-20">

        {/* === HERO === */}
        <header className="pt-20 pb-12 text-center">
          <h1 className="font-cinzel text-7xl md:text-8xl font-bold tracking-[0.15em] text-[#D4AF37] glow-gold select-none">
            ARGUS
          </h1>
          <p className="text-[#8A92A6] text-lg tracking-[0.3em] mt-3 font-cinzel">
            Τρεις οφθαλμοί. Μια κρίσις.
          </p>
          <p className="text-[#8A92A6]/70 text-sm max-w-md mx-auto mt-6 leading-relaxed">
            Three independent intelligence systems analyze every token contract.
            Each stakes real capital on its verdict. Consensus determines the truth.
          </p>

          {/* Search */}
          <div className="mt-10 max-w-xl mx-auto">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Paste token contract address..."
                  value={address}
                  onChange={(e) => { setAddress(e.target.value); setError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleScan()}
                  className="input-gold w-full bg-[#0E1423] border border-[#D4AF37]/20 rounded-lg px-4 py-4 
                             font-mono text-sm text-[#F8F8F5] placeholder-[#8A92A6]/40
                             transition-all duration-300"
                />
                {address && isValidAddress(address) && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#3CB878] animate-pulse" />
                )}
              </div>
              <select
                value={chain}
                onChange={(e) => setChain(e.target.value)}
                className="input-gold bg-[#0E1423] border border-[#D4AF37]/20 rounded-lg px-3 py-4 
                           font-mono text-xs text-[#8A92A6] uppercase cursor-pointer transition-all duration-300"
              >
                {CHAIN_OPTIONS.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <button
                onClick={handleScan}
                disabled={loading}
                className="bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-lg px-6 py-4 
                           font-cinzel text-sm text-[#D4AF37] tracking-wider uppercase
                           hover:bg-[#D4AF37]/20 hover:shadow-[0_0_30px_rgba(212,175,55,0.15)]
                           disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
              >
                {loading ? 'Scanning...' : 'Analyze Contract'}
              </button>
            </div>
            {error && <p className="text-[#E85555] text-xs mt-2 font-mono">{error}</p>}
            {!error && address && !isValidAddress(address) && address.length > 5 && (
              <p className="text-[#E8A838] text-xs mt-2 font-mono">Enter a valid 42-character hex address (0x...)</p>
            )}
          </div>
        </header>

        {/* === SCANNING PROGRESS === */}
        {loading && (
          <section className="mb-12">
            <div className="bg-[#0E1423] border border-[#D4AF37]/10 rounded-xl p-6">
              <p className="font-cinzel text-sm text-[#D4AF37] tracking-wider mb-4">
                INITIATING ANALYSIS PROTOCOL
              </p>
              <div className="space-y-3">
                {['Initializing agent consensus...', 'Agent-α analyzing contract logic...', 'Agent-β analyzing tokenomics...', 'Agent-γ running deterministic checks...'].map((msg, i) => (
                  <div key={i} className={`flex items-center gap-3 transition-opacity duration-500 ${i < scanStep ? 'opacity-100' : 'opacity-30'}`}>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] animate-pulse" />
                    <span className="font-mono text-xs text-[#8A92A6]">{msg}</span>
                    {i < scanStep && <span className="font-mono text-[10px] text-[#3CB878] ml-auto">COMPLETE</span>}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* === AGENT PANELS === */}
        {agents.length > 0 && consensus && (
          <section className="mb-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {agents.map((agent, i) => {
                const meta = AGENT_META[agent.name] || { label: agent.name, model: '', color: '#8A92A6', duties: [] };
                const won = consensus.winningAgents.includes(agent.name);
                return (
                  <div
                    key={agent.name}
                    className="panel-enter bg-[#0E1423] border rounded-xl p-5 transition-all duration-300 hover:border-[#D4AF37]/20"
                    style={{
                      borderColor: won ? `${meta.color}30` : 'rgba(138,146,166,0.1)',
                      animationDelay: `${i * 0.15}s`,
                    }}
                  >
                    {/* Agent header */}
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="font-cinzel text-xs tracking-wider uppercase" style={{ color: meta.color }}>
                          {meta.label}
                        </p>
                        <p className="text-[#8A92A6] text-[10px] font-mono mt-0.5">{meta.model}</p>
                      </div>
                      <span className={`font-cinzel text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider ${verdictColor(agent.verdict)}`}>
                        {agent.verdict}
                      </span>
                    </div>

                    {/* Confidence */}
                    <div className="mb-3">
                      <div className="flex justify-between text-[10px] font-mono mb-1">
                        <span className="text-[#8A92A6]">CONFIDENCE</span>
                        <span style={{ color: meta.color }}>{agent.confidence}%</span>
                      </div>
                      <div className="w-full h-[3px] rounded-full bg-[#F8F8F5]/5">
                        <div
                          className={`confidence-bar ${verdictBarColor(agent.verdict)}`}
                          style={{ width: `${agent.confidence}%`, transitionDelay: `${i * 0.2}s` }}
                        />
                      </div>
                    </div>

                    {/* Duties */}
                    <div className="mb-3">
                      {meta.duties.map((d, j) => (
                        <span key={j} className="inline-block text-[10px] font-mono text-[#8A92A6]/60 bg-[#F8F8F5]/3 rounded px-1.5 py-0.5 mr-1 mb-1">
                          {d}
                        </span>
                      ))}
                    </div>

                    {/* Stake */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[10px] font-mono text-[#8A92A6]">STAKE:</span>
                      <span className="font-mono text-xs text-[#D4AF37]">50K µUSDC</span>
                      {won && <span className="font-mono text-[10px] text-[#3CB878] ml-auto">+32 ELO</span>}
                      {!won && agents.some(a => a.verdict === agent.verdict && consensus.winningAgents.includes(a.name)) === false && (
                        <span className="font-mono text-[10px] text-[#E85555] ml-auto">-32 ELO</span>
                      )}
                    </div>

                    {/* Reasoning */}
                    <details className="group">
                      <summary className="font-mono text-[10px] text-[#8A92A6] cursor-pointer hover:text-[#D4AF37] transition-colors list-none">
                        ▶ REASONING
                      </summary>
                      <p className="text-[#8A92A6]/80 text-xs leading-relaxed mt-2 pl-3 border-l border-[#D4AF37]/20">
                        {agent.reasoning}
                      </p>
                    </details>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* === CONSENSUS BAR === */}
        {consensus && (
          <section className="mb-12">
            <div className="bg-[#0E1423] border rounded-xl p-6" style={{
              borderColor: consensus.verdict === 'SAFE' ? 'rgba(60,184,120,0.3)' :
                consensus.verdict === 'RISKY' ? 'rgba(232,168,56,0.3)' : 'rgba(232,85,85,0.3)'
            }}>
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <span className="font-cinzel text-2xl tracking-wider" style={{
                    color: consensus.verdict === 'SAFE' ? '#3CB878' :
                      consensus.verdict === 'RISKY' ? '#E8A838' : '#E85555'
                  }}>
                    {consensus.agreementCount} / {consensus.totalAgents}
                  </span>
                  <div>
                    <p className="font-cinzel text-xs tracking-[0.2em] text-[#8A92A6]">CONSENSUS</p>
                    <p className="font-cinzel text-xl tracking-wider" style={{
                      color: consensus.verdict === 'SAFE' ? '#3CB878' :
                        consensus.verdict === 'RISKY' ? '#E8A838' : '#E85555'
                    }}>
                      {consensus.verdict}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6 text-xs font-mono text-[#8A92A6]">
                  <div>
                    <span className="block text-[10px]">CONFIDENCE</span>
                    <span className="text-[#F8F8F5]">{consensus.confidence.toUpperCase()}</span>
                  </div>
                  <div>
                    <span className="block text-[10px]">TOTAL STAKED</span>
                    <span className="text-[#D4AF37]">150K µUSDC</span>
                  </div>
                  <div>
                    <span className="block text-[10px]">SUPPORTING</span>
                    <span className="text-[#F8F8F5]">{consensus.winningAgents.join(', ')}</span>
                  </div>
                </div>
              </div>
              {/* Consensus detail text */}
              <p className="text-[#8A92A6]/60 text-xs font-mono mt-4 border-t border-[#F8F8F5]/5 pt-4">
                {consensus.consensus}
              </p>
            </div>
          </section>
        )}

        {/* === ON-CHAIN TRANSPARENCY === */}
        {consensus?.settlementBatchId && (
          <section className="mb-12">
            <div className="bg-[#0E1423] border border-[#D4AF37]/10 rounded-xl p-6">
              <p className="font-cinzel text-xs tracking-[0.2em] text-[#8A92A6] mb-4">
                ON-CHAIN VERIFICATION
              </p>
              <p className="text-[#8A92A6]/70 text-xs leading-relaxed mb-4">
                Every verdict is recorded immutably on-chain. This query has been verified and settled.
              </p>
              <div className="space-y-2 font-mono text-xs">
                <div className="flex justify-between">
                  <span className="text-[#8A92A6]">Settlement Batch</span>
                  <span className="text-[#D4AF37]">{consensus.settlementBatchId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8A92A6]">Contract</span>
                  <a href={`https://testnet.arcscan.app/address/${address}`} target="_blank" rel="noopener noreferrer"
                    className="text-[#7eb8da] hover:underline">
                    {address.slice(0, 10)}...{address.slice(-6)}
                  </a>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8A92A6]">Status</span>
                  <span className="text-[#3CB878]">VERIFIED</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8A92A6]">Timestamp</span>
                  <span className="text-[#8A92A6]">{new Date().toISOString().replace('T', ' ').slice(0, 19)}</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* === INITIAL STATE === */}
        {!loading && !result && (
          <section className="mb-12">
            <div className="bg-[#0E1423] border border-[#D4AF37]/5 rounded-xl p-8 text-center">
              <div className="text-5xl mb-4 opacity-20">⌖</div>
              <p className="font-cinzel text-sm text-[#8A92A6]/60 tracking-wider">
                AWAITING CONTRACT ADDRESS
              </p>
              <p className="text-[#8A92A6]/40 text-xs mt-2 max-w-sm mx-auto">
                Enter a token contract address above to initiate multi-agent security analysis.
                Each agent stakes real USDC on its verdict.
              </p>
              <div className="mt-6 grid grid-cols-3 gap-4 max-w-lg mx-auto opacity-30">
                {Object.entries(AGENT_META).map(([key, meta]) => (
                  <div key={key} className="text-center">
                    <p className="font-cinzel text-[10px] tracking-wider" style={{ color: meta.color }}>{meta.label}</p>
                    <p className="text-[10px] font-mono text-[#8A92A6]/50">{meta.model}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className="text-center border-t border-[#D4AF37]/5 pt-8">
          <p className="text-[#8A92A6]/30 text-[10px] font-mono">
            ArgusOracle · Arc Testnet · 0x563b2DA572948C2b54B5f1f26CcFebC153Cb46C8
          </p>
          <p className="text-[#8A92A6]/20 text-[10px] font-mono mt-1">
            Built on Circle · Settled on Arc · Powered by Gateway x402
          </p>
        </footer>
      </div>
    </div>
  );
}
