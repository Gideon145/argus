'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { extractFindings, computeRiskScore, verdictColor, verdictBg, verdictBorder, verdictGlow, verdictLabel, AgentCard, ExpandedAnalysis, RiskFactorItem, sortFindingsBySeverity, getKnownToken } from '@/components/ScanResults';

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

export default function ScanPage() {
  const params = useParams();
  const address = (params?.address as string) || '';
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<ScanData | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  const consensus = result?.result;
  const agents = consensus?.agents || [];
  const riskScore = consensus ? computeRiskScore(consensus.verdict, agents) : 0;
  const allFindings = agents.flatMap(a => extractFindings(a.reasoning));
  const uniqueFindings = sortFindingsBySeverity([...new Set(allFindings)]).slice(0, 8);
  const vLabel = consensus ? verdictLabel(consensus.verdict) : null;

  // Known-token intelligence — separate expected vs actual risks
  const knownToken = getKnownToken(address);
  const expectedFindings = knownToken?.expectedFindings || [];
  const actualRisks = uniqueFindings.filter(f => !expectedFindings.includes(f));
  const expectedFeatures = uniqueFindings.filter(f => expectedFindings.includes(f));

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareText = consensus
    ? `${riskScore}/100 ${consensus.verdict} · ${consensus.agreementCount}/${consensus.totalAgents} consensus — Argus`
    : `Argus scan of ${address.slice(0, 6)}...${address.slice(-4)}`;

  const handleShare = useCallback(async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share({ title: 'Argus Scan Result', text: shareText, url: shareUrl }); return; } catch {}
    }
    try { await navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  }, [shareUrl, shareText]);

  const handleTweet = useCallback(() => {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`, '_blank');
  }, [shareUrl, shareText]);

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

  // Auto-expand most important agent when scan completes
  useEffect(() => {
    if (!consensus || !agents.length) return;
    const scamAgent = agents.find(a => a.verdict === 'SCAM');
    if (scamAgent) { setExpandedAgent(scamAgent.name); return; }
    const riskyAgents = agents.filter(a => a.verdict === 'RISKY');
    if (riskyAgents.length) {
      riskyAgents.sort((a, b) => b.confidence - a.confidence);
      setExpandedAgent(riskyAgents[0].name);
      return;
    }
    const safeAgents = agents.filter(a => a.verdict === 'SAFE');
    if (safeAgents.length) {
      safeAgents.sort((a, b) => b.confidence - a.confidence);
      setExpandedAgent(safeAgents[0].name);
    }
  }, [consensus, agents]);

  return (
    <div className="min-h-screen bg-[#050816] text-[#F8F8F5]">
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        
        <header className="mb-8">
          <a href="/" className="font-cinzel text-sm text-[#D4AF37]/50 tracking-[0.2em] hover:text-[#D4AF37] transition-colors">← ARGUS</a>
        </header>

        {loading && (
          <div className="text-center py-24">
            <div className="w-10 h-10 border-2 border-[#D4AF37]/30 border-t-[#D4AF37] rounded-full animate-spin mx-auto mb-4" />
            <p className="font-mono text-base text-[#8A92A6]/40">Three agents analyzing {address.slice(0,8)}...</p>
          </div>
        )}

        {error && (
          <div className="text-center py-24">
            <p className="font-mono text-base text-[#E85555]">{error}</p>
            <a href="/" className="font-mono text-sm text-[#D4AF37]/50 hover:text-[#D4AF37] mt-4 inline-block">← Try another scan</a>
          </div>
        )}

        {!loading && consensus && (
          <div className="space-y-6">
            {/* ===== HERO VERDICT ===== */}
            <div className="rounded-2xl p-4 sm:p-5 text-center"
              style={{ background: verdictBg(consensus.verdict), border: `1px solid ${verdictBorder(consensus.verdict)}`, boxShadow: verdictGlow(consensus.verdict) }}>
              
              <p className="font-cinzel text-2xl sm:text-3xl md:text-4xl font-bold tracking-wider mb-0.5" style={{ color: verdictColor(consensus.verdict) }}>
                {consensus.verdict}
              </p>
              {vLabel && <p className="text-sm text-[#8A92A6]/50 mb-2">{vLabel.short}</p>}

              <p className="font-mono text-2xl sm:text-3xl font-bold tracking-tight mb-0.5" style={{ color: verdictColor(consensus.verdict) }}>
                {riskScore}<span className="text-lg sm:text-xl text-[#8A92A6]/30">/100</span>
              </p>
              <p className="font-mono text-xs text-[#8A92A6]/50 uppercase tracking-wider mb-2">Risk Score</p>

              <div className="flex items-center justify-center gap-3 sm:gap-4 text-xs font-mono text-[#8A92A6]/50 flex-wrap mb-2">
                <span>{consensus.agreementCount}/{consensus.totalAgents} consensus</span>
                {consensus.settlementBatchId && (
                  <><span className="text-[#8A92A6]/20">|</span><span className="text-[#3CB878]/70">Verified on-chain</span></>
                )}
                {actualRisks.length > 0 && (
                  <><span className="text-[#8A92A6]/20">|</span><span className="text-[#E85555]/70">{actualRisks.length} risk factor{actualRisks.length > 1 ? 's' : ''}</span></>
                )}
                {expectedFeatures.length > 0 && (
                  <><span className="text-[#8A92A6]/20">|</span><span className="text-[#3CB878]/70">{expectedFeatures.length} expected</span></>
                )}
              </div>

              <div className="flex items-center justify-center gap-3 sm:gap-5 text-xs font-mono flex-wrap">
                {['Agent-α', 'Agent-β', 'Agent-γ'].map(name => {
                  const meta = AGENT_META[name];
                  const agentResult = agents.find(a => a.name === name);
                  const v = agentResult?.verdict || '—';
                  return (
                    <span key={name} className="flex items-center gap-1.5">
                      <span style={{ color: meta.color }}>{meta.label}</span>
                      <span style={{ color: verdictColor(v) }}>{v}</span>
                    </span>
                  );
                })}
              </div>
            </div>

            {/* ===== KNOWN TOKEN BANNER ===== */}
            {knownToken && consensus && (
              <div className="bg-[#3CB878]/5 border border-[#3CB878]/20 rounded-xl p-4">
                <p className="text-sm font-mono text-[#3CB878] font-bold mb-1">
                  ✓ Known token: {knownToken.name}
                </p>
                <p className="text-sm text-[#8A92A6]/60 leading-relaxed">{knownToken.context}</p>
              </div>
            )}

            {/* ===== DECISION SUMMARY ===== */}
            {(actualRisks.length > 0 || expectedFeatures.length > 0) && (
              <div className="bg-[#0E1423] border border-[#D4AF37]/10 rounded-xl p-4 sm:p-5">
                <p className="font-mono text-sm text-[#8A92A6]/40 uppercase tracking-wider mb-3">
                  Why this is {consensus.verdict.toLowerCase()}
                </p>

                {/* Actual risks first */}
                {actualRisks.length > 0 && (
                  <div className="mb-4">
                    {expectedFeatures.length > 0 && (
                      <p className="text-xs font-mono text-[#E85555]/50 uppercase tracking-wider mb-2">Risk Factors</p>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3">
                      {actualRisks.map((f, j) => (
                        <RiskFactorItem key={j} factor={f} expected={false} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Expected features (known token context) */}
                {expectedFeatures.length > 0 && (
                  <div>
                    <p className="text-xs font-mono text-[#3CB878]/50 uppercase tracking-wider mb-2">
                      Expected Features for {knownToken?.name || 'this token'}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3">
                      {expectedFeatures.map((f, j) => (
                        <RiskFactorItem key={`exp-${j}`} factor={f} expected={true} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ===== AGENT CARDS ===== */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {agents.map((agent) => (
                <AgentCard
                  key={agent.name}
                  agent={agent}
                  meta={AGENT_META[agent.name] || { label: agent.name, model: '', color: '#8A92A6' }}
                  expanded={expandedAgent === agent.name}
                  onToggle={() => setExpandedAgent(expandedAgent === agent.name ? null : agent.name)}
                />
              ))}
            </div>

            {/* ===== EXPANDED ANALYSIS (full-width) ===== */}
            {expandedAgent && (() => {
              const agent = agents.find(a => a.name === expandedAgent);
              if (!agent) return null;
              return (
                <ExpandedAnalysis
                  agent={agent}
                  meta={AGENT_META[agent.name] || { label: agent.name, model: '', color: '#8A92A6' }}
                />
              );
            })()}

            {/* ===== ADDRESS + SHARE ===== */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-[#D4AF37]/5">
              <p className="font-mono text-xs text-[#8A92A6]/30 break-all text-center sm:text-left">{address}</p>
              <div className="flex items-center gap-3 flex-shrink-0">
                <a href="/" className="text-xs font-mono text-[#D4AF37]/50 hover:text-[#D4AF37] transition-colors">Scan another →</a>
                <button onClick={handleShare} className="px-3 py-1.5 rounded-lg text-xs font-mono border border-[#D4AF37]/30 text-[#D4AF37]/70 hover:bg-[#D4AF37]/10 transition-colors">
                  {copied ? '✓ Copied' : 'Copy link'}
                </button>
                <button onClick={handleTweet} className="px-3 py-1.5 rounded-lg text-xs font-mono border border-[#1DA1F2]/30 text-[#1DA1F2]/70 hover:bg-[#1DA1F2]/10 transition-colors">
                  Tweet
                </button>
              </div>
            </div>
          </div>
        )}

        <footer className="text-center pt-12 mt-12 border-t border-[#D4AF37]/5">
          <p className="text-xs font-mono text-[#8A92A6]/20">
            Argus — Multi-Agent Security Oracle · <a href="https://argusarc.xyz" className="hover:text-[#D4AF37]/40 transition-colors">argusarc.xyz</a>
          </p>
        </footer>
      </div>
    </div>
  );
}
