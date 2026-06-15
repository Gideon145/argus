import { alphaAgent } from './agents/alpha';
import { betaAgent } from './agents/beta';
import { gammaAgent } from './agents/gamma';
import { runConsensus, ConsensusResult } from './consensus';
import { settleStakes } from './treasury';
import { updateReputation } from './reputation';
import { processPayment } from './gateway';
import { Logger } from './logger';

export interface AgentConfig {
  arcRpc: string;
  treasuryAddress: string;
  loopIntervalMs: number;
}

export interface QueryRequest {
  contractAddress: string;
  chain: string;
  user: `0x${string}`;
}

export interface Verdict {
  agent: string;
  verdict: 'SAFE' | 'RISKY' | 'SCAM';
  confidence: number;
  reasoning: string;
  stake: string; // USDC in microusd
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
    const queryId = `query-${Date.now()}-${this.queryCount}`;

    // Step 1: Process payment ($0.01 USDC)
    const payment = await processPayment(req.user, queryId);
    this.logger.info(`Payment intent created: ${queryId}`);

    // Step 2: Fan out to 3 agents in parallel
    const [verdictA, verdictB, verdictC] = await Promise.all([
      alphaAgent.analyze(req),
      betaAgent.analyze(req),
      gammaAgent.analyze(req),
    ]);

    const verdicts: Verdict[] = [verdictA, verdictB, verdictC];

    // Step 3: Run consensus
    const result = runConsensus(verdicts);

    // Step 4: Settle stakes using arc-agent-pay
    if (result.consensusReached) {
      const settlement = await settleStakes(verdicts, result, this.config);
      result.settlementBatchId = settlement.batchId;
      this.consensusWins++;
    }

    // Step 5: Update ELO reputation
    await updateReputation(verdicts, result);

    this.queryCount++;
    this.logger.info(
      `Query ${queryId} complete — ${result.finalVerdict} (${result.agreementCount}/${result.totalAgents})`
    );

    return result;
  }
}
