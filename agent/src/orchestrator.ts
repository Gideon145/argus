import { alphaAgent } from './agents/alpha';
import { betaAgent } from './agents/beta';
import { gammaAgent } from './agents/gamma';
import { runConsensus, ConsensusResult } from './consensus';
import { settleStakes } from './treasury';
import { updateReputation } from './reputation';
import { settleAgentPayments } from './payments/agentPayments';
import { processPayment } from './gateway';
import { store } from './store';
import { Logger } from './logger';
import { fetchContractData } from './dataProvider';

export { ConsensusResult } from './consensus';

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
  verdict: 'SAFE' | 'RISKY' | 'SCAM' | 'INSUFFICIENT_DATA';
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

    // Step 1.5: Fetch cross-chain contract data for agent context
    const contractData = await fetchContractData(req.contractAddress);
    this.logger.info(`Contract data: chain=${contractData.chain} isContract=${contractData.isContract} hasSource=${contractData.hasSource}`);

    // Step 2: Fan out to 3 agents in parallel with contract data
    const [verdictA, verdictB, verdictC] = await Promise.all([
      alphaAgent.analyze(req, contractData),
      betaAgent.analyze(req, contractData),
      gammaAgent.analyze(req, contractData),
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

    // Step 6: Agent-to-agent nanopayments — confidence-weighted stakes (v0.12)
    if (result.consensusReached) {
      const confidences: Record<string, number> = {};
      for (const v of verdicts) {
        confidences[v.agent] = v.confidence;
      }
      settleAgentPayments(result.winningAgents, result.losingAgents, queryId, confidences)
        .then(records => {
          if (records.length > 0) {
            this.logger.info(`[AgentPay] ${records.length} confidence-weighted payments settled`);
          }
        })
        .catch(() => {});
    }

    this.queryCount++;
    this.logger.info(
      `Query ${queryId} complete — ${result.finalVerdict} (${result.agreementCount}/${result.totalAgents})`
    );

    // Cache result to avoid repeat API costs
    this.scanCache.set(cacheKey, result);

    // Persist to file store
    const avgConf = Math.round(result.agentVerdicts.reduce((sum, v) => sum + v.confidence, 0) / result.agentVerdicts.length);
    store.recordScan({
      address: req.contractAddress,
      verdict: result.finalVerdict,
      consensus: `${result.agreementCount}/${result.totalAgents}`,
      confidence: avgConf,
      time: new Date().toISOString().replace('T', ' ').slice(0, 19),
    }, result.consensusReached);

    return result;
  }
}
