import { alphaAgent } from './agents/alpha';
import { betaAgent } from './agents/beta';
import { gammaAgent } from './agents/gamma';
import { runConsensus, ConsensusResult } from './consensus';
import { settleStakes } from './treasury';
import { updateReputation } from './reputation';
import { Logger } from './logger';

export interface AgentConfig {
  arcRpc: string;
  arbitrumRpc: string;
  oracleAddress: string;
  treasuryAddress: string;
  loopIntervalMs: number;
}

export interface QueryRequest {
  contractAddress: string;
  chain: string;
  user: string;
}

export interface Verdict {
  agent: string;
  verdict: 'SAFE' | 'RISKY' | 'SCAM';
  confidence: number;
  reasoning: string;
  stake: string; // USDC in wei
}

export class Orchestrator {
  private config: AgentConfig;
  private logger: Logger;
  private queryCount = 0;
  private consensusWins = 0;

  constructor(config: AgentConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  async tick() {
    // In full implementation: pull pending queries from oracle contract
    // For now: skeleton — returns current state
    return {
      status: 'monitoring',
      queries: this.queryCount,
      consensusRate: this.queryCount > 0 
        ? ((this.consensusWins / this.queryCount) * 100).toFixed(1) 
        : '0',
      treasury: '0.00',
    };
  }

  async processQuery(req: QueryRequest): Promise<ConsensusResult> {
    this.logger.info(`Processing query for ${req.contractAddress} from ${req.user}`);

    // Fan out to 3 agents in parallel
    const [verdictA, verdictB, verdictC] = await Promise.all([
      alphaAgent.analyze(req),
      betaAgent.analyze(req),
      gammaAgent.analyze(req),
    ]);

    const verdicts: Verdict[] = [verdictA, verdictB, verdictC];

    // Run consensus
    const result = runConsensus(verdicts);

    // Settle stakes on-chain
    if (result.consensusReached) {
      await settleStakes(verdicts, result, this.config);
      this.consensusWins++;
    }

    // Update ELO reputation
    await updateReputation(verdicts, result);

    this.queryCount++;

    return result;
  }
}
