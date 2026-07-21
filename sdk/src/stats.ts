import type { EloAgent, StatsData, TreasuryData, AgentPaymentData, PatrolRecord, PatrolStatus } from './types';

const DEFAULT_API = 'https://argus-agent-production-ab97.up.railway.app';
const DEFAULT_TIMEOUT = 30000;

// Shared with scan.ts — set via configure() from scan.ts
const _config: { apiUrl?: string; timeout?: number } = {};

export function setStatsConfig(config: { apiUrl?: string; timeout?: number }): void {
  Object.assign(_config, config);
}

function getApiUrl(): string {
  return _config.apiUrl || DEFAULT_API;
}

function getTimeout(): number {
  return _config.timeout || DEFAULT_TIMEOUT;
}

async function get<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), getTimeout());

  try {
    const res = await fetch(`${getApiUrl()}${path}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`Argus API error ${res.status}: ${await res.text().catch(() => '')}`);
    }

    return (await res.json()) as T;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error(`Argus API request timed out after ${getTimeout()}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Get live stats: scans, users, consensus rate, patrol count. */
export async function getStats(): Promise<StatsData> {
  return get<StatsData>('/stats');
}

/** Get agent ELO reputation leaderboard. */
export async function getElo(): Promise<{ agents: EloAgent[]; lastUpdated: string }> {
  return get('/elo');
}

/** Get ELO scores directly from the on-chain ArgusOracle contract. */
export async function getChainElo(): Promise<{ agents: Record<string, number>; oracle: string }> {
  return get('/chain-elo');
}

/** Get treasury overview: balances, ArcScan links, network stats. */
export async function getTreasury(): Promise<TreasuryData> {
  return get<TreasuryData>('/treasury');
}

/** Get agent-to-agent payment history and total volume. */
export async function getAgentPayments(): Promise<AgentPaymentData> {
  return get<AgentPaymentData>('/agent-payments');
}

/** Get autonomous patrol log — agents scanning on their own, every 15 min. */
export async function getPatrolLog(limit: number = 20): Promise<{ total: number; records: PatrolRecord[] }> {
  return get(`/patrol-log?limit=${limit}`);
}

/** Get patrol loop status: online, interval, watchlist size. */
export async function getPatrolStatus(): Promise<PatrolStatus> {
  return get<PatrolStatus>('/patrol-status');
}

/** Health check — returns { status: 'ok', uptime } */
export async function healthCheck(): Promise<{ status: string; uptime: number; agent: string }> {
  return get('/health');
}
