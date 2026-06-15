import { Verdict } from './orchestrator';

export interface ConsensusResult {
  consensusReached: boolean;
  finalVerdict: 'SAFE' | 'RISKY' | 'SCAM' | 'NO_CONSENSUS';
  agreementCount: number;
  totalAgents: number;
  winningAgents: string[];
  losingAgents: string[];
  details: string;
  /** Signed reasoning receipts for each agent's verdict */
  receipts?: any[];
  /** Settlement batch ID if stakes were settled */
  settlementBatchId?: string;
}

/**
 * 2/3 consensus: two agents must agree for a verdict to pass.
 * Unanimous = max confidence. Split = no consensus, query rejected.
 */
export function runConsensus(verdicts: Verdict[]): ConsensusResult {
  const counts: Record<string, Verdict[]> = {};

  for (const v of verdicts) {
    if (!counts[v.verdict]) counts[v.verdict] = [];
    counts[v.verdict].push(v);
  }

  // Find the verdict with most agreement
  let maxVerdict = 'NO_CONSENSUS';
  let maxCount = 0;
  const options = ['SCAM', 'RISKY', 'SAFE'] as const;

  for (const option of options) {
    if (counts[option] && counts[option].length > maxCount) {
      maxCount = counts[option].length;
      maxVerdict = option;
    }
  }

  const consensusReached = maxCount >= 2; // 2/3 threshold

  const winningAgents = consensusReached
    ? counts[maxVerdict].map(v => v.agent)
    : [];

  const losingAgents = consensusReached
    ? verdicts.filter(v => v.verdict !== maxVerdict).map(v => v.agent)
    : verdicts.map(v => v.agent);

  return {
    consensusReached,
    finalVerdict: consensusReached ? maxVerdict : 'NO_CONSENSUS',
    agreementCount: maxCount,
    totalAgents: verdicts.length,
    winningAgents,
    losingAgents,
    details: consensusReached
      ? `${maxCount}/${verdicts.length} agents agreed: ${maxVerdict}`
      : `No consensus reached (best: ${maxCount}/${verdicts.length})`,
  };
}
