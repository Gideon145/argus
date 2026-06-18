import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { createGatewayMiddleware } from '@circle-fin/x402-batching/server';
import { Orchestrator, QueryRequest } from './orchestrator';
import { createLogger, Logger } from './logger';

const STATUS_PORT = parseInt(process.env.PORT || process.env.STATUS_PORT || '3001');
const LOOP_INTERVAL_MS = parseInt(process.env.LOOP_INTERVAL_MS || '15000');
const SELLER_ADDRESS = process.env.TREASURY_ADDRESS || '0x933a2405f84c224be1ef373ba16e992e1f459682';

const logger: Logger = createLogger('Argus');

async function main() {
  logger.info('Argus agent starting...');

  // --- Config ---
  const config = {
    arcRpc: process.env.ARC_RPC_URL || 'https://rpc.testnet.arc-node.thecanteenapp.com',
    treasuryAddress: SELLER_ADDRESS,
    loopIntervalMs: LOOP_INTERVAL_MS,
  };

  // --- Orchestrator ---
  const orchestrator = new Orchestrator(config, logger);

  // --- Gateway middleware (x402 paywall) ---
  const gateway = createGatewayMiddleware({
    sellerAddress: SELLER_ADDRESS as `0x${string}`,
    facilitatorUrl: 'https://gateway-api-testnet.circle.com',
    networks: ['eip155:5042002'], // Arc testnet chain ID
  });

  // --- Server ---
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Public endpoints
  app.get('/status', (_req, res) => {
    res.json(lastState);
  });

  app.get('/stats', (_req, res) => {
    const q = (orchestrator as any).queryCount || 0;
    const cw = (orchestrator as any).consensusWins || 0;
    res.json({
      queries: q,
      consensusReached: cw,
      onChainRecords: cw, // each consensus = one on-chain record
      avgConfidence: q > 0 ? Math.round((cw / q) * 100) : 0,
      status: 'live',
    });
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), agent: 'Argus' });
  });

  // Debug endpoint — bypasses Gateway for testing
  app.post('/debug/scan', async (req, res) => {
    try {
      const { contractAddress, chain } = req.body || {};
      if (!contractAddress) {
        return res.status(400).json({ error: 'contractAddress required' });
      }

      logger.info(`Debug scan: ${contractAddress} (no payment)`);

      const queryReq: QueryRequest = {
        contractAddress,
        chain: chain || 'arc',
        user: '0xDebugTester00000000000000000000000000000000',
      };

      const result = await orchestrator.processQuery(queryReq);

      res.json({
        query: { contractAddress, chain: chain || 'arc' },
        result: {
          verdict: result.finalVerdict,
          confidence: result.agreementCount === 3 ? 'high' : result.agreementCount === 2 ? 'medium' : 'none',
          consensus: result.details,
          agreementCount: result.agreementCount,
          totalAgents: result.totalAgents,
          winningAgents: result.winningAgents,
          losingAgents: result.losingAgents,
          settlementBatchId: result.settlementBatchId,
          agents: result.agentVerdicts.map(v => ({
            name: v.agent,
            verdict: v.verdict,
            confidence: v.confidence,
            reasoning: v.reasoning,
          })),
        },
        payment: { note: 'debug — no payment collected' },
      });
    } catch (err: any) {
      logger.error('Debug scan error:', err.message);
      res.status(500).json({ error: 'Scan failed', detail: err.message });
    }
  });

  // Paywalled scan endpoint — $0.01 USDC per query
  app.post('/scan', gateway.require('$0.01'), async (req: any, res) => {
    try {
      const { contractAddress, chain } = req.body || {};
      if (!contractAddress) {
        return res.status(400).json({ error: 'contractAddress required' });
      }

      const payment = req.payment;
      logger.info(`Paid scan: ${contractAddress} by ${payment?.payer} (${payment?.amount} USDC)`);

      const queryReq: QueryRequest = {
        contractAddress,
        chain: chain || 'arc',
        user: payment?.payer || '0xunknown',
      };

      const result = await orchestrator.processQuery(queryReq);

      res.json({
        query: { contractAddress, chain: chain || 'arc' },
        result: {
          verdict: result.finalVerdict,
          confidence: result.agreementCount === 3 ? 'high' : result.agreementCount === 2 ? 'medium' : 'none',
          consensus: result.details,
          settlementBatchId: result.settlementBatchId,
          agents: result.agentVerdicts.map(v => ({
            name: v.agent,
            verdict: v.verdict,
            confidence: v.confidence,
            reasoning: v.reasoning,
          })),
        },
        payment: {
          paid: payment?.amount || '0',
          payer: payment?.payer,
          settlementId: payment?.transaction,
        },
      });
    } catch (err: any) {
      logger.error('Scan error:', err.message);
      res.status(500).json({ error: 'Scan failed', detail: err.message });
    }
  });

  let lastState: any = { status: 'starting', queries: 0, consensusRate: 0, treasury: '0' };

  // Update state from orchestrator
  setInterval(async () => {
    lastState = {
      status: 'active',
      queries: (orchestrator as any).queryCount || 0,
      consensusRate: '0',
      treasury: '0.00',
      model: 'DeepSeek-V3 + Claude Sonnet 4 + Rule Engine',
    };
  }, 2000);

  app.listen(STATUS_PORT, () => {
    logger.info(`Argus live on :${STATUS_PORT}`);
    logger.info(`  /scan — $0.01 USDC (Gateway x402)`);
    logger.info(`  /status — public status endpoint`);
    logger.info(`  /health — health check`);
  });

  // --- Main loop ---
  logger.info(`Main loop starting (${config.loopIntervalMs}ms interval)`);

  setInterval(async () => {
    try {
      await orchestrator.tick();
    } catch (err) {
      logger.error('Tick error:', err);
    }
  }, config.loopIntervalMs);

  logger.info('Argus agent ready. Τρεις οφθαλμοί. Μια κρίσις.');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
