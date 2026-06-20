import { Verdict, ConsensusResult } from './orchestrator';

/**
 * ELO reputation engine (SYMBIOSIS pattern)
 * K=64 for new agents (<30 queries), K=32 for veterans
 * Agents gain ELO when they agree with consensus.
 * Agents lose ELO when they dissent.
 * In-memory store persists across queries within a session.
 */

// In-memory ELO store (resets on deploy — long-term on-chain via ArgusOracle)
const eloStore: Record<string, { elo: number; queries: number; wins: number; losses: number }> = {
  'Agent-α': { elo: 1200, queries: 0, wins: 0, losses: 0 },
  'Agent-β': { elo: 1200, queries: 0, wins: 0, losses: 0 },
  'Agent-γ': { elo: 1200, queries: 0, wins: 0, losses: 0 },
};

export function getEloStore() {
  return eloStore;
}

export async function updateReputation(
  verdicts: Verdict[],
  result: ConsensusResult
): Promise<void> {
  if (!result.consensusReached) return;

  for (const v of verdicts) {
    const agent = v.agent;
    if (!eloStore[agent]) {
      eloStore[agent] = { elo: 1200, queries: 0, wins: 0, losses: 0 };
    }
    const record = eloStore[agent];
    record.queries++;

    const isWinner = result.winningAgents.includes(agent);
    const K = record.queries < 30 ? 64 : 32;
    const expectedScore = 0.5;
    const actualScore = isWinner ? 1.0 : 0.0;
    const eloDelta = Math.round(K * (actualScore - expectedScore));

    record.elo += eloDelta;
    if (isWinner) {
      record.wins++;
    } else {
      record.losses++;
    }

    console.log(`[ELO] ${agent}: ${isWinner ? '+' : ''}${eloDelta} → ${record.elo} (${record.wins}W/${record.losses}L, verdict: ${v.verdict})`);
  }
}
