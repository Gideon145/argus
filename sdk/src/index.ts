/**
 * Argus SDK — Multi-Agent Security Oracle Client
 *
 * Install: npm install @argus/sdk
 *
 * @example
 * ```ts
 * import { scan, getStats, getElo } from '@argus/sdk';
 *
 * // Scan a contract
 * const result = await scan('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');
 * console.log(result.result.verdict); // 'SAFE'
 *
 * // Get live stats
 * const stats = await getStats();
 * console.log(stats.queries); // 1421
 *
 * // Get ELO leaderboard
 * const elo = await getElo();
 * console.log(elo.agents[0].name, elo.agents[0].elo);
 * ```
 */

export { scan } from './scan';
export {
  getStats,
  getElo,
  getChainElo,
  getTreasury,
  getAgentPayments,
  getPatrolLog,
  getPatrolStatus,
  healthCheck,
} from './stats';
export { configure } from './scan';
export type {
  Verdict,
  AgentVerdict,
  ScanResult,
  ScanResponse,
  EloAgent,
  StatsData,
  TreasuryData,
  AgentPayment,
  AgentPaymentData,
  PatrolRecord,
  PatrolStatus,
  ArgusConfig,
} from './types';
