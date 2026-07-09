// ─── Argus Enterprise — Shared Type Definitions ───

export interface AgentResult {
  name: string;
  verdict: string;
  confidence: number;
  reasoning: string;
}

export interface ScanResultData {
  verdict: string;
  confidence: string;
  consensus: string;
  agreementCount: number;
  totalAgents: number;
  winningAgents: string[];
  losingAgents: string[];
  settlementBatchId: string;
  agents: AgentResult[];
}

export interface ScanResult {
  result?: ScanResultData;
  error?: string;
}

export interface ScanResponse {
  query: { contractAddress: string; chain: string };
  wallet?: { address: string };
  result: ScanResultData;
  payment: {
    note?: string;
    txHash?: string | null;
    paid?: string;
    payer?: string;
    settlementId?: string;
  };
}

export interface PatrolRecord {
  address: string;
  verdict: string;
  consensus: string;
  confidence: number;
  time: string;
  agentCount: number;
  winningAgents: string[];
  losingAgents: string[];
  txHash?: string;
}

export interface PatrolStatus {
  running: boolean;
  patrolsCompleted: number;
  watchlistSize: number;
  userHistoryPool: number;
  effectiveCoverage: number;
  intervalMs: number;
  nextIndex?: number;
}

export interface StatsData {
  queries: number;
  patrolQueries: number;
  consensusReached: number;
  onChainRecords: number;
  avgConfidence: number;
  status?: string;
  distinctTokens?: number;
  medianScansPerUser?: number;
  teamScansExcluded?: number;
  scansPerDay?: Record<string, number>;
  teamWallets?: string[];
}

export interface EloAgent {
  name: string;
  elo: number;
  queries: number;
  wins: number;
  losses: number;
  accuracy: number;
}

export interface EloData {
  agents: EloAgent[];
  lastUpdated: string;
}

export interface TreasuryData {
  treasury: { address: string; balance: string; explorer: string };
  funding: { address: string; balance: string; explorer: string };
  stats: StatsData;
  network: string;
}

export interface HistoryRecord {
  address: string;
  verdict: string;
  consensus: string;
  confidence: number;
  time: string;
}

export interface RecentScan {
  address: string;
  verdict: string;
  consensusVotes?: string;
  consensus?: string;
  confidence?: number;
  timestamp: string;
  txHash: string | null;
}

export interface AgentPayment {
  from: string;
  to: string;
  amount: string;
  txHash: string;
  timestamp: string;
  reason: string;
}

export interface AgentPaymentData {
  totalPayments: number;
  totalVolume: string;
  recent: AgentPayment[];
}

export interface PoolData {
  total: number;
  assigned: number;
  available: number;
  sources: Record<string, number>;
}

export interface AgentMeta {
  label: string;
  model: string;
  color: string;
  checks: string[];
}
