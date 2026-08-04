// ─── Argus Enterprise — Constants & Configuration ───

import type { AgentMeta } from './types';

export const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL || 
  (typeof window !== 'undefined' && window.location.hostname === 'localhost' 
    ? 'http://localhost:4500' 
    : 'https://argus-web-backend-production.up.railway.app');

// ─── Historical baseline stats (verifiable — README, ArcScan, on-chain) ───
export const BASELINE_STATS = {
  queries: 1504,
  patrolQueries: 2407,
  consensusReached: 1347,
  onChainRecords: 1347,
  avgConfidence: 87,
};

// Arc testnet treasury — verifiable on-chain, immutable
export const ARC_TREASURY = {
  address: '0x0699a029e2e05EC88d6418EC744232702Cf77d81',
  balance: '16.68',
  explorer: 'https://testnet.arcscan.app/address/0x0699a029e2e05EC88d6418EC744232702Cf77d81',
};

export const AGENT_META: Record<string, AgentMeta> = {
  'Agent-α': {
    label: 'Agent α',
    model: 'DeepSeek-V3',
    color: '#7EB8DA',
    checks: ['Ownership scan', 'Proxy detection', 'Honeypot check', 'Access control', 'Upgradeability'],
  },
  'Agent-β': {
    label: 'Agent β',
    model: 'Claude Sonnet 4',
    color: '#D4AF37',
    checks: ['Holder distribution', 'Whale concentration', 'LP structure', 'Trading patterns', 'Tax analysis'],
  },
  'Agent-γ': {
    label: 'Agent γ',
    model: 'Rule Engine',
    color: '#B57ED8',
    checks: ['Signature scan', 'Pattern match', 'Bytecode audit', 'Blacklist check', 'Known exploits'],
  },
};

export const AGENT_NAMES = ['Agent-α', 'Agent-β', 'Agent-γ'] as const;

export const SCAN_STEPS = [
  'Initialize Engine',
  'Load Agents',
  'Fetch ABI',
  'Analyze Ownership',
  'Analyze Bytecode',
  'Liquidity Check',
  'Permission Check',
  'Consensus Calculation',
  'Generate Report',
] as const;

export const VERDICT_CONFIG: Record<string, { color: string; bg: string; border: string; label: string; description: string }> = {
  SAFE: {
    color: '#22C55E',
    bg: 'rgba(34, 197, 94, 0.06)',
    border: 'rgba(34, 197, 94, 0.15)',
    label: 'Safe',
    description: 'No critical risks detected. Standard smart contract patterns observed.',
  },
  RISKY: {
    color: '#F59E0B',
    bg: 'rgba(245, 158, 11, 0.06)',
    border: 'rgba(245, 158, 11, 0.15)',
    label: 'Risky',
    description: 'Potential risks identified. Manual review recommended before interaction.',
  },
  SCAM: {
    color: '#EF4444',
    bg: 'rgba(239, 68, 68, 0.06)',
    border: 'rgba(239, 68, 68, 0.15)',
    label: 'Scam',
    description: 'High-risk patterns detected. Strong indicators of malicious intent.',
  },
  NO_CONSENSUS: {
    color: '#64748B',
    bg: 'rgba(100, 116, 139, 0.06)',
    border: 'rgba(100, 116, 139, 0.15)',
    label: 'No Consensus',
    description: 'Agents could not reach agreement. Insufficient data for determination.',
  },
  INSUFFICIENT_DATA: {
    color: '#64748B',
    bg: 'rgba(100, 116, 139, 0.06)',
    border: 'rgba(100, 116, 139, 0.15)',
    label: 'Insufficient Data',
    description: 'Not enough on-chain data to perform a reliable analysis.',
  },
};

export const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: '#EF4444',
  HIGH: '#F97316',
  MEDIUM: '#EAB308',
  LOW: '#22C55E',
  INFO: '#64748B',
};

export const SEVERITY_ORDER: Record<string, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  INFO: 4,
};

// On-chain addresses
export const TREASURY_ADDRESS = '0x0699a029e2e05EC88d6418EC744232702Cf77d81';
export const ORACLE_ADDRESS = '0x563b2DA572948C2b54B5f1f26CcFebC153Cb46C8';

// Arc testnet chain config
export const ARC_CHAIN_HEX = '0x4CEF52';
export const ARC_CHAIN_ID = 5042002;
export const ARC_RPC = 'https://rpc.testnet.arc.network';
export const ARC_EXPLORER = 'https://testnet.arcscan.app';

// Payment
export const PAYMENT_WEI = '0x2386f26fc10000'; // $0.01 USDC in wei (18 decimals)

// Known safe — only the ArgusOracle is recognized as an official Argus contract
export const KNOWN_SAFE: Record<string, string> = {
  '0x563b2da572948c2b54b5f1f26ccfebc153cb46c8': 'ArgusOracle — Immutable on-chain verdict log deployed by the Argus team. Upgradeable proxy is intentional for protocol governance.',
};

export function isKnownSafe(address: string): string | null {
  return KNOWN_SAFE[address.toLowerCase()] || null;
}
