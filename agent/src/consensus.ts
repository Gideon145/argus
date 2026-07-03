import { Verdict } from './orchestrator';

export interface ConsensusResult {
  consensusReached: boolean;
  finalVerdict: 'SAFE' | 'RISKY' | 'SCAM' | 'NO_CONSENSUS' | 'INSUFFICIENT_DATA';
  agreementCount: number;
  totalAgents: number;
  abstentionCount: number;
  winningAgents: string[];
  losingAgents: string[];
  details: string;
  agentVerdicts: Verdict[];
  receipts?: any[];
  settlementBatchId?: string;
}

export function runConsensus(verdicts: Verdict[], threshold: number = 2): ConsensusResult {
  // Count abstentions
  const abstaining = verdicts.filter(v => v.verdict === 'INSUFFICIENT_DATA');
  const voting = verdicts.filter(v => v.verdict !== 'INSUFFICIENT_DATA');
  const abstentionCount = abstaining.length;

  // If 2+ agents abstain, return INSUFFICIENT_DATA
  if (abstentionCount >= 2) {
    return {
      consensusReached: false,
      finalVerdict: 'INSUFFICIENT_DATA',
      agreementCount: 0,
      totalAgents: verdicts.length,
      abstentionCount,
      winningAgents: [],
      losingAgents: [],
      details: `${abstentionCount}/${verdicts.length} agents could not fetch contract data`,
      agentVerdicts: verdicts,
    };
  }

  // Run consensus among voting agents only
  const counts: Record<string, Verdict[]> = {};
  for (const v of voting) {
    if (!counts[v.verdict]) counts[v.verdict] = [];
    counts[v.verdict].push(v);
  }

  let maxVerdict: 'SAFE' | 'RISKY' | 'SCAM' | 'NO_CONSENSUS' = 'NO_CONSENSUS';
  let maxCount = 0;
  const options = ['SCAM', 'RISKY', 'SAFE'] as const;

  for (const option of options) {
    if (counts[option] && counts[option].length > maxCount) {
      maxCount = counts[option].length;
      maxVerdict = option;
    }
  }

  // Threshold applies to voting agents; if only 1 abstained, need 2/2 instead of 2/3
  const effectiveThreshold = Math.min(threshold, voting.length);
  const consensusReached = maxCount >= effectiveThreshold;

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
    abstentionCount,
    winningAgents,
    losingAgents,
    agentVerdicts: verdicts,
    details: consensusReached
      ? `${maxCount}/${verdicts.length} agents agreed: ${maxVerdict}` + (abstentionCount > 0 ? ` (${abstentionCount} abstained)` : '')
      : `No consensus reached (threshold: ${threshold}/${verdicts.length}, best: ${maxCount}/3)` + (abstentionCount > 0 ? `, ${abstentionCount} abstained` : ''),
  };
}
