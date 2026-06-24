'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useParams } from 'next/navigation';

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL || 'http://localhost:3001';

interface AgentResult { name: string; verdict: string; confidence: number; reasoning: string; }
interface ScanData {
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

function verdictColor(v: string) { return v === 'SAFE' ? '#3CB878' : v === 'RISKY' ? '#E8A838' : '#E85555'; }
function verdictBadge(v: string) { return v === 'SAFE' ? 'bg-[#3CB878]/10 text-[#3CB878] border-[#3CB878]/20' : v === 'RISKY' ? 'bg-[#E8A838]/10 text-[#E8A838] border-[#E8A838]/20' : 'bg-[#E85555]/10 text-[#E85555] border-[#E85555]/20'; }

export default function ScanPage() {
  const params = useParams();
  const address = (params?.address as string) || '';
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<ScanData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      setError('Invalid address');
      setLoading(false);
      return;
    }

    const scan = async () => {
      try {
        // Try cached scan first (debug endpoint may have cache)
        const res = await fetch(`${AGENT_URL}/debug/scan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contractAddress: address, chain: 'arc', threshold: 2 }),
        });
        if (res.ok) {
          setResult(await res.json());
        } else {
          setError('Scan failed');
        }
      } catch {
        setError('Agent unreachable. Try again shortly.');
      }
      setLoading(false);
    };
    scan();
  }, [address]);

  const consensus = result?.result;
  const agents = consensus?.agents || [];

  return (
    <div className="min-h-screen bg-[#050816] text-[#F8F8F5]">
      <div className="fixed inset-0 z-0"><div className="starfield" /></div>
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        
        <header className="mb-10 text-center">
          <a href="/" className="font-cinzel text-sm text-[#D4AF37]/60 tracking-[0.2em] hover:text-[#D4AF37] transition-colors">← ARGUS</a>
          <h1 className="font-cinzel text-2xl sm:text-3xl font-bold tracking-wider text-[#D4AF37] mt-4">Token Scan</h1>
          <p className="font-mono text-xs text-[#8A92A6]/40 mt-2 break-all">{address}</p>
        </header>

        {loading && (
          <div className="text-center py-20">
            <motion.div className="w-8 h-8 border-2 border-[#D4AF37]/30 border-t-[#D4AF37] rounded-full animate-spin mx-auto mb-4" />
            <p className="font-mono text-sm text-[#8A92A6]/60">Three agents analyzing...</p>
          </div>
        )}

        {error && (
          <div className="text-center py-20">
            <p className="font-mono text-sm text-[#E85555]">{error}</p>
            <a href="/" className="font-mono text-xs text-[#D4AF37]/60 hover:text-[#D4AF37] mt-4 inline-block">← Try another scan</a>
          </div>
        )}

        {!loading && consensus && (
          <div className="space-y-6">
            {/* Verdict header */}
            <motion.div className="bg-[#0E1423] border rounded-2xl p-6 text-center" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              style={{ borderColor: consensus.verdict === 'SAFE' ? 'rgba(60,184,120,0.3)' : consensus.verdict === 'RISKY' ? 'rgba(232,168,56,0.3)' : 'rgba(232,85,85,0.3)' }}>
              <motion.div className="text-5xl sm:text-6xl font-cinzel font-bold tracking-wider mb-3" style={{ color: verdictColor(consensus.verdict) }}
                initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}>
                {consensus.agreementCount}/{consensus.totalAgents}
              </motion.div>
              <p className="font-mono text-xs text-[#8A92A6] tracking-wider uppercase mb-2">Consensus</p>
              <p className="font-cinzel text-2xl sm:text-3xl tracking-wider" style={{ color: verdictColor(consensus.verdict) }}>{consensus.verdict}</p>
              <p className="font-mono text-xs text-[#8A92A6]/60 mt-2">{consensus.winningAgents.join(', ')} agreed</p>
              {consensus.settlementBatchId && (
                <p className="font-mono text-xs text-[#3CB878] mt-1">Verified on-chain</p>
              )}
            </motion.div>

            {/* Agent cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {agents.map((agent: AgentResult, i: number) => {
                const meta = AGENT_META[agent.name] || { label: agent.name, model: '', color: '#8A92A6' };
                return (
                  <motion.div key={agent.name} className="bg-[#0E1423] border border-[#D4AF37]/10 rounded-xl p-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.1 }}>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-cinzel text-sm tracking-wider" style={{ color: meta.color }}>{meta.label}</p>
                        <p className="text-[#8A92A6]/40 text-xs font-mono">{meta.model}</p>
                      </div>
                      <span className={`font-cinzel text-xs px-2 py-1 rounded-full uppercase tracking-wider border ${verdictBadge(agent.verdict)}`}>{agent.verdict}</span>
                    </div>
                    <div className="mb-3">
                      <div className="flex justify-between text-xs font-mono mb-1">
                        <span className="text-[#8A92A6]/40">Confidence</span>
                        <span style={{ color: meta.color }}>{agent.confidence}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-[#F8F8F5]/5">
                        <div className="h-1.5 rounded-full" style={{ background: verdictColor(agent.verdict), width: `${agent.confidence}%` }} />
                      </div>
                    </div>
                    <p className="text-[#8A92A6]/70 text-xs leading-relaxed">{agent.reasoning}</p>
                  </motion.div>
                );
              })}
            </div>

            {/* CTA */}
            <div className="text-center pt-6 border-t border-[#D4AF37]/5">
              <p className="font-mono text-xs text-[#8A92A6]/40 mb-3">Scan any token in 30 seconds. No MetaMask needed.</p>
              <a href="/" className="inline-block px-4 py-2 rounded-lg text-xs font-cinzel tracking-wider border border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/10 transition-colors">
                Scan another token →
              </a>
            </div>
          </div>
        )}

        <footer className="text-center pt-12 mt-12 border-t border-[#D4AF37]/5">
          <p className="text-xs font-mono text-[#8A92A6]/20">
            Powered by Argus — Multi-Agent Security Oracle · <a href="https://argusarc.xyz" className="hover:text-[#D4AF37]/40 transition-colors">argusarc.xyz</a>
          </p>
        </footer>
      </div>
    </div>
  );
}
