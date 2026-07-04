/**
 * Autonomous Patrol — agents scan tokens on their own, every 15 minutes.
 * No user request needed. Every patrol writes a real on-chain verdict.
 *
 * Inspired by Parry Protocol (35K+ TXs) and PROVUS (60K+ TXs) —
 * autonomous agent TX count is the hackathon-winning signal.
 */
import { Orchestrator, QueryRequest } from './orchestrator';
import { Logger } from './logger';
import { store } from './store';

/** Tokens the patrol watches — balanced mix of safe, risky, and scam tokens.
 *  Control group (SAFE) verifies agents don't false-positive.
 *  Known scams verify agents can detect real threats.
 *  Arc-native tokens verify ecosystem relevance. */
const PATROL_WATCHLIST: string[] = [
  // Arc-native (ecosystem relevance)
  '0x07865c6e87b9a5e213ae308ba4f8a9aadf7e2b0c', // USDC (Arc)
  '0xf25186a341a0b432a0e0f8a6ea1b1a4de1ea09a7', // WETH (Arc)
  // Safe bluechips (control group — should always return SAFE)
  '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC (mainnet)
  '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH (mainnet)
  '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', // UNI (mainnet)
  // Documented scams (should return SCAM or RISKY)
  '0x6944e1df6bf5972305f9ab25df47ef10de01bcc8', // Unibase AI (proxy rug, source: TokenSniffer)
  '0x603229501a2D01d5B1728Df5B00d50BcF3f4De08', // Thodex (exit scam, source: rekt.news)
  '0xC8Cac7672f4669685817cF332a33Eb249Df04aC4', // Meerkat Finance ($31M rug, source: rekt.news)
  '0x084FbB32d93AafE91468b8e323D733D38C1b4e0C', // AnubisDAO ($60M rug, source: rekt.news)
];

const PATROL_INTERVAL_MS = parseInt(process.env.PATROL_INTERVAL_MS || '900000'); // 15 min default

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

let patrolIndex = 0;
let patrolCount = 0;
let patrolTimer: ReturnType<typeof setInterval> | null = null;

function pickNextAddress(): string {
  const addr = PATROL_WATCHLIST[patrolIndex % PATROL_WATCHLIST.length];
  patrolIndex++;
  return addr;
}

export async function runPatrolCycle(
  orchestrator: Orchestrator,
  logger: Logger,
): Promise<PatrolRecord | null> {
  const address = pickNextAddress();
  patrolCount++;
  const patrolId = `patrol-${patrolCount}`;
  logger.info(`[Patrol #${patrolCount}] Autonomous scan of ${address}...`);

  try {
    const req: QueryRequest = {
      contractAddress: address,
      chain: 'eip155:5042002', // Arc testnet
      user: (process.env.PATROL_WALLET || process.env.TREASURY_ADDRESS || '0x0699a029e2e05EC88d6418EC744232702Cf77d81') as `0x${string}`,
    };

    const result = await orchestrator.processQuery(req, 2);

    const record: PatrolRecord = {
      address,
      verdict: result.finalVerdict,
      consensus: `${result.agreementCount}/${result.totalAgents}`,
      confidence: Math.round(
        result.agentVerdicts.reduce((s, v) => s + v.confidence, 0) / result.agentVerdicts.length,
      ),
      time: new Date().toISOString().replace('T', ' ').slice(0, 19),
      agentCount: result.totalAgents,
      winningAgents: result.winningAgents || [],
      losingAgents: result.losingAgents || [],
      txHash: result.settlementBatchId || undefined,
    };

    store.recordPatrol(record);
    logger.info(
      `[Patrol #${patrolCount}] ${result.finalVerdict} (${result.agreementCount}/${result.totalAgents}) — ${address}`,
    );
    return record;
  } catch (err: any) {
    logger.warn(`[Patrol #${patrolCount}] Failed for ${address}: ${err.message}`);
    return null;
  }
}

export function startPatrol(
  orchestrator: Orchestrator,
  logger: Logger,
  intervalMs: number = PATROL_INTERVAL_MS,
): void {
  if (patrolTimer) {
    logger.warn('Patrol already running — skipping duplicate start');
    return;
  }

  logger.info(`[Patrol] Starting autonomous patrol every ${Math.round(intervalMs / 1000)}s`);

  // Run first patrol after 30s (let the server settle), then on interval
  setTimeout(() => {
    runPatrolCycle(orchestrator, logger);
    patrolTimer = setInterval(() => {
      runPatrolCycle(orchestrator, logger);
    }, intervalMs);
  }, 30_000);
}

export function stopPatrol(): void {
  if (patrolTimer) {
    clearInterval(patrolTimer);
    patrolTimer = null;
  }
}

export function getPatrolStatus() {
  return {
    running: patrolTimer !== null,
    patrolsCompleted: patrolCount,
    watchlistSize: PATROL_WATCHLIST.length,
    intervalMs: PATROL_INTERVAL_MS,
    nextIndex: patrolIndex % PATROL_WATCHLIST.length,
  };
}
