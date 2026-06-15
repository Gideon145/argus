import { Verdict, ConsensusResult, AgentConfig } from './orchestrator';
import {
  createAgentStake,
  createSettlementBatch,
  submitSettlementBatch,
  demoSettlementTxHash,
  createArgusWallets,
  createVerdictReceipt,
} from './payments';

/**
 * Settle agent stakes using arc-agent-pay settlement batches.
 * - Each agent signs a stake payment intent
 * - Winning agents: return stake + split loser pool
 * - Losing agents: stake goes to treasury
 * - All batched into one settlement
 */
export async function settleStakes(
  verdicts: Verdict[],
  result: ConsensusResult,
  config: AgentConfig
): Promise<{ batchId: string; status: string }> {
  if (!result.consensusReached) {
    return { batchId: '', status: 'no_consensus' };
  }

  const queryId = `query-${Date.now()}`;
  const { treasury } = createArgusWallets();
  const nonceStore = new Set<string>();

  // Each agent creates a signed stake + verdict receipt
  const stakeIntents = [];
  for (const v of verdicts) {
    const stake = createAgentStake({
      agentId: v.agent,
      verdict: v.verdict,
      queryId,
    });

    const receipt = await createVerdictReceipt({
      agentId: v.agent,
      verdict: v.verdict,
      confidence: v.confidence,
      reasoning: v.reasoning,
      queryId,
    });

    stakeIntents.push({ stake, receipt });
  }

  // Record fulfilled requests for winning agents
  const fulfilled = result.winningAgents.map((agentId, i) => ({
    intent: stakeIntents.find(s => s.stake.metadata!.agentId === agentId)!.stake,
    requestId: `${queryId}-${agentId}`,
    fulfilledAt: new Date().toISOString(),
    usageUnits: 1,
  }));

  // Create settlement batch
  const batch = createSettlementBatch(treasury, fulfilled.map(f => ({
    intent: f.intent,
    requestId: f.requestId,
    fulfilledAt: f.fulfilledAt,
    usageUnits: f.usageUnits,
  })));

  const submitted = submitSettlementBatch(batch, demoSettlementTxHash(batch));

  console.log(`[Treasury] Query ${queryId} settled — batch ${submitted.id}, status: ${submitted.status}`);

  return { batchId: submitted.id, status: submitted.status };
}
