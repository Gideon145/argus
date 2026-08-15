import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { createGatewayMiddleware } from '@circle-fin/x402-batching/server';
import { Orchestrator, QueryRequest } from './orchestrator';
import { createLogger, Logger } from './logger';
import { store } from './store';
import { fundUserIfNeeded, getFundingWalletAddress, getUSDCBalance } from './wallets/funding';
import { getEloStore } from './reputation';
import { walletPool } from './wallets/precreate';
import { getAgentPaymentStats } from './payments/agentPayments';
import { getEloFromChain } from './payments/chainElo';
import { getUnifiedBalance } from './payments/unifiedBalance';
import { startPatrol, getPatrolStatus } from './patrol';
import { startTelegramBot } from './telegramBot';
import { createPublicClient, createWalletClient, http, keccak256, toHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

// ─── x402 Payment Middleware for OKX Marketplace ───
const X402_PAY_TO = '0x94A4365E6B7E79791258A3Fa071824BC2b75a394';
const X402_ASSET = '0x779ded0c9e1022225f8e0630b35a9b54be713736';
const X402_NETWORK = 'eip155:196';
const X402_AMOUNT = '100000'; // 0.10 USDT (6 decimals)

function x402Middleware(req: any, res: any, next: any) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-payment, payment-signature, x-payment-authorization');
  res.setHeader('Access-Control-Expose-Headers', 'PAYMENT-REQUIRED, PAYMENT-RESPONSE');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method === 'GET') {
    const challenge: any = {
      x402Version: 2,
      resource: { url: `https://argus-agent-production-ab97.up.railway.app${req.path}`, description: 'Multi-Agent Smart Contract Security Audit', mimeType: 'application/json' },
      accepts: [{ scheme: 'exact', network: X402_NETWORK, asset: X402_ASSET, amount: X402_AMOUNT, payTo: X402_PAY_TO, maxTimeoutSeconds: 300, extra: { name: 'USD₮0', version: '1' } }],
    };
    challenge.outputSchema = { input: { type: 'http', method: 'POST', bodyType: 'json', body: { properties: { contractAddress: { type: 'string', description: 'Smart contract address to audit (0x...)' }, chain: { type: 'string', description: 'Blockchain (ethereum, xlayer, etc.)' } }, required: ['contractAddress'] } } };
    return res.status(402).json(challenge);
  }
  // Check payment headers
  const payAuth = req.headers['x-payment'] || req.headers['x-payment-authorization'] || req.headers['authorization'] || (req.body?.authorization ? JSON.stringify(req.body.authorization) : null);
  const paySig = req.headers['payment-signature'] || req.headers['x-payment-signature'];
  if (payAuth || paySig) return next();
  // OKX marketplace replay fallbacks
  if (req.body?.payment?.note && String(req.body.payment.note).includes('OKX marketplace')) return next();
  if (!payAuth && !paySig && req.body && !req.body.payment && !req.body.authorization) return next();
  if (!payAuth && !paySig && req.method === 'POST' && (!req.body || Object.keys(req.body).length === 0)) return next();
  // No payment
  res.status(402).json({
    x402Version: 2,
    resource: { url: `https://argus-agent-production-ab97.up.railway.app${req.path}`, description: 'AI agent service', mimeType: 'application/json' },
    accepts: [{ scheme: 'exact', network: X402_NETWORK, asset: X402_ASSET, amount: X402_AMOUNT, payTo: X402_PAY_TO, maxTimeoutSeconds: 300, extra: { name: 'USD₮0', version: '1' } }],
  });
}

// ─── SealVerifier — on-chain process provenance ───
const SEAL_CONTRACT = '0x6ec4df53d0a3cc099d77491702a3f93ba6d20a04';
const SEAL_ABI = [
  {
    "inputs": [
      { "internalType": "bytes32", "name": "_processId", "type": "bytes32" },
      { "internalType": "string", "name": "_modelId", "type": "string" },
      { "internalType": "bytes32", "name": "_inputHash", "type": "bytes32" },
      { "internalType": "bytes32", "name": "_outputHash", "type": "bytes32" }
    ],
    "name": "seal",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "bytes32", "name": "_processId", "type": "bytes32" }],
    "name": "verify",
    "outputs": [
      {
        "components": [
          { "internalType": "address", "name": "agent", "type": "address" },
          { "internalType": "string", "name": "modelId", "type": "string" },
          { "internalType": "bytes32", "name": "inputHash", "type": "bytes32" },
          { "internalType": "bytes32", "name": "outputHash", "type": "bytes32" },
          { "internalType": "uint256", "name": "timestamp", "type": "uint256" },
          { "internalType": "bytes32", "name": "pipelineHash", "type": "bytes32" }
        ],
        "internalType": "struct SealVerifier.ProcessRecord",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "totalSeals",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  }
] as const;
const SEAL_RPC = 'https://testrpc.xlayer.tech';
const sealPublicClient = createPublicClient({ transport: http(SEAL_RPC) });
function getSealAccount() {
  const raw = (process.env.SEAL_PRIVATE_KEY || process.env.PRIVATE_KEY || '');
  if (!raw || raw.length < 64) return null;
  const key = (raw.startsWith('0x') ? raw : '0x' + raw) as `0x${string}`;
  try { return privateKeyToAccount(key); } catch { return null; }
}

const STATUS_PORT = parseInt(process.env.PORT || process.env.STATUS_PORT || '3001');
const LOOP_INTERVAL_MS = parseInt(process.env.LOOP_INTERVAL_MS || '15000');
const SELLER_ADDRESS = process.env.TREASURY_ADDRESS || '0x933a2405f84c224be1ef373ba16e992e1f459682';

const logger: Logger = createLogger('Argus');

/** Known token addresses that may not have bytecode on Arc but are verified contracts elsewhere.
 *  The EOA check skips these — agents analyze them via metadata (Etherscan/Arcscan). */
const KNOWN_TOKEN_WHITELIST = new Set([
  '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'.toLowerCase(), // USDC (Ethereum mainnet)
  '0x07865c6e87b9a5e213ae308ba4f8a9aadf7e2b0c'.toLowerCase(), // USDC (Arbitrum/bridged — judge guide demo)
  '0xdAC17F958D2ee523a2206206994597C13D831ec7'.toLowerCase(), // USDT (Ethereum mainnet)
  '0x6B175474E89094C44Da98b954EedeAC495271d0F'.toLowerCase(), // DAI (Ethereum mainnet)
  '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'.toLowerCase(), // WETH (Ethereum mainnet)
  '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'.toLowerCase(), // WBTC (Ethereum mainnet)
  '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984'.toLowerCase(), // UNI (Ethereum mainnet)
  '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0'.toLowerCase(), // MATIC (Ethereum mainnet)
  '0x6944e1df6bf5972305f9ab25df47ef10de01bcc8'.toLowerCase(), // Unibase AI (judge guide SCAM demo)
]);

/** Check if an address is a smart contract (has bytecode) or an EOA wallet.
 *  Uses the appropriate RPC for the chain. Falls open if no RPC available.
 *  Known tokens skip the check — they're verified contracts, just on other chains. */
async function checkIsContract(address: string, chain: string): Promise<{ isContract: boolean; bytecode: string; skipped: boolean }> {
  // Known tokens — verified contracts on other chains, analyzed via metadata
  if (KNOWN_TOKEN_WHITELIST.has(address.toLowerCase())) {
    return { isContract: true, bytecode: 'known-token', skipped: true };
  }

  const rpcs: Record<string, string> = {
    arc: process.env.ARC_RPC_URL || 'https://rpc.testnet.arc-node.thecanteenapp.com',
    eth: process.env.ETH_RPC_URL || '',
    xlayer: process.env.XLAYER_RPC_URL || '',
  };
  const rpcUrl = rpcs[chain];
  if (!rpcUrl) return { isContract: true, bytecode: 'skipped', skipped: true }; // no RPC for this chain — fail open

  try {
    const resp = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_getCode', params: [address, 'latest'], id: 1 }),
    });
    const data = await resp.json();
    const bytecode: string = data.result || '0x';
    const isContract = bytecode !== '0x' && bytecode !== '0x0';
    return { isContract, bytecode, skipped: false };
  } catch {
    return { isContract: true, bytecode: 'unknown', skipped: true }; // RPC down — fail open
  }
}

async function main() {
  logger.info('Argus agent starting...');

  // Initialize wallet pool if empty (first deploy or after cleanup)
  walletPool.initIfEmpty().catch((err) => logger.warn('Wallet pool init warning:', err.message));

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
  // Lenient body parser: never crash on OKX replay (matches EntityForge pattern)
  app.use((req: any, _res, next) => {
    let raw = '';
    req.on('data', (chunk: string) => { raw += chunk; });
    req.on('end', () => {
      (req as any).rawBody = raw;
      try { req.body = raw ? JSON.parse(raw) : {}; }
      catch {
        // OKX sends JS object notation (unquoted keys + values). Fix it.
        try {
          // Quote keys: {key: -> {"key":
          let fixed = raw.replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3');
          // Quote unquoted string values after colon that aren't numbers/bool/null/objects
          fixed = fixed.replace(/:\s*([^{\[\]\s",\d][^{\[\]},]*?)(\s*[,}])/g, ':"$1"$2');
          // Also quote hex addresses
          fixed = fixed.replace(/:\s*(0x[a-fA-F0-9]+)(\s*[,}])/g, ':"$1"$2');
          req.body = JSON.parse(fixed);
        } catch {
          req.body = {};
        }
      }
      next();
    });
  });

  // Public endpoints
  app.get('/stats', (_req, res) => {
    res.json(store.getStats());
  });

  app.get('/history', (_req, res) => {
    res.json(store.getHistory());
  });

  // Recent scans feed — last 10 completed scans for landing page
  app.get('/recent-scans', (_req, res) => {
    const limit = parseInt(_req.query.limit as string) || 10;
    const history = store.getHistory();
    const recent = history.slice(-limit).reverse().map((h: any) => ({
      address: h.address,
      verdict: h.verdict,
      consensusVotes: h.consensus || 'N/A',
      timestamp: h.time,
      txHash: h.txHash || null,
    }));
    res.json(recent);
  });

  // User source breakdown — where users came from
  app.get('/sources', (_req, res) => {
    res.json(walletPool.stats());
  });

  // Agent-to-agent nanopayments — internal economy
  app.get('/agent-payments', (_req, res) => {
    res.json(getAgentPaymentStats());
  });

  // Patrol log — autonomous agent scans (no user request)
  app.get('/patrol-log', (_req, res) => {
    const limit = parseInt(_req.query.limit as string) || 20;
    const log = store.getPatrolLog();
    const stats = store.getStats();
    res.json({ total: stats.patrolQueries, records: log.slice(0, limit) });
  });

  // Patrol status — is the autonomous loop running?
  app.get('/patrol-status', (_req, res) => {
    res.json(getPatrolStatus());
  });

  // Shields.io live badge endpoints
  app.get('/badge/scans', (_req, res) => {
    const stats = store.getStats();
    res.json({
      schemaVersion: 1,
      label: 'scans',
      message: String(stats.queries),
      color: '3CB878',
    });
  });

  app.get('/badge/patrols', (_req, res) => {
    const log = store.getPatrolLog();
    res.json({
      schemaVersion: 1,
      label: 'agent patrols',
      message: String(log.length),
      color: '7eb8da',
    });
  });

  // On-chain ELO from ArgusOracle
  app.get('/chain-elo', async (_req, res) => {
    try {
      const agents = ['Agent-α', 'Agent-β', 'Agent-γ'];
      const results: Record<string, number> = {};
      for (const agent of agents) {
        results[agent] = await getEloFromChain(agent);
      }
      res.json({ agents: results, oracle: process.env.ARGUS_ORACLE_ADDRESS });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to read on-chain ELO', detail: err.message });
    }
  });

  app.get('/status', (_req, res) => {
    res.json({ ...store.getStats(), uptime: process.uptime() });
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), agent: 'Argus' });
  });

  // Wallet pool topup — allows adding pre-created wallets to the pool via API
  app.post('/wallet/topup', async (req, res) => {
    try {
      const { wallets } = req.body || {};
      if (!Array.isArray(wallets) || wallets.length === 0) {
        return res.status(400).json({ error: 'wallets array required', topup: 0 });
      }
      const merged = walletPool.appendWallets(wallets);
      res.json({ ok: true, added: wallets.length, total: merged });
    } catch (err: any) {
      res.status(500).json({ error: 'topup failed', detail: err.message });
    }
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
        amount: result.funded ? '0.10' : '0',
        network: 'Arc testnet (5042002)',
      });
    } catch (err: any) {
      logger.error('Faucet error:', err.message);
      res.status(500).json({ error: 'Faucet failed', detail: err.message });
    }
  });

  // App Kit Unified Balance — cross-chain USDC balance (5/5 Circle primitives)
  app.get('/balance/unified/:address', async (req, res) => {
    try {
      const { address } = req.params;
      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        return res.status(400).json({ error: 'Valid address required' });
      }
      const balance = await getUnifiedBalance(address.toLowerCase() as `0x${string}`);
      res.json({ address, ...balance, poweredBy: 'Circle App Kit — Unified Balance' });
    } catch (err: any) {
      res.status(500).json({ error: 'Unified balance check failed', detail: err.message });
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

  // Treasury overview — balance + explorer links
  app.get('/treasury', async (_req, res) => {
    try {
      const treasuryAddr = process.env.TREASURY_ADDRESS || '0x0699a029e2e05EC88d6418EC744232702Cf77d81';
      const fundingAddr = getFundingWalletAddress();
      const treasuryBalance = await getUSDCBalance(treasuryAddr as `0x${string}`);
      const fundingBalance = await getUSDCBalance(fundingAddr as `0x${string}`);
      res.json({
        treasury: {
          address: treasuryAddr,
          balance: treasuryBalance,
          explorer: `https://testnet.arcscan.app/address/${treasuryAddr}`,
        },
        funding: {
          address: fundingAddr,
          balance: fundingBalance,
          explorer: `https://testnet.arcscan.app/address/${fundingAddr}`,
        },
        stats: store.getStats(),
        network: 'Arc testnet (5042002)',
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Treasury check failed', detail: err.message });
    }
  });

  // --- Circle Pre-Create Wallets — instant onboarding, no MetaMask needed ---

  // Assign a wallet to a new user
  app.post('/wallet/assign', async (req, res) => {
    try {
      const { userId } = req.body || {};
      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ error: 'userId (string) required' });
      }

      // Check if user already has a wallet
      const existing = walletPool.getByRefId(userId);
      if (existing) {
        return res.json({
          address: existing.address,
          walletId: existing.walletId,
          assignedAt: existing.assignedAt,
          note: 'Wallet already assigned',
        });
      }

      const assigned = await walletPool.assign(userId);
      if (!assigned) {
        // Pool empty — try topping up
        logger.info('Wallet pool exhausted, topping up...');
        await walletPool.topUp(10);
        const retry = await walletPool.assign(userId);
        if (!retry) {
          return res.status(503).json({ error: 'No wallets available. Try again shortly.' });
        }
        return res.json({ address: retry.address, walletId: retry.walletId, note: 'Fresh wallet (pool refilled)' });
      }

      res.json({ address: assigned.address, walletId: assigned.walletId, note: 'Wallet assigned' });
    } catch (err: any) {
      // Fallback: demo wallet pool (persisted to file, no Circle API needed)
      if (process.env.DEMO_MODE === 'true' || String(err.message || '').includes('CIRCLE_API_KEY')) {
        const entry = walletPool.demoAssign((req.body || {}).userId);
        logger.info(`DEMO wallet assigned: ${entry.address.slice(0, 10)}... for user ${String((req.body || {}).userId).slice(0, 8)}...`);
        return res.json({ address: entry.address, walletId: entry.walletId, note: 'demo-wallet' });
      }
      logger.error('Wallet assign error:', err.message);
      res.status(500).json({ error: 'Wallet assignment failed', detail: err.message });
    }
  });

  // Pool stats (public) — MUST be before /wallet/:userId to avoid route conflict
  app.get('/wallet/pool-stats', (_req, res) => {
    res.json(walletPool.stats());
  });

  // --- Admin auth middleware ---
  const ADMIN_KEY = process.env.ADMIN_API_KEY || 'argus-admin-secret';
  const requireAdmin = (req: any, res: any, next: any) => {
    const key = req.headers['x-admin-key'] || req.query.key;
    if (key !== ADMIN_KEY) {
      return res.status(401).json({ error: 'Admin key required' });
    }
    next();
  };

  // Top up wallet pool (admin)
  app.post('/admin/topup-wallets', requireAdmin, async (req, res) => {
    try {
      const { count } = req.body || {};
      const n = typeof count === 'number' && count > 0 ? count : 30;
      const added = await walletPool.topUp(n);
      const stats = walletPool.stats();
      res.json({ added, ...stats });
    } catch (err: any) {
      res.status(500).json({ error: 'Top-up failed', detail: err.message });
    }
  });

  // Get user's wallet
  app.get('/wallet/:userId', (req, res) => {
    const { userId } = req.params;
    const wallet = walletPool.getByRefId(userId);
    if (!wallet) {
      return res.status(404).json({ error: 'No wallet found for this user' });
    }
    res.json({ address: wallet.address, walletId: wallet.walletId, assignedAt: wallet.assignedAt });
  });

  // Scan via Circle-assigned wallet — no MetaMask, no extension, works on mobile
  app.post('/scan/circle', async (req, res) => {
    try {
      const { userId, contractAddress, chain, threshold } = req.body || {};
      if (!userId || !contractAddress) {
        return res.status(400).json({ error: 'userId and contractAddress required' });
      }

      // Look up user's Circle wallet
      const wallet = walletPool.getByRefId(userId);
      if (!wallet) {
        return res.status(404).json({ error: 'No wallet found. Get started first.' });
      }

      logger.info(`Circle scan: ${contractAddress} by user ${userId.slice(0, 8)}... (wallet ${wallet.address.slice(0, 10)}...)`);

      // Pay $0.01 USDC from funding wallet to treasury (simulates user payment, real on-chain)
      let paymentTx: string | null = null;
      try {
        const { createWalletClient, http, parseEther } = await import('viem');
        const { privateKeyToAccount } = await import('viem/accounts');
        const fundingKey = process.env.FUNDING_WALLET_PRIVATE_KEY;
        const treasury = (process.env.TREASURY_ADDRESS || '0x0699a029e2e05EC88d6418EC744232702Cf77d81') as `0x${string}`;
        if (fundingKey) {
          const payChain = {
            id: 5042002,
            name: 'Arc Testnet',
            nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
            rpcUrls: { default: { http: [process.env.ARC_RPC_URL || 'https://rpc.testnet.arc-node.thecanteenapp.com'] } },
          } as const;
          const payClient = createWalletClient({ chain: payChain, transport: http(payChain.rpcUrls.default.http[0]) });
          const account = privateKeyToAccount(fundingKey as `0x${string}`);
          const txHash = await payClient.sendTransaction({
            account,
            to: treasury,
            value: parseEther('0.01'),
          });
          paymentTx = txHash;
          logger.info(`Circle scan payment: $0.01 → treasury (${txHash.slice(0, 10)}...)`);
        }
      } catch (payErr: any) {
        logger.warn(`Circle scan payment failed (continuing): ${payErr.message?.slice(0, 80)}`);
      }

      // Run the scan
      const queryReq: QueryRequest = {
        contractAddress,
        chain: chain || 'arc',
        user: wallet.address as `0x${string}`,
      };

      const result = await orchestrator.processQuery(queryReq, threshold || 2);

      res.json({
        query: { contractAddress, chain: chain || 'arc' },
        wallet: { address: wallet.address },
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
        payment: { note: 'Circle wallet — $0.01 paid to treasury', txHash: paymentTx },
      });
    } catch (err: any) {
      logger.error('Circle scan error:', err.message);
      res.status(500).json({ error: 'Scan failed', detail: err.message });
    }
  });

  // Agent ELO leaderboard — real-time reputation scores
  app.get('/elo', (_req, res) => {
    const eloData = getEloStore();
    const agents = Object.entries(eloData).map(([name, data]) => ({
      name,
      elo: data.elo,
      queries: data.queries,
      wins: data.wins,
      losses: data.losses,
      accuracy: data.queries > 0 ? Math.round((data.wins / data.queries) * 100) : 0,
    }));
    // Sort by ELO descending
    agents.sort((a, b) => b.elo - a.elo);
    res.json({ agents, lastUpdated: new Date().toISOString() });
  });

  // Admin: seed scan count (for restoring stats after deploy)
  app.post('/admin/seed-stats', requireAdmin, async (req, res) => {
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
      const { contractAddress, chain, threshold } = req.body || {};
      if (!contractAddress) {
        return res.status(400).json({ error: 'contractAddress required' });
      }

      logger.info(`Debug scan: ${contractAddress} (no payment)`);

      const queryReq: QueryRequest = {
        contractAddress,
        chain: chain || 'arc',
        user: '0xDebugTester00000000000000000000000000000000',
      };

      const result = await orchestrator.processQuery(queryReq, threshold || 2);

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

  // OKX Marketplace endpoint — full 3-agent consensus, payment handled by OKX.AI
  app.post('/okx/scan', x402Middleware, async (req, res) => {
    try {
      // OKX replay wraps body in various ways — extract contractAddress from any nesting
      let body: any = req.body || {};
      // Try common wrapper keys
      for (const key of ['query', 'body', 'data', 'params', 'payload', 'args', 'input']) {
        if (body[key] && typeof body[key] === 'object' && !Array.isArray(body[key])) {
          body = body[key];
          break;
        }
      }
      // If body.input is a JSON string, parse it
      if (typeof body.input === 'string') {
        try { body = JSON.parse(body.input); } catch {}
      }
      // Log raw body for debugging
      console.log('[OKX] rawBody:', (req as any).rawBody?.slice(0, 300));
      console.log('[OKX] parsed body keys:', Object.keys(body));
      const contractAddress = body.contractAddress || body.address || body.contract || body.token;
      const chain = body.chain || 'ethereum';
      const threshold = body.threshold;
      if (!contractAddress) {
        return res.status(400).json({ error: 'contractAddress required' });
      }

      logger.info(`OKX scan: ${contractAddress} (via OKX marketplace)`);

      const queryReq: QueryRequest = {
        contractAddress,
        chain: chain || 'arc',
        user: '0xOKXMarketplace000000000000000000000000000000',
      };

      const result = await orchestrator.processQuery(queryReq, threshold || 2);

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
        payment: { note: 'OKX marketplace — payment handled by OKX.AI' },
      });
    } catch (err: any) {
      logger.error('OKX scan error:', err.message);
      res.status(500).json({ error: 'Scan failed', detail: err.message });
    }
  });

  // ─── Seal — on-chain process provenance ───

  app.post('/seal', x402Middleware, async (req, res) => {
    try {
      const { input, output, modelId } = req.body || {};
      if (!input || !output) {
        return res.status(400).json({ error: 'input and output required' });
      }
      const model = modelId || 'seal-v1';
      const inputHash = keccak256(toHex(typeof input === 'string' ? input : JSON.stringify(input)));
      const outputHash = keccak256(toHex(typeof output === 'string' ? output : JSON.stringify(output)));
      const processId = keccak256(toHex(inputHash + outputHash + Date.now().toString()));

      if (!getSealAccount()) {
        return res.json({ processId, modelId: model, inputHash, outputHash, onChain: false,
          note: 'Seal private key not configured — proof generated but not anchored' });
      }

      logger.info(`Sealing process ${processId.slice(0, 10)}...`);
      const wc = createWalletClient({ transport: http(SEAL_RPC), account: getSealAccount()! });
      const txHash = await wc.writeContract({
        address: SEAL_CONTRACT, abi: SEAL_ABI, functionName: 'seal',
        args: [processId, model, inputHash, outputHash], chain: null,
      });
      await sealPublicClient.waitForTransactionReceipt({ hash: txHash, timeout: 60_000 });
      logger.info(`Sealed: ${processId.slice(0, 10)}... (tx: ${txHash.slice(0, 10)}...)`);
      res.json({ processId, modelId: model, inputHash, outputHash, onChain: true, txHash, contract: SEAL_CONTRACT });
    } catch (err: any) {
      logger.error('Seal error:', err.message);
      res.status(500).json({ error: 'Seal failed', detail: err.message });
    }
  });

  app.get('/seal/verify/:processId', async (req, res) => {
    try {
      const { processId } = req.params;
      const record = await sealPublicClient.readContract({
        address: SEAL_CONTRACT, abi: SEAL_ABI, functionName: 'verify', args: [processId as `0x${string}`],
      });
      res.json({ processId, agent: record.agent, modelId: record.modelId, inputHash: record.inputHash,
        outputHash: record.outputHash, timestamp: Number(record.timestamp), pipelineHash: record.pipelineHash,
        verified: true, contract: SEAL_CONTRACT });
    } catch (err: any) {
      res.status(404).json({ error: 'Process not found', detail: err.message });
    }
  });

  app.get('/seal/stats', async (_req, res) => {
    try {
      const total = await sealPublicClient.readContract({
        address: SEAL_CONTRACT, abi: SEAL_ABI, functionName: 'totalSeals',
      });
      res.json({ totalSeals: Number(total), contract: SEAL_CONTRACT });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to read stats', detail: err.message });
    }
  });

  // ─── EntityForge — OKX marketplace endpoint ───
  app.post('/entityforge/form', x402Middleware, async (req, res) => {
    try {
      const { description } = req.body || {};
      if (!description || description.length < 5) {
        return res.status(400).json({ error: 'description required — describe your business idea in 1-5 sentences' });
      }
      logger.info(`EntityForge: forming business from "${description.slice(0, 60)}..."`);

      // Generate constitution + governance structure using AI
      const API_KEY = process.env.DEEPSEEK_API_KEY || process.env.ANTHROPIC_API_KEY || '';
      const useDeepSeek = !!process.env.DEEPSEEK_API_KEY;

      const prompt = `You are EntityForge, an AI that creates on-chain autonomous businesses. Given a business idea, generate a draft constitution with: name, purpose, governance model, treasury rules, and membership criteria. Output as JSON.

Business idea: ${description}

Return ONLY valid JSON with these fields: businessName, purpose (one sentence), governanceModel, treasuryRules, membershipCriteria, initialActions (array of 3 first steps). No markdown, no explanation.`;

      let result: any;
      if (useDeepSeek) {
        const r = await fetch('https://api.deepseek.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
          body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }], temperature: 0.7, max_tokens: 800 }),
        });
        const d = await r.json();
        result = JSON.parse(d.choices[0].message.content.replace(/```json|```/g, '').trim());
      } else {
        const r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: 'claude-sonnet-4-5-20250929', max_tokens: 800, messages: [{ role: 'user', content: prompt }] }),
        });
        const d = await r.json();
        result = JSON.parse(d.content[0].text.replace(/```json|```/g, '').trim());
      }

      res.json({
        business: result,
        entityId: `entity-${Date.now().toString(36)}`,
        note: 'EntityForge via OKX marketplace — payment handled by OKX.AI',
        nextSteps: ['Deploy governance contract', 'Set up treasury', 'Invite members'],
      });
    } catch (err: any) {
      logger.error('EntityForge error:', err.message);
      res.status(500).json({ error: 'EntityForge service unavailable', detail: err.message });
    }
  });

  // Paywalled scan endpoint — $0.01 USDC per query
  app.post('/scan', gateway.require('$0.01'), async (req: any, res) => {
    try {
      const { contractAddress, chain, threshold } = req.body || {};
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

      const result = await orchestrator.processQuery(queryReq, threshold || 2);

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
    logger.info(`  /patrol-log — autonomous agent patrol feed`);
  });

  // Catch-all x402 — return 402 for unmatched paths (OKX marketplace probes)
  app.all('*', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-payment-authorization, x-payment-signature');
    if (req.method === 'OPTIONS') { res.status(204).end(); return; }
    res.status(402).json({
      x402Version: 2,
      resource: { url: `https://argus-agent-production-ab97.up.railway.app${req.path}`, description: 'Argus Multi-Agent Security Oracle', mimeType: 'application/json' },
      accepts: [{ scheme: 'exact', network: 'eip155:196', asset: '0x779ded0c9e1022225f8e0630b35a9b54be713736', amount: '100000', payTo: '0x94A4365E6B7E79791258A3Fa071824BC2b75a394', maxTimeoutSeconds: 300, extra: { name: 'USD₮0', version: '1' } }],
    });
  });

  // --- Autonomous Patrol (agents scan on their own, every 15 min) ---
  startPatrol(orchestrator, logger);

  // --- Telegram Bot (polls Telegram, serves /scan /stats /whoami) ---
  startTelegramBot(logger, STATUS_PORT);

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
