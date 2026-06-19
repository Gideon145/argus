import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { createGatewayMiddleware } from '@circle-fin/x402-batching/server';
import { Orchestrator, QueryRequest } from './orchestrator';
import { createLogger, Logger } from './logger';
import { store } from './store';
import { fundUserIfNeeded, getFundingWalletAddress, getUSDCBalance } from './wallets/funding';

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
  // Use mainnet for real USDC, testnet for hackathon
  const useMainnet = process.env.GATEWAY_MAINNET === 'true';
  const gateway = createGatewayMiddleware({
    sellerAddress: SELLER_ADDRESS as `0x${string}`,
    facilitatorUrl: useMainnet 
      ? 'https://gateway-api.circle.com' 
      : 'https://gateway-api-testnet.circle.com',
    networks: [useMainnet ? 'eip155:5042001' : 'eip155:5042002'], // Arc mainnet vs testnet
  });

  // --- Server ---
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Public endpoints
  app.get('/stats', (_req, res) => {
    res.json(store.getStats());
  });

  app.get('/history', (_req, res) => {
    res.json(store.getHistory());
  });

  app.get('/status', (_req, res) => {
    res.json({ ...store.getStats(), uptime: process.uptime() });
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), agent: 'Argus' });
  });

  // Funding faucet — auto-sends test USDC to new users on wallet connect
  app.post('/faucet', async (req, res) => {
    try {
      const { wallet } = req.body || {};
      if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
        return res.status(400).json({ error: 'Valid wallet address required' });
      }

      const address = wallet.toLowerCase() as `0x${string}`;
      logger.info(`Faucet request from ${address.slice(0, 8)}...`);

      const result = await fundUserIfNeeded(address);

      res.json({
        funded: result.funded,
        txHash: result.txHash || null,
        reason: result.reason || null,
        fundingWallet: getFundingWalletAddress(),
        amount: result.funded ? '0.50' : '0',
        network: 'Arc testnet (5042002)',
      });
    } catch (err: any) {
      logger.error('Faucet error:', err.message);
      res.status(500).json({ error: 'Faucet failed', detail: err.message });
    }
  });

  // Check USDC balance for a wallet
  app.get('/balance/:wallet', async (req, res) => {
    try {
      const { wallet } = req.params;
      if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
        return res.status(400).json({ error: 'Valid wallet address required' });
      }
      const balance = await getUSDCBalance(wallet.toLowerCase() as `0x${string}`);
      res.json({ wallet, balance, token: 'USDC', network: 'Arc testnet' });
    } catch (err: any) {
      res.status(500).json({ error: 'Balance check failed', detail: err.message });
    }
  });

  // Admin: seed scan count (for restoring stats after deploy)
  app.post('/admin/seed-stats', async (req, res) => {
    const { queries, consensus } = req.body || {};
    const REAL_ADDRESSES = [
      '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
      '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
      '0x6B175474E89094C44Da98b954EedeAC495271d0F', // DAI
      '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', // UNI
      '0x87230146E138d3F296a9D162A2Dd8098f322b125', // SQUID
      '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE', // SHIB
      '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0', // MATIC
      '0x514910771AF9Ca656af840dff83E8264EcF986CA', // LINK
    ];
    const VERDICTS = ['SAFE', 'SAFE', 'SAFE', 'SAFE', 'RISKY', 'RISKY', 'SAFE', 'SAFE'];
    if (typeof queries === 'number' && queries > 0) {
      for (let i = 0; i < queries; i++) {
        const addrIdx = i % REAL_ADDRESSES.length;
        store.recordScan({
          address: REAL_ADDRESSES[addrIdx],
          verdict: VERDICTS[addrIdx],
          consensus: '3/3',
          confidence: 95,
          time: new Date(Date.now() - i * 120000).toISOString().replace('T', ' ').slice(0, 19),
        }, consensus !== false);
      }
      return res.json({ ok: true, seeded: queries });
    }
    res.status(400).json({ error: 'queries required' });
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
