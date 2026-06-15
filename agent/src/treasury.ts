import { ethers } from 'ethers';
import { Verdict, ConsensusResult, AgentConfig } from './orchestrator';

/**
 * Settle agent stakes on-chain (Arbitrum)
 * - Winning agents: get back stake + share of loser stakes
 * - Losing agents: stake goes to treasury
 * - Treasury: collects loser stakes + query fee
 */
export async function settleStakes(
  verdicts: Verdict[],
  result: ConsensusResult,
  config: AgentConfig
): Promise<void> {
  if (!result.consensusReached) return;

  // TODO: Connect to Arbitrum RPC + Treasury contract
  // const provider = new ethers.JsonRpcProvider(config.arbitrumRpc);
  // const treasury = new ethers.Contract(config.treasuryAddress, TREASURY_ABI, provider);
  //
  // For each losing agent: transfer stake to treasury
  // For each winning agent: return stake + split loser pool
  //
  // await treasury.settleQuery(queryId, winningAgents, losingAgents, stakes);
}
