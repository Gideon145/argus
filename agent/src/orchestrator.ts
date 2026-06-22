import { alphaAgent } from './agents/alpha';
import { betaAgent } from './agents/beta';
import { gammaAgent } from './agents/gamma';
import { runConsensus, ConsensusResult } from './consensus';
import { settleStakes } from './treasury';
import { updateReputation } from './reputation';
import { settleAgentPayments } from './payments/agentPayments';
import { processPayment } from './gateway';
import { store } from './store';

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
  private scanCache = new Map<string, ConsensusResult>(); // free cache — avoids repeat API costs

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

  async processQuery(req: QueryRequest, consensusThreshold: number = 2): Promise<ConsensusResult> {
    this.logger.info(`Processing query for ${req.contractAddress} from ${req.user}`);
    const queryId = `query-${Date.now()}-${this.queryCount}`;

    // Cache check — same address, instant return, zero API cost
    const cacheKey = `${req.contractAddress.toLowerCase()}:${consensusThreshold}`;
    if (this.scanCache.has(cacheKey)) {
      this.logger.info(`Cache hit for ${cacheKey} — returning cached result`);
      return this.scanCache.get(cacheKey)!;
    }

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
    const result = runConsensus(verdicts, consensusThreshold);

    // Step 4: Settle stakes using arc-agent-pay
    if (result.consensusReached) {
      const settlement = await settleStakes(verdicts, result, this.config);
      result.settlementBatchId = settlement.batchId;
      this.consensusWins++;
    }

    // Step 5: Update ELO reputation
    await updateReputation(verdicts, result);

    // Step 6: Agent-to-agent nanopayments — winners rewarded, losers pay micro-stake
    if (result.consensusReached) {
      settleAgentPayments(result.winningAgents, result.losingAgents, queryId)
        .then(records => {
          if (records.length > 0) {
            this.logger.info(`[AgentPay] ${records.length} payments settled`);
          }
        })
        .catch(() => {}); // Fire-and-forget — don't block scan response
    }

    this.queryCount++;
    this.logger.info(
      `Query ${queryId} complete — ${result.finalVerdict} (${result.agreementCount}/${result.totalAgents})`
    );

    // Cache result to avoid repeat API costs
    this.scanCache.set(cacheKey, result);

    // Persist to file store (survives deploys, visible to all users)
    store.recordScan({
      address: req.contractAddress,
      verdict: result.finalVerdict,
      consensus: `${result.agreementCount}/${result.totalAgents}`,
      confidence: Math.round(result.agentVerdicts.reduce((sum, v) => sum + v.confidence, 0) / result.agentVerdicts.length),
      time: new Date().toISOString().replace('T', ' ').slice(0, 19),
    }, result.consensusReached);

    return result;
  }
}
