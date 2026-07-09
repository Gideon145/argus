// ─── Argus Enterprise — API Client ───

import { AGENT_URL } from './constants';
import type {
  StatsData, HistoryRecord, RecentScan, PatrolRecord,
  PatrolStatus, EloData, TreasuryData, AgentPaymentData, PoolData, ScanResponse,
} from './types';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${AGENT_URL}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${AGENT_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `API error: ${res.status}`);
  }
  return res.json();
}

// ─── Public GET Endpoints ───

export const api = {
  /** Platform statistics */
  getStats: () => get<StatsData>('/stats'),

  /** Last 20 scan records */
  getHistory: () => get<HistoryRecord[]>('/history'),

  /** Recent scans feed */
  getRecentScans: (limit = 10) => get<RecentScan[]>(`/recent-scans?limit=${limit}`),

  /** Patrol scan log */
  getPatrolLog: (limit = 20) => get<PatrolRecord[]>(`/patrol-log?limit=${limit}`),

  /** Patrol status */
  getPatrolStatus: () => get<PatrolStatus>('/patrol-status'),

  /** Agent ELO leaderboard */
  getElo: () => get<EloData>('/elo'),

  /** On-chain ELO from ArgusOracle */
  getChainElo: () => get<{ agents: Record<string, number>; oracle: string }>('/chain-elo'),

  /** Treasury overview */
  getTreasury: () => get<TreasuryData>('/treasury'),

  /** Agent payment stats */
  getAgentPayments: () => get<AgentPaymentData>('/agent-payments'),

  /** Wallet pool stats */
  getPoolStats: () => get<PoolData>('/wallet/pool-stats'),

  /** USDC balance for a wallet */
  getBalance: (wallet: string) => get<{ wallet: string; balance: string }>(`/balance/${wallet}`),

  /** Health check */
  getHealth: () => get<{ status: string; uptime: number }>('/health'),

  /** Status with uptime */
  getStatus: () => get<StatsData & { uptime: number }>('/status'),

  // ─── POST Endpoints ───

  /** Assign a Circle wallet to a user */
  assignWallet: (userId: string) =>
    post<{ address: string; walletId: string; note: string }>('/wallet/assign', { userId }),

  /** Fund a wallet with test USDC */
  faucet: (wallet: string) =>
    post<{ funded: boolean; txHash: string | null; reason: string | null; amount: string }>('/faucet', { wallet }),

  /** Run a scan via Circle wallet */
  scanCircle: (userId: string, contractAddress: string, chain = 'arc', threshold = 2) =>
    post<ScanResponse>('/scan/circle', { userId, contractAddress, chain, threshold }),

  /** Run a debug scan (no payment) */
  debugScan: (contractAddress: string, chain = 'arc', threshold = 2) =>
    post<ScanResponse>('/debug/scan', { contractAddress, chain, threshold }),

  /** Run a paywalled scan (x402) */
  scan: (contractAddress: string, chain = 'arc', threshold = 2) =>
    post<ScanResponse>('/scan', { contractAddress, chain, threshold }),
};
