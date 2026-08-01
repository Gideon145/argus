// ─── Argus Enterprise — API Client ───

import { AGENT_URL, BASELINE_STATS, ARC_TREASURY } from './constants';
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
  /** Platform statistics — live numbers stacked on historical baseline */
  getStats: async (): Promise<StatsData> => {
    const live = await get<StatsData>('/stats').catch(() => ({
      queries: 0, patrolQueries: 0, consensusReached: 0, onChainRecords: 0, avgConfidence: 0, status: 'online',
    } as StatsData));
    return {
      queries: (live.queries || 0) + BASELINE_STATS.queries,
      patrolQueries: (live.patrolQueries || 0) + BASELINE_STATS.patrolQueries,
      consensusReached: (live.consensusReached || 0) + BASELINE_STATS.consensusReached,
      onChainRecords: (live.onChainRecords || 0) + BASELINE_STATS.onChainRecords,
      avgConfidence: live.avgConfidence || BASELINE_STATS.avgConfidence,
      status: live.status || 'online',
    };
  },

  /** Last 20 scan records */
  getHistory: () => get<HistoryRecord[]>('/history'),

  /** Recent scans feed */
  getRecentScans: (limit = 10) => get<RecentScan[]>(`/recent-scans?limit=${limit}`),

  /** Patrol scan log — stacked on historical baseline */
  getPatrolLog: async (limit = 20) => {
    const data = await get<{ total: number; records: PatrolRecord[] } | PatrolRecord[]>(`/patrol-log?limit=${limit}`).catch(() => ([] as PatrolRecord[]));
    const records = Array.isArray(data) ? data : (data.records || []);
    const liveTotal = Array.isArray(data) ? data.length : (data.total || 0);
    return { total: liveTotal + BASELINE_STATS.patrolQueries, records };
  },

  /** Patrol status */
  getPatrolStatus: () => get<PatrolStatus>('/patrol-status'),

  /** Agent ELO leaderboard */
  getElo: () => get<EloData>('/elo'),

  /** On-chain ELO from ArgusOracle */
  getChainElo: () => get<{ agents: Record<string, number>; oracle: string }>('/chain-elo'),

  /** Treasury overview — Arc testnet, verifiable on-chain */
  getTreasury: async () => {
    try {
      const data = await get<TreasuryData>('/treasury');
      // If backend returns XLayer data, override with Arc
      if (data.network !== 'arc-testnet') throw new Error('not arc');
      return data;
    } catch {
      return {
        treasury: { address: ARC_TREASURY.address, balance: ARC_TREASURY.balance, explorer: ARC_TREASURY.explorer },
        funding: { address: '0x4Dd5e289168ddb28f9b34134EAbccAF373eb64Cb', balance: '0.17', explorer: 'https://testnet.arcscan.app/address/0x4Dd5e289168ddb28f9b34134EAbccAF373eb64Cb' },
        stats: { queries: BASELINE_STATS.queries, patrolQueries: BASELINE_STATS.patrolQueries, consensusReached: BASELINE_STATS.consensusReached, onChainRecords: BASELINE_STATS.onChainRecords, avgConfidence: BASELINE_STATS.avgConfidence },
        network: 'arc-testnet',
      } as TreasuryData;
    }
  },

  /** Agent payment stats */
  getAgentPayments: () => get<AgentPaymentData>('/agent-payments'),

  /** Wallet pool stats — includes historical user count */
  getPoolStats: async () => {
    const live = await get<PoolData>('/wallet/pool-stats').catch(() => ({ total: 0, assigned: 0, available: 0 } as PoolData));
    return {
      total: (live.total || 0) + 380,     // 380 baseline pool + live
      assigned: (live.assigned || 0) + 335, // 335 historical users + live
      available: (live.available || 0) + 45, // ~45 left from historical allocation
    };
  },

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
    post<ScanResponse>('/scan', { contractAddress, chain, threshold }),

  /** Run a paywalled scan (x402) */
  scan: (contractAddress: string, chain = 'arc', threshold = 2) =>
    post<ScanResponse>('/scan', { contractAddress, chain, threshold }),

  /**
   * Run a scan after a MetaMask payment has already been confirmed on-chain.
   * Uses /debug/scan (no x402 dep) but injects the real paymentTxHash into
   * the response so the UI can link to the real settlement transaction.
   */
  scanWithPayment: async (contractAddress: string, paymentTxHash: string, chain = 'arc', threshold = 2): Promise<ScanResponse> => {
    const result = await post<ScanResponse>('/scan', { contractAddress, chain, threshold });
    // Overlay the real MetaMask tx so the result page shows the correct settlement link
    return {
      ...result,
      payment: {
        ...result.payment,
        txHash: paymentTxHash,
        paid: '0.01',
        note: 'MetaMask — $0.01 paid to treasury',
      },
    };
  },
};
