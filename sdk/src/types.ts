/** Argus SDK — shared types for scan results, agent data, and API responses */

export type Verdict = 'SAFE' | 'RISKY' | 'SCAM' | 'UNKNOWN';

export interface AgentVerdict {
  name: string;
  verdict: Verdict;
  confidence: number;
  reasoning: string;
}

export interface ScanResult {
  verdict: Verdict;
  confidence: 'high' | 'medium' | 'none';
  consensus: string;
  agreementCount: number;
  totalAgents: number;
  winningAgents: string[];
  losingAgents: string[];
  settlementBatchId: string | null;
  agents: AgentVerdict[];
}

export interface ScanResponse {
  query: {
    contractAddress: string;
    chain: string;
  };
  result: ScanResult;
}

export interface EloAgent {
  name: string;
  elo: number;
  queries: number;
  accuracy?: number;
}

export interface StatsData {
  queries: number;
  patrolQueries: number;
  consensusReached: number;
  onChainRecords: number;
  avgConfidence: number;
  status: string;
  distinctTokens: number;
  scansPerDay: Record<string, number>;
}

export interface TreasuryData {
  treasury: {
    address: string;
    balance: string;
    explorer: string;
  };
  funding: {
    address: string;
    balance: string;
    explorer: string;
  };
  stats: StatsData;
  network: string;
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

export interface PatrolRecord {
  address: string;
  verdict: string;
  consensus: string;
  confidence: number;
  timestamp: string;
  txHash: string | null;
}

export interface PatrolStatus {
  online: boolean;
  loopIntervalMs: number;
  watchlistSize: number;
  lastPatrolAt: string | null;
}

export interface ArgusConfig {
  /** Base URL of the Argus agent API. Defaults to production. */
  apiUrl?: string;
  /** Request timeout in ms. Defaults to 30000. */
  timeout?: number;
}
