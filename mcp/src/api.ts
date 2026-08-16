// Argus MCP — API client for the Argus agent backend
const ARGUS_API_URL =
  process.env.ARGUS_API_URL || "https://argus-web-backend-production.up.railway.app";

export interface AgentVerdict {
  name: string;
  verdict: string;
  confidence: number;
  reasoning: string;
}

export interface ScanReport {
  query: { contractAddress: string; chain: string };
  result: {
    verdict: string;
    confidence: string;
    consensus: string;
    agreementCount: number;
    totalAgents: number;
    winningAgents: string[];
    losingAgents: string[];
    settlementBatchId?: string;
    agents: AgentVerdict[];
  };
  payment?: { txHash?: string | null; note?: string };
}

export interface RecentScan {
  address: string;
  verdict: string;
  consensusVotes: string;
  timestamp: string;
  txHash?: string | null;
}

export interface EloAgent {
  name: string;
  elo: number;
  queries: number;
  wins: number;
  losses: number;
  accuracy: number;
}

export interface EloResponse {
  agents: EloAgent[];
  lastUpdated: string;
}

export interface PoolStats {
  total: number;
  assigned: number;
  available: number;
  baseline?: { assigned: number; available: number };
  live?: { total: number; assigned: number; available: number };
  sources?: Record<string, number>;
}

async function fetchJson<T>(path: string, init?: RequestInit, timeoutMs = 240_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${ARGUS_API_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
      signal: controller.signal,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail =
        (body as { error?: string; detail?: string }).error ||
        (body as { detail?: string }).detail ||
        `HTTP ${res.status}`;
      throw new Error(detail);
    }
    return body as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Run a full 3-agent consensus scan of a contract address */
export async function scanContract(address: string, chain = "arc", threshold = 2): Promise<ScanReport> {
  const normalized = address.toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(normalized)) {
    throw new Error(`Invalid contract address: ${address}`);
  }
  return fetchJson<ScanReport>("/debug/scan", {
    method: "POST",
    body: JSON.stringify({ contractAddress: normalized, chain, threshold }),
  });
}

/** Most recent completed scans */
export function recentScans(limit = 10): Promise<RecentScan[]> {
  const n = Math.min(50, Math.max(1, limit));
  return fetchJson<RecentScan[]>(`/recent-scans?limit=${n}`);
}

/** Live agent ELO reputation leaderboard */
export function agentElo(): Promise<EloResponse> {
  return fetchJson<EloResponse>("/elo");
}

/** Wallet pool stats (assigned / available) */
export function poolStats(): Promise<PoolStats> {
  return fetchJson<PoolStats>("/wallet/pool-stats");
}

export { ARGUS_API_URL };
