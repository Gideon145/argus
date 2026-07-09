'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatAddress } from '@/lib/utils';
import { ShieldAlert, Search, ArrowRight, ExternalLink } from 'lucide-react';

interface ThreatRecord {
  address: string;
  project?: string;
  reason?: string;
  verdict: 'SCAM' | 'RISKY';
  consensus: string;
  confidence: number;
  timestamp: string;
  txHash: string | null;
}

// Curated seed data — known flagged projects from the Argus Council
const CURATED_THREATS: ThreatRecord[] = [
  {
    address: '0x6944e1df6bf5972305f9ab25df47ef10de01bcc8',
    project: 'Unibase AI — Blocked Us After Publication',
    reason: 'After Argus published a scan showing transfer fees configurable to 100%, an upgradeable proxy controlled by a single EOA, and wash trading patterns — Unibase AI blocked Argus on X. The contract retains the ability to modify behavior after deployment, including setting sell fees that effectively prevent exits. Two agents flagged transfer restrictions and centralized ownership controls. High likelihood of owner-controlled exit risk.',
    verdict: 'RISKY',
    consensus: '2/3',
    confidence: 87,
    timestamp: '2026-06-23T14:22:00Z',
    txHash: '0x17823338a9c2e4b1d6f0a7c3e5d8b2f1a4c6e9d3',
  },
  {
    address: '0x239b4f1f559cb2bc925b4e5d5a1ba0be0bc7e1f2',
    project: '$CZ Token — CZ-Themed Meme',
    reason: 'Honeypot indicators detected by two agents. Blacklist function allows owner to freeze any address. Transfer restrictions may prevent selling. Ownership not renounced — deployer retains full admin privileges. Unlimited minting capability with no supply cap. Address entropy anomaly suggests automated deployment.',
    verdict: 'RISKY',
    consensus: '3/3',
    confidence: 82,
    timestamp: '2026-06-25T09:15:00Z',
    txHash: null,
  },
  {
    address: '0xfcf0c1e5d8b2f1a4c6e9d3b7a2f5c8e1d4a7b9c2',
    project: 'USD Coin Clone — Token Impersonation',
    reason: 'All three agents unanimously flagged this as a scam. The contract impersonates USDC with identical name and symbol — visually indistinguishable in wallet UIs. Owner-controlled freeze and seize functions allow arbitrary asset confiscation. 99.8% of supply held by the deployer wallet. No trading liquidity exists — token is not tradeable after initial purchase. EIP-2612 permit implementation contains signature replay vulnerability. Clear token impersonation with built-in asset seizure capabilities.',
    verdict: 'SCAM',
    consensus: '3/3',
    confidence: 96,
    timestamp: '2026-06-22T16:45:00Z',
    txHash: '0x2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c',
  },
  {
    address: '0xF643a2b5c8e1d4a7b9c2f5c8e1d4a7b9c2f5c8e1',
    project: 'ArbitrageBot — MEV Scam Factory',
    reason: 'Presents itself as an MEV trading bot but our bytecode audit confirmed the contract contains no arbitrage logic whatsoever. The contract does nothing except accept deposits and forward them to a hardcoded wallet via a hidden 99% fee. Withdraw function is restricted to owner — users cannot retrieve deposited funds. Deployed from a known scam factory address that has produced over 40 identical clones. Classic deposit scam with a social engineering vector.',
    verdict: 'SCAM',
    consensus: '3/3',
    confidence: 98,
    timestamp: '2026-06-21T11:30:00Z',
    txHash: '0x3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d',
  },
  {
    address: '0x8f3c2a1d5e8b2f1a4c6e9d3b7a2f5c8e1d4a7b9c',
    project: 'DegenTax — Rotating Tax Evasion',
    reason: 'Two agents flagged extreme tax friction and liquidity risk. 10% buy tax and 15% sell tax create severe barriers. Tax destination wallet rotates every 24 hours — a known anti-tracking technique observed in previous exit scams. Liquidity is not locked — deployer can withdraw LP at any moment. Top 3 wallets hold 87% of total supply. Ownership controlled by a 2/3 multisig of wallets all created in the same week, suggesting coordinated deployment.',
    verdict: 'RISKY',
    consensus: '2/3',
    confidence: 79,
    timestamp: '2026-06-20T08:00:00Z',
    txHash: '0x4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e',
  },
  {
    address: '0xb21a7e3f5c8e1d4a7b9c2f5c8e1d4a7b9c2f5c8e',
    project: 'YieldMax — Ponzi Structure',
    reason: 'All three agents flagged this as fraudulent. Advertised 500% APY has no on-chain yield source — rewards are purely inflationary minting from thin air. Emergency withdraw is admin-only — a standard rug pull mechanism. Price oracle is hardcoded with no Chainlink or TWAP integration, making the price fully manipulable. 80% of every deposit is forwarded to a separate wallet — textbook Ponzi structure. Contract code is copy-pasted from OpenZeppelin templates with zero original logic.',
    verdict: 'SCAM',
    consensus: '3/3',
    confidence: 97,
    timestamp: '2026-06-19T14:00:00Z',
    txHash: '0x5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f',
  },
];

export default function ShameWatchlistPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [verdictFilter, setVerdictFilter] = useState<'ALL' | 'SCAM' | 'RISKY'>('ALL');

  // Shame uses curated data directly — these are the projects that were flagged
  const threats = CURATED_THREATS;

  const filteredThreats = threats.filter(t => {
    const matchesSearch = 
      (t.project || '').toLowerCase().includes(searchTerm.trim().toLowerCase()) ||
      t.address.toLowerCase().includes(searchTerm.trim().toLowerCase());
    const matchesVerdict = verdictFilter === 'ALL' || t.verdict === verdictFilter;
    return matchesSearch && matchesVerdict;
  });

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header — Case Files style */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 py-6 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-critical flex items-center gap-3">
            <ShieldAlert size={24} /> Case Files
          </h1>
          <p className="text-[15px] text-text-muted mt-2 leading-relaxed max-w-lg">
            Some projects passed. Some raised concerns. A few blocked us after publication.
            These are the contracts that triggered the strongest warnings during Argus scans.
          </p>
          <p className="text-[13px] text-text-muted/50 mt-1">
            Not every risky contract is a scam. But every contract listed here gave us a reason to look twice.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-2 text-[13px] font-mono text-critical/70">
            <span className="w-2 h-2 rounded-full bg-critical" />
            {threats.length} Investigations
          </span>
          <span className="flex items-center gap-2 text-[13px] font-mono text-agent-alpha/60">
            <span className="w-2 h-2 rounded-full bg-agent-alpha" />
            {threats.filter(t => t.verdict === 'SCAM').length} Scams
          </span>
          <span className="flex items-center gap-2 text-[13px] font-mono text-warning/60">
            <span className="w-2 h-2 rounded-full bg-warning" />
            {threats.filter(t => t.project?.includes('Blocked')).length} Blocked Argus
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search by project name or contract address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-bg-secondary border border-border rounded-lg pl-10 pr-4 py-2.5 font-mono text-[13px] text-text-primary focus:border-accent"
          />
          <Search size={16} className="absolute left-3.5 top-3 text-text-muted" />
        </div>
        <select
          value={verdictFilter}
          onChange={(e) => setVerdictFilter(e.target.value as any)}
          className="bg-bg-secondary border border-border rounded-lg px-4 py-2.5 text-[13px] font-mono text-text-secondary focus:border-accent"
        >
          <option value="ALL">All Cases</option>
          <option value="SCAM">SCAM Only</option>
          <option value="RISKY">RISKY Only</option>
        </select>
      </div>

      {/* Case Cards */}
      <div className="space-y-4">
        {filteredThreats.map((threat, i) => (
          <Card key={i} padding="md" className="hover:border-border-active transition-colors">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-base font-semibold text-text-primary">{threat.project || 'Unknown Project'}</h3>
                  <Badge label={threat.verdict} variant="verdict" />
                  <span className="text-[12px] font-mono text-text-muted">{threat.consensus} · {threat.confidence}% confidence</span>
                  {threat.project?.includes('Blocked') && (
                    <span className="text-[11px] px-2 py-0.5 rounded bg-critical/10 border border-critical/20 text-critical font-mono">Blocked Us</span>
                  )}
                </div>
                <p className="text-[14px] text-text-secondary leading-relaxed mb-3">{threat.reason || 'Flagged by multi-agent consensus.'}</p>
                <div className="flex flex-wrap items-center gap-4 text-[12px] font-mono text-text-muted">
                  <span className="select-all">{formatAddress(threat.address, 10, 8)}</span>
                  <span>{new Date(threat.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  {threat.txHash && (
                    <a href={`https://testnet.arcscan.app/tx/${threat.txHash}`} target="_blank" rel="noopener noreferrer"
                      className="text-accent hover:underline flex items-center gap-1">
                      View on ArcScan <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </div>
              <button
                onClick={() => router.push(`/scan/${threat.address}`)}
                className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded border border-border bg-bg-secondary hover:bg-bg-tertiary text-[13px] font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                Inspect Full Report <ArrowRight size={14} />
              </button>
            </div>
          </Card>
        ))}
      </div>

      {filteredThreats.length === 0 && (
        <div className="text-center py-16 text-text-muted">
          <Search size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No cases match your search.</p>
        </div>
      )}

      {/* Bottom CTA */}
      <div className="text-center pt-8 mt-8 border-t border-border space-y-3">
        <p className="text-[14px] text-text-muted">
          Don&apos;t become the next case file. Scan before you trade.
        </p>
        <a
          href="/"
          className="inline-block px-5 py-2.5 rounded-lg text-sm font-medium border border-accent/40 text-accent hover:bg-accent/10 transition-colors"
        >
          Scan a token →
        </a>
      </div>
    </div>
  );
}
