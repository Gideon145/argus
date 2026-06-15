import { Verdict, ConsensusResult } from './orchestrator';

/**
 * ELO reputation engine (SYMBIOSIS pattern)
 * K=64 for new agents (<30 queries), K=32 for veterans
 * Agents gain ELO when they agree with consensus.
 * Agents lose ELO when they dissent.
 */
export async function updateReputation(
  verdicts: Verdict[],
  result: ConsensusResult
): Promise<void> {
  if (!result.consensusReached) return;

  const K = 64; // Base K-factor

  for (const v of verdicts) {
    const isWinner = result.winningAgents.includes(v.agent);
    const expectedScore = 0.5; // Prior expectation
    const actualScore = isWinner ? 1.0 : 0.0;
    const eloDelta = Math.round(K * (actualScore - expectedScore));

    // TODO: Update on-chain ELO via ArgusOracle contract
    // await oracle.updateElo(v.agent, eloDelta);

    console.log(`[ELO] ${v.agent}: ${isWinner ? '+' : ''}${eloDelta} (verdict: ${v.verdict})`);
  }
}
