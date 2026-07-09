// ─── Argus Enterprise — Shared Utilities ───

import { VERDICT_CONFIG, SEVERITY_ORDER } from './constants';

/** Get the accent color for a verdict string */
export function verdictColor(verdict: string): string {
  return VERDICT_CONFIG[verdict]?.color ?? '#64748B';
}

/** Get a subtle background color for a verdict */
export function verdictBg(verdict: string): string {
  return VERDICT_CONFIG[verdict]?.bg ?? 'rgba(100, 116, 139, 0.06)';
}

/** Get a border color for a verdict */
export function verdictBorder(verdict: string): string {
  return VERDICT_CONFIG[verdict]?.border ?? 'rgba(100, 116, 139, 0.15)';
}

/** Human-readable verdict label */
export function verdictLabel(verdict: string): string {
  return VERDICT_CONFIG[verdict]?.label ?? verdict;
}

/** Validate an Ethereum address */
export function isValidAddress(addr: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(addr);
}

/** Truncate an address to 0x1234...5678 format */
export function formatAddress(addr: string, startLen = 6, endLen = 4): string {
  if (!addr || addr.length < startLen + endLen + 2) return addr;
  return `${addr.slice(0, startLen)}...${addr.slice(-endLen)}`;
}

/** Format a timestamp for display */
export function formatTimestamp(ts: string): string {
  if (!ts) return '';
  if (ts === 'just now' || ts === 'recent') return ts;
  try {
    const date = new Date(ts);
    if (isNaN(date.getTime())) return ts;
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return ts;
  }
}

/**
 * Extract risk findings from an agent's reasoning text.
 * Looks for bullet points, numbered lists, key phrases, and risk-related sentences.
 */
export function extractFindings(reasoning: string): string[] {
  if (!reasoning) return [];
  const findings: string[] = [];
  const lines = reasoning.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // Match bullet points, numbered items, or lines starting with risk-related keywords
    if (
      /^[-•*]\s+/.test(trimmed) ||
      /^\d+[.)]\s+/.test(trimmed) ||
      /^(warning|risk|issue|concern|flag|finding|vulnerability|danger)/i.test(trimmed)
    ) {
      const cleaned = trimmed.replace(/^[-•*\d.)\s]+/, '').trim();
      if (cleaned.length > 10 && cleaned.length < 200) {
        findings.push(cleaned);
      }
    }
  }

  // Fallback: if no structured findings found, extract sentences containing risk keywords
  if (findings.length === 0) {
    const sentences = reasoning.split(/[.!?]\s+/);
    const riskKeywords = [
      'honeypot', 'proxy', 'upgradeable', 'ownership', 'renounc', 'mint',
      'blacklist', 'freeze', 'seize', 'restrict', 'transfer', 'fee', 'tax',
      'holder', 'concentrat', 'whale', 'liquidity', 'lock', 'pool',
      'exploit', 'vulnerab', 'malicious', 'scam', 'rug', 'ponzi',
      'oracle', 'manipul', 'slippage', 'delegatecall', 'permit', 'signature',
      'bytecode', 'compiler', 'admin', 'privilege', 'centraliz',
      'address anomaly', 'pattern', 'typo', 'wash trading', 'fake volume',
    ];
    for (const sentence of sentences) {
      const s = sentence.trim();
      if (s.length < 15 || s.length > 250) continue;
      const lower = s.toLowerCase();
      if (riskKeywords.some(kw => lower.includes(kw))) {
        findings.push(s.charAt(0).toUpperCase() + s.slice(1));
      }
    }
  }

  // Final fallback: extract any substantive sentence
  if (findings.length === 0) {
    const sentences = reasoning.split(/[.!?]\s+/);
    for (const sentence of sentences) {
      const s = sentence.trim();
      if (s.length > 20 && s.length < 200 && !s.startsWith('http') && !s.startsWith('0x')) {
        findings.push(s.charAt(0).toUpperCase() + s.slice(1));
        if (findings.length >= 6) break;
      }
    }
  }

  return findings.slice(0, 8);
}

/** Compute a 0-100 risk score from verdict + agent results */
export function computeRiskScore(verdict: string, agents: { verdict: string; confidence: number }[]): number {
  const base = verdict === 'SCAM' ? 85 : verdict === 'RISKY' ? 55 : 15;
  const avgConf = agents.length > 0
    ? agents.reduce((sum, a) => sum + a.confidence, 0) / agents.length
    : 50;
  const confFactor = (avgConf - 50) / 100; // -0.5 to +0.5
  return Math.min(100, Math.max(0, Math.round(base + confFactor * 20)));
}

/** Sort findings by severity keywords in their text */
export function sortFindingsBySeverity(findings: string[]): string[] {
  return [...findings].sort((a, b) => {
    const getSev = (f: string): number => {
      const lower = f.toLowerCase();
      if (lower.includes('critical') || lower.includes('scam') || lower.includes('honeypot')) return SEVERITY_ORDER.CRITICAL;
      if (lower.includes('high') || lower.includes('danger') || lower.includes('malicious')) return SEVERITY_ORDER.HIGH;
      if (lower.includes('medium') || lower.includes('warning') || lower.includes('concern')) return SEVERITY_ORDER.MEDIUM;
      if (lower.includes('low') || lower.includes('minor') || lower.includes('info')) return SEVERITY_ORDER.LOW;
      return SEVERITY_ORDER.INFO;
    };
    return getSev(a) - getSev(b);
  });
}

/** Classify a finding string into a severity level */
export function classifyFindingSeverity(finding: string): string {
  const lower = finding.toLowerCase();
  if (lower.includes('critical') || lower.includes('scam') || lower.includes('honeypot') || lower.includes('rug')) return 'CRITICAL';
  if (lower.includes('high') || lower.includes('danger') || lower.includes('malicious') || lower.includes('exploit')) return 'HIGH';
  if (lower.includes('medium') || lower.includes('warning') || lower.includes('concern') || lower.includes('suspicious')) return 'MEDIUM';
  if (lower.includes('low') || lower.includes('minor') || lower.includes('info') || lower.includes('note')) return 'LOW';
  return 'MEDIUM';
}

/** Classify a finding into a category */
export function classifyFindingCategory(finding: string): string {
  const lower = finding.toLowerCase();
  if (lower.includes('owner') || lower.includes('admin') || lower.includes('access') || lower.includes('permission')) return 'Access Control';
  if (lower.includes('proxy') || lower.includes('upgrade') || lower.includes('delegatecall')) return 'Upgradeability';
  if (lower.includes('liquidity') || lower.includes('lp') || lower.includes('pool')) return 'Liquidity';
  if (lower.includes('holder') || lower.includes('whale') || lower.includes('concentration') || lower.includes('distribution')) return 'Token Distribution';
  if (lower.includes('tax') || lower.includes('fee') || lower.includes('transfer')) return 'Transfer Mechanics';
  if (lower.includes('honeypot') || lower.includes('sell') || lower.includes('buy')) return 'Trading';
  if (lower.includes('bytecode') || lower.includes('signature') || lower.includes('pattern')) return 'Code Analysis';
  return 'General';
}

/** Get initials from an agent name like "Agent-α" → "Aα" */
export function agentInitials(name: string): string {
  const match = name.match(/Agent-(.)/);
  return match ? match[1] : name.charAt(0);
}
