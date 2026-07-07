'use client';

import { useState } from 'react';

interface AgentResult { name: string; verdict: string; confidence: number; reasoning: string; }

// ── Known tokens — features that are EXPECTED, not risks ────────────────
const KNOWN_TOKENS: Record<string, { name: string; expectedFindings: string[]; context: string }> = {
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': {
    name: 'USDC (Circle)',
    expectedFindings: ['Upgradeable proxy', 'Blacklist function', 'Unlimited minting', 'Ownership not renounced'],
    context: '$28B regulated stablecoin. Upgradeable proxy = security patches. Blacklist = OFAC compliance. Minting = Circle treasury backing. These are safety features, not risks.',
  },
  '0xdac17f958d2ee523a2206206994597c13d831ec7': {
    name: 'USDT (Tether)',
    expectedFindings: ['Upgradeable proxy', 'Blacklist function', 'Unlimited minting', 'Ownership not renounced'],
    context: '$100B+ stablecoin. Upgradeable proxy, blacklist, and controlled minting are standard for regulated fiat-backed tokens.',
  },
  '0x6b175474e89094c44da98b954eedeac495271d0f': {
    name: 'DAI (Maker)',
    expectedFindings: ['Upgradeable proxy', 'Unlimited minting'],
    context: 'Decentralized stablecoin by MakerDAO. Upgradeable via governance. Minting is collateral-backed, not malicious.',
  },
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': {
    name: 'WETH',
    expectedFindings: ['Upgradeable proxy'],
    context: 'Wrapped Ether — the most widely used ERC20 wrapper. Upgradeable for security.',
  },
  '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': {
    name: 'WBTC',
    expectedFindings: ['Upgradeable proxy', 'Ownership not renounced'],
    context: 'Wrapped Bitcoin — BitGo-custodied, upgradeable by design.',
  },
  '0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0': {
    name: 'MATIC (Polygon)',
    expectedFindings: ['Upgradeable proxy', 'Unlimited minting'],
    context: 'Polygon native token. Upgradeable via governance. Minting controlled by Polygon Foundation.',
  },
  '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984': {
    name: 'UNI (Uniswap)',
    expectedFindings: ['Upgradeable proxy', 'Ownership not renounced'],
    context: 'Uniswap governance token. Upgradeable via Uniswap DAO governance.',
  },
  '0x779ded0c9e1022225f8e0630b35a9b54be713736': {
    name: 'Testnet USDC (Arc/X Layer)',
    expectedFindings: ['Upgradeable proxy', 'Blacklist function', 'Unlimited minting', 'Ownership not renounced'],
    context: 'Arc/X Layer testnet USDC. Used across OKX.AI marketplace for agent payments. Expected: proxy, minting, blacklist for compliance.',
  },
  '0x07865c6e87b9a5e213ae308ba4f8a9aadf7e2b0c': {
    name: 'USDC',
    expectedFindings: ['Upgradeable proxy', 'Blacklist function', 'Unlimited minting', 'Ownership not renounced'],
    context: 'Regulated stablecoin. Upgradeable proxy = security patches. Blacklist = compliance. These are safety features, not risks.',
  },
};

/** Check if an address is a known safe token with expected "risk" features */
export function getKnownToken(address: string): typeof KNOWN_TOKENS[string] | null {
  return KNOWN_TOKENS[address.toLowerCase()] || null;
}

export function extractFindings(reasoning: string): string[] {
  const findings: string[] = [];
  const patterns: [RegExp, string][] = [
    [/proxy|upgradeable|upgrade|implementation/i, 'Upgradeable proxy'],
    [/owner|ownership|renounce|centralized/i, 'Ownership not renounced'],
    [/mint|unlimited|infinite/i, 'Unlimited minting'],
    [/holder|concentration|whale|single wallet|one wallet/i, 'Holder concentration'],
    [/liquidity|lp|locked|pool/i, 'Liquidity risk'],
    [/tax|fee|sell|buy|transfer fee/i, 'Tax/fee mechanics'],
    [/honeypot|cannot sell|cant sell/i, 'Honeypot indicators'],
    [/wash|fake volume|artificial/i, 'Wash trading'],
    [/blacklist|freeze|seize|restrict/i, 'Blacklist function'],
    [/address|pattern|numeric|typo|checksum/i, 'Address anomaly'],
    [/signature|replay|exploit|permit/i, 'Signature exploit risk'],
    [/ponzi|deposit.*withdraw|80%|siphon/i, 'Ponzi structure'],
    [/copy.*paste|verbatim|openzeppelin/i, 'Copy-paste code'],
    [/oracle|price|manipul|hardcode/i, 'Oracle manipulation risk'],
  ];
  for (const [regex, label] of patterns) {
    if (regex.test(reasoning)) findings.push(label);
  }
  return findings.slice(0, 5);
}

export function computeRiskScore(verdict: string, agents: AgentResult[]): number {
  if (!agents.length) return 50;
  const avgConf = agents.reduce((s, a) => s + a.confidence, 0) / agents.length;
  if (verdict === 'SAFE') return Math.round(Math.max(0, Math.min(100, 100 - avgConf)));
  if (verdict === 'RISKY') return Math.round(avgConf);
  return Math.round(Math.min(100, avgConf + 10));
}

export function verdictColor(v: string) { return v === 'SAFE' ? '#3CB878' : v === 'RISKY' ? '#E8A838' : '#E85555'; }
export function verdictBg(v: string) { return v === 'SAFE' ? 'rgba(60,184,120,0.08)' : v === 'RISKY' ? 'rgba(232,168,56,0.08)' : 'rgba(232,85,85,0.08)'; }
export function verdictBorder(v: string) { return v === 'SAFE' ? 'rgba(60,184,120,0.25)' : v === 'RISKY' ? 'rgba(232,168,56,0.25)' : 'rgba(232,85,85,0.25)'; }
export function verdictGlow(v: string) { return v === 'SAFE' ? '0 0 40px rgba(60,184,120,0.15)' : v === 'RISKY' ? '0 0 40px rgba(232,168,56,0.15)' : '0 0 40px rgba(232,85,85,0.15)'; }

export function verdictLabel(v: string) {
  if (v === 'SAFE') return { text: 'SAFE', short: 'No significant risks detected' };
  if (v === 'RISKY') return { text: 'RISKY', short: 'Exercise caution — multiple risks detected' };
  return { text: 'SCAM', short: 'High probability of fraud — avoid' };
}

const GAMMA_CHECKS = ['Signature scan', 'Pattern match', 'Bytecode audit', 'Blacklist check', 'Known exploits'];

/** Severity-ordered risk factors — most critical first */
const SEVERITY_ORDER = [
  'Honeypot indicators', 'Ponzi structure', 'Unlimited minting', 'Blacklist function',
  'Tax/fee mechanics', 'Ownership not renounced', 'Upgradeable proxy', 'Liquidity risk',
  'Holder concentration', 'Wash trading', 'Signature exploit risk', 'Oracle manipulation risk',
  'Copy-paste code', 'Address anomaly',
];

export function sortFindingsBySeverity(findings: string[]): string[] {
  return [...findings].sort((a, b) => {
    const ai = SEVERITY_ORDER.indexOf(a);
    const bi = SEVERITY_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

/** Severity level for risk factors */
const RISK_SEVERITY: Record<string, 'CRITICAL' | 'HIGH' | 'MEDIUM'> = {
  'Honeypot indicators': 'CRITICAL', 'Ponzi structure': 'CRITICAL', 'Blacklist function': 'CRITICAL',
  'Unlimited minting': 'HIGH', 'Ownership not renounced': 'HIGH', 'Upgradeable proxy': 'HIGH',
  'Tax/fee mechanics': 'HIGH', 'Signature exploit risk': 'HIGH',
  'Holder concentration': 'MEDIUM', 'Liquidity risk': 'MEDIUM', 'Wash trading': 'MEDIUM',
  'Oracle manipulation risk': 'MEDIUM', 'Copy-paste code': 'MEDIUM', 'Address anomaly': 'MEDIUM',
};

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: 'rgba(232,85,85,0.7)', HIGH: 'rgba(232,168,56,0.7)', MEDIUM: 'rgba(138,146,166,0.5)',
};

const RISK_EXPLANATIONS: Record<string, string> = {
  'Upgradeable proxy': 'The contract implementation can be replaced by the owner after deployment, potentially changing behavior after users have invested.',
  'Ownership not renounced': 'The deployer retains privileged permissions over critical functions like minting, pausing, or draining funds.',
  'Unlimited minting': 'New tokens can be created without limit, diluting existing holders and enabling inflation attacks.',
  'Holder concentration': 'A small number of wallets control most of the supply, creating centralization risk and potential for coordinated sells.',
  'Liquidity risk': 'Trading liquidity is insufficient or not locked, meaning large trades face extreme slippage or the pool can be withdrawn.',
  'Tax/fee mechanics': 'Buy or sell fees are abnormally high or can be modified, potentially trapping buyers or siphoning value.',
  'Honeypot indicators': 'The contract appears designed to prevent selling — buyers can purchase but cannot exit their position.',
  'Wash trading': 'Artificial trading volume is generated to create false impressions of demand and lure real buyers.',
  'Blacklist function': 'The owner can freeze specific addresses and prevent them from transferring or selling tokens.',
  'Address anomaly': 'The contract address shows unusual patterns that may indicate typosquatting or automated scam deployment.',
  'Signature exploit risk': 'The contract uses signature-based approvals that may be vulnerable to replay or phishing attacks.',
  'Ponzi structure': 'The contract appears to pay early investors with deposits from new users rather than generating real yield.',
  'Copy-paste code': 'The contract code is copied from known templates without meaningful changes, suggesting a lack of original development.',
  'Oracle manipulation risk': 'Price data can be manipulated because the contract uses a hardcoded or easily influenced oracle.',
};

/** Expandable risk factor — expanded by default. Green for expected features on known tokens. */
export function RiskFactorItem({ factor, expected }: { factor: string; expected?: boolean }) {
  const [open, setOpen] = useState(true);
  const explanation = RISK_EXPLANATIONS[factor];
  const severity = RISK_SEVERITY[factor] || 'MEDIUM';
  const sevColor = expected ? 'rgba(60,184,120,0.7)' : SEVERITY_COLORS[severity];
  const iconColor = expected ? '#3CB878' : '#E85555';
  const icon = expected ? '✓' : '⚠';
  return (
    <div>
      <button
        onClick={() => explanation && setOpen(!open)}
        className={`text-base font-medium flex items-center gap-2.5 w-full text-left group transition-colors ${explanation ? 'cursor-pointer' : 'cursor-default'}`}
        style={{ color: open ? '#F8F8F5' : '#8A92A6' }}
      >
        <span className="flex-shrink-0 text-lg" style={{ color: iconColor }}>{icon}</span>
        <span className="flex-1">{factor}</span>
        <span className="text-[10px] font-mono uppercase tracking-wider flex-shrink-0" style={{ color: sevColor }}>
          [{expected ? 'EXPECTED' : severity}]
        </span>
        {explanation && (
          <span className={`text-xs text-[#8A92A6]/30 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`}>▾</span>
        )}
      </button>
      {open && explanation && (
        <p className="text-base leading-relaxed ml-8 mt-2 mb-3" style={{ color: expected ? 'rgba(60,184,120,0.5)' : 'rgba(138,146,166,0.5)' }}>
          {expected ? `✅ Expected for this token: ${explanation}` : explanation}
        </p>
      )}
    </div>
  );
}

/** Compact agent card — expand triggers full-width panel below */
export function AgentCard({ agent, meta, expanded, onToggle }: {
  agent: AgentResult;
  meta: { label: string; model: string; color: string; checks?: string[] };
  expanded: boolean;
  onToggle: () => void;
}) {
  const findings = extractFindings(agent.reasoning);
  const isGamma = agent.name === 'Agent-γ';
  const confColor = verdictColor(agent.verdict);

  return (
    <div className="bg-[#0E1423] border rounded-xl overflow-hidden cursor-pointer transition-all duration-200"
      style={{ borderColor: expanded ? `${meta.color}50` : 'rgba(212,175,55,0.08)', boxShadow: expanded ? `0 0 20px ${meta.color}15` : 'none' }}
      onClick={onToggle}>
      <div className="p-5">
        <div className="flex items-center justify-between mb-2.5">
          <div>
            <p className="text-lg font-bold tracking-wide mb-0.5" style={{ color: meta.color }}>{meta.label}</p>
            <p className="text-[#8A92A6]/50 text-xs font-mono">{meta.model}</p>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider border ${
            agent.verdict === 'SAFE' ? 'bg-[#3CB878]/10 text-[#3CB878] border-[#3CB878]/20' :
            agent.verdict === 'RISKY' ? 'bg-[#E8A838]/10 text-[#E8A838] border-[#E8A838]/20' :
            'bg-[#E85555]/10 text-[#E85555] border-[#E85555]/20'
          }`}>{agent.verdict}</span>
        </div>

        {isGamma ? (
          <div className="space-y-3">
            <div>
              <p className="text-xs font-mono text-[#8A92A6]/35 uppercase tracking-wider mb-2">Passed Checks</p>
              <div className="space-y-1">
                {GAMMA_CHECKS.map((check, j) => (
                  <p key={j} className="text-sm text-[#8A92A6]/60 flex items-center gap-2">
                    <span className="text-[#3CB878] flex-shrink-0">✓</span>
                    <span>{check}</span>
                  </p>
                ))}
              </div>
            </div>
            {findings.length > 0 && (
              <div>
                <p className="text-xs font-mono text-[#8A92A6]/35 uppercase tracking-wider mb-2">Warnings</p>
                <div className="space-y-1">
                  {findings.map((f, j) => (
                    <p key={j} className="text-sm text-[#E8A838] flex items-center gap-2">
                      <span className="flex-shrink-0">⚠</span>
                      <span>{f}</span>
                    </p>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-1 pt-2 border-t border-[#D4AF37]/5">
              <div className="flex justify-between text-xs font-mono mb-1">
                <span className="text-[#8A92A6]/40">Coverage</span>
                <span className="font-bold" style={{ color: meta.color }}>{agent.confidence}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#F8F8F5]/5">
                <div className="h-2 rounded-full transition-all duration-700"
                  style={{ background: confColor, width: `${agent.confidence}%`, opacity: 0.75 }} />
              </div>
            </div>
          </div>
        ) : (
          findings.length > 0 && (
            <div className="space-y-1.5 mb-4">
              <p className="text-xs font-mono text-[#8A92A6]/35 uppercase tracking-wider mb-2">Key Findings</p>
              {findings.map((f, j) => (
                <p key={j} className="text-sm font-medium text-[#F8F8F5]/75 leading-relaxed flex items-start gap-2">
                  <span className="text-[#E85555] mt-0.5 flex-shrink-0">•</span>
                  <span>{f}</span>
                </p>
              ))}
            </div>
          )
        )}

        {/* Confidence bar — only for non-Gamma agents */}
        {!isGamma && (
          <div className="mt-1">
            <div className="flex justify-between text-xs font-mono mb-1">
              <span className="text-[#8A92A6]/40">Confidence</span>
              <span className="font-bold" style={{ color: meta.color }}>{agent.confidence}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-[#F8F8F5]/5">
              <div className="h-2 rounded-full transition-all duration-700"
                style={{ background: confColor, width: `${agent.confidence}%`, opacity: 0.75 }} />
            </div>
          </div>
        )}

        <button
          onClick={onToggle}
          className={`text-xs font-mono transition-colors flex items-center gap-1 mt-3 ${expanded ? 'text-[#D4AF37]/70' : 'text-[#8A92A6]/35 hover:text-[#D4AF37]/60'}`}
        >
          <span className={`transition-transform ${expanded ? 'rotate-90' : ''}`}>▸</span>
          {expanded ? 'Hide' : 'View'} full analysis
        </button>
      </div>
    </div>
  );
}

/** Full-width expanded analysis panel */
export function ExpandedAnalysis({ agent, meta }: {
  agent: AgentResult;
  meta: { label: string; model: string; color: string };
}) {
  const isGamma = agent.name === 'Agent-γ';
  return (
    <div className="bg-[#0E1423] rounded-xl p-6 transition-all duration-200"
      style={{ border: `1px solid ${meta.color}30`, borderLeft: `3px solid ${meta.color}`, boxShadow: `0 0 30px ${meta.color}10` }}>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-base font-semibold" style={{ color: meta.color }}>{meta.label}</span>
        <span className="text-[#8A92A6]/40 text-sm font-mono">{meta.model}</span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full uppercase border ${
          agent.verdict === 'SAFE' ? 'bg-[#3CB878]/10 text-[#3CB878] border-[#3CB878]/20' :
          agent.verdict === 'RISKY' ? 'bg-[#E8A838]/10 text-[#E8A838] border-[#E8A838]/20' :
          'bg-[#E85555]/10 text-[#E85555] border-[#E85555]/20'
        }`}>{agent.verdict}</span>
        <span className="text-xs font-mono text-[#8A92A6]/40">
          {isGamma ? `${agent.confidence}% coverage` : `${agent.confidence}% confidence`}
        </span>
      </div>
      <p className="text-[#8A92A6]/80 text-base leading-relaxed">{agent.reasoning}</p>
    </div>
  );
}
