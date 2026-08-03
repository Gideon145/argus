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
import { ContractData } from './dataProvider';
import { createWalletClient, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

export { ConsensusResult } from './consensus';

/** Send $0.01 USDC to treasury on-chain for every scan */
async function sendScanPaymentToTreasury(
  _user: string,
  queryId: string,
  logger: Logger
): Promise<string | null> {
  const fundingKey = process.env.FUNDING_WALLET_PRIVATE_KEY;
  if (!fundingKey || fundingKey === '0x') {
    // No funding key — return demo settlement ID
    return null;
  }
  try {
    const account = privateKeyToAccount(fundingKey as `0x${string}`);
    const treasuryAddr = (process.env.TREASURY_ADDRESS || '0x0699a029e2e05EC88d6418EC744232702Cf77d81') as `0x${string}`;
    const rpcUrl = process.env.ARC_RPC_URL || 'https://rpc.testnet.arc.network';
    
    const walletClient = createWalletClient({
      account,
      chain: {
        id: 5042002,
        name: 'Arc Testnet',
        nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
        rpcUrls: { default: { http: [rpcUrl] } },
      },
      transport: http(rpcUrl),
    });

    const txHash = await walletClient.sendTransaction({
      to: treasuryAddr,
      value: parseEther('0.01'), // 0.01 USDC native transfer on Arc
    });
    
    logger.info(`[Treasury] $0.01 USDC → treasury (${txHash.slice(0,12)}...) for ${queryId}`);
    return txHash;
  } catch (e: any) {
    logger.warn(`[Treasury] Payment failed: ${e.message?.slice(0,80)}`);
    return null;
  }
}

export interface AgentConfig {
  arcRpc: string;
  treasuryAddress: string;
  loopIntervalMs: number;
}

export interface QueryRequest {
  contractAddress: string;
  chain: string;
  user: `0x${string}`;
  isPatrol?: boolean; // when true, skip recordScan (patrol handles its own recording)
}

export interface Verdict {
  agent: string;
  verdict: 'SAFE' | 'RISKY' | 'SCAM' | 'INSUFFICIENT_DATA';
  confidence: number;
  reasoning: string;
  riskScore?: number;
  riskBreakdown?: string;
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

  async processQuery(req: QueryRequest, consensusThreshold: number = 2, contractData?: ContractData): Promise<ConsensusResult> {
    this.logger.info(`Processing query for ${req.contractAddress} from ${req.user}`);
    const queryId = `query-${Date.now()}-${this.queryCount}`;

    // Cache check — same address, instant return, zero API cost
    // BUT still record a history entry so every scan is tracked (user scans only)
    const cacheKey = `${req.contractAddress.toLowerCase()}:${consensusThreshold}`;
    if (this.scanCache.has(cacheKey)) {
      this.logger.info(`Cache hit for ${cacheKey} — returning cached result`);
      const cached = this.scanCache.get(cacheKey)!;
      if (!req.isPatrol) {
        store.recordScan({
          address: req.contractAddress,
          verdict: cached.finalVerdict,
          consensus: `${cached.agreementCount}/${cached.totalAgents}`,
          confidence: Math.round(cached.agentVerdicts.reduce((s, v) => s + v.confidence, 0) / cached.agentVerdicts.length),
          time: new Date().toISOString().replace('T', ' ').slice(0, 19),
        }, cached.consensusReached);
        store.recordRevenue('0.01', queryId);
        // Send real $0.01 to treasury even on cache hit — every scan settles on-chain
        const paymentTx = await sendScanPaymentToTreasury(req.user, queryId, this.logger);
        if (paymentTx) cached.settlementBatchId = paymentTx;
      }
      this.queryCount++;
      return cached;
    }

    // Step 1: Process payment ($0.01 USDC)
    const payment = await processPayment(req.user, queryId);
    this.logger.info(`Payment intent created: ${queryId}`);

    // Step 2: Fan out to 3 agents in parallel
    const [verdictA, verdictB, verdictC] = await Promise.all([
      alphaAgent.analyze(req, contractData),
      betaAgent.analyze(req, contractData),
      gammaAgent.analyze(req, contractData),
    ]);

    const verdicts: Verdict[] = [verdictA, verdictB, verdictC];

    // Step 2.5: Deterministic false-positive suppression
    // If contract is Etherscan-verified + no concrete malicious mechanism → downgrade RISKY→SAFE
    if (contractData?.hasSource && contractData.contractName) {
      const maliciousKeywords = ['mint', 'blacklist', 'sell', 'hidden', 'proxy', 'backdoor', 'drain', 'honeypot', 'selfdestruct', 'suicide'];
      for (const v of verdicts) {
        if (v.verdict === 'RISKY') {
          const hasMaliciousMechanism = maliciousKeywords.some(kw => v.reasoning.toLowerCase().includes(kw));
          if (!hasMaliciousMechanism) {
            v.verdict = 'SAFE';
            v.confidence = Math.min(v.confidence, 70);
            v.reasoning = `[Suppressed RISKY→SAFE] Verified contract (${contractData.contractName}), no concrete malicious mechanism found. ${v.reasoning}`;
          }
        }
      }
    }

    // Step 3: Run consensus
    const result = runConsensus(verdicts, consensusThreshold);

    // Step 4: Settle stakes using arc-agent-pay
    if (result.consensusReached) {
      const settlement = await settleStakes(verdicts, result, this.config);
      result.settlementBatchId = settlement.batchId;
      this.consensusWins++;
    }

    // Step 4.5: Send $0.01 USDC to treasury (real on-chain transfer, every scan)
    const userPaymentTx = await sendScanPaymentToTreasury(req.user, queryId, this.logger);
    if (userPaymentTx) {
      result.settlementBatchId = userPaymentTx; // Replace batch ID with real TX hash
    }

    // Step 5: Update ELO reputation (returns real on-chain TX hashes)
    const eloTxHashes = await updateReputation(verdicts, result);
    result.eloTxHashes = eloTxHashes;

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

    // Persist to file store (skip for patrol — patrol.ts handles its own recording)
    const avgConf = Math.round(result.agentVerdicts.reduce((sum, v) => sum + v.confidence, 0) / result.agentVerdicts.length);
    if (!req.isPatrol) {
      store.recordScan({
        address: req.contractAddress,
        verdict: result.finalVerdict,
        consensus: `${result.agreementCount}/${result.totalAgents}`,
        confidence: avgConf,
        time: new Date().toISOString().replace('T', ' ').slice(0, 19),
      }, result.consensusReached);
      // Track scan revenue: $0.01 per scan (user scans only, not patrol)
      store.recordRevenue('0.01', queryId);
    }

    return result;
  }
}
