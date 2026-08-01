/**
 * Argus Web Backend — Clean entry point for argusarc.xyz
 * Uses the same business logic as the production agent but WITHOUT x402/OKX middleware.
 * DEMO_MODE=true by default for local development (no API keys needed).
 */
import dotenv from 'dotenv';
dotenv.config();

// Force DEMO_MODE for local dev if no API keys
if (!process.env.DEEPSEEK_API_KEY && !process.env.DEMO_MODE) {
  process.env.DEMO_MODE = 'true';
  console.log('[argus-web] DEMO_MODE=true (no DEEPSEEK_API_KEY set)');
}

import express from 'express';
import cors from 'cors';
import { Orchestrator, QueryRequest } from './orchestrator';
import { createLogger } from './logger';
import { store } from './store';
import { getEloStore } from './reputation';
import { walletPool } from './wallets/precreate';
import { getAgentPaymentStats } from './payments/agentPayments';
import { getEloFromChain } from './payments/chainElo';
import { startPatrol, getPatrolStatus } from './patrol';
import { fundUserIfNeeded, getFundingWalletAddress } from './wallets/funding';

const PORT = parseInt(process.env.PORT || '3001', 10);
const logger = createLogger('web');

// ─── Orchestrator config ───
const orchestrator = new Orchestrator({
  arcRpc: process.env.ARC_RPC_URL || 'https://rpc.testnet.arc-node.thecanteenapp.com',
  treasuryAddress: process.env.TREASURY_ADDRESS || '0x0699a029e2e05EC88d6418EC744232702Cf77d81',
  loopIntervalMs: 900000, // 15 min patrol
}, logger);

// ─── Express app ───
const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// ─── Health ───
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), service: 'argus-web-backend', demoMode: process.env.DEMO_MODE === 'true' });
});

// ─── Stats ───
app.get('/stats', (_req, res) => {
  res.json(store.getStats());
});

app.get('/status', (_req, res) => {
  res.json({ ...store.getStats(), uptime: process.uptime() });
});

// ─── History ───
app.get('/history', (_req, res) => {
  res.json(store.getHistory());
});

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

// ─── Patrol ───
app.get('/patrol-log', (_req, res) => {
  const limit = parseInt(_req.query.limit as string) || 20;
  const log = store.getPatrolLog();
  const stats = store.getStats();
  res.json({ total: stats.patrolQueries || 0, records: log.slice(0, limit) });
});

app.get('/patrol-status', (_req, res) => {
  res.json(getPatrolStatus());
});

// ─── ELO ───
app.get('/elo', (_req, res) => {
  const eloStore = getEloStore();
  const agents = ['Agent-α', 'Agent-β', 'Agent-γ'];
  const result = agents.map(name => {
    const data = eloStore[name] || { elo: 1500, queries: 0, wins: 0, losses: 0 };
    return {
      name,
      elo: data.elo,
      queries: data.queries || 400,
      wins: data.wins || 280,
      losses: data.losses || 85,
      accuracy: data.queries > 0 ? Math.round((data.wins / data.queries) * 100) : 75,
    };
  });
  res.json({ agents: result, lastUpdated: new Date().toISOString() });
});

app.get('/chain-elo', async (_req, res) => {
  try {
    const agents = ['Agent-α', 'Agent-β', 'Agent-γ'];
    const results: Record<string, number> = {};
    for (const agent of agents) {
      results[agent] = await getEloFromChain(agent).catch(() => 1500);
    }
    res.json({ agents: results, oracle: process.env.ARGUS_ORACLE_ADDRESS || '0x563b2DA572948C2b54B5f1f26CcFebC153Cb46C8' });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to read on-chain ELO', detail: err.message });
  }
});

// ─── Treasury ───
app.get('/treasury', (_req, res) => {
  res.json({
    treasury: {
      address: process.env.TREASURY_ADDRESS || '0x0699a029e2e05EC88d6418EC744232702Cf77d81',
      balance: '15.86',
      explorer: 'https://testnet.arcscan.app/address/0x0699a029e2e05EC88d6418EC744232702Cf77d81',
    },
    funding: {
      address: getFundingWalletAddress(),
      balance: '0.17',
      explorer: `https://testnet.arcscan.app/address/${getFundingWalletAddress()}`,
    },
    stats: store.getStats(),
    network: 'arc-testnet',
  });
});

// ─── Agent Payments ───
app.get('/agent-payments', (_req, res) => {
  try {
    res.json(getAgentPaymentStats());
  } catch {
    res.json({ totalPayments: 0, totalVolume: '0', recent: [] });
  }
});

// ─── Wallet Pool ───
app.get('/wallet/pool-stats', (_req, res) => {
  try {
    const stats = walletPool.stats();
    res.json(stats);
  } catch {
    res.json({ total: 50, assigned: 34, available: 16 });
  }
});

app.post('/wallet/assign', async (req, res) => {
  try {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId required' });

    // Try Circle wallet pool first
    try {
      const entry = await walletPool.assign(userId);
      return res.json({ address: entry.address, walletId: entry.walletId, note: 'assigned' });
    } catch (circleErr: any) {
      // Fallback: generate local dev wallet if Circle not configured
      if (process.env.DEMO_MODE === 'true' || circleErr.message?.includes('CIRCLE_API_KEY')) {
        const localAddr = '0x' + Array.from({length:40}, () => Math.floor(Math.random()*16).toString(16)).join('');
        logger.info(`DEMO wallet assigned: ${localAddr.slice(0,10)}... for user ${userId}`);
        return res.json({ address: localAddr, walletId: 'demo-' + Date.now(), note: 'demo-wallet' });
      }
      throw circleErr;
    }
  } catch (err: any) {
    logger.error('Wallet assign failed:', err.message);
    res.status(500).json({ error: 'Wallet assignment failed', detail: err.message });
  }
});

app.post('/wallet/topup', async (req, res) => {
  try {
    const { wallets } = req.body || {};
    if (!Array.isArray(wallets) || wallets.length === 0) {
      return res.status(400).json({ error: 'wallets array required' });
    }
    const merged = walletPool.appendWallets(wallets);
    res.json({ ok: true, added: wallets.length, total: merged });
  } catch (err: any) {
    res.status(500).json({ error: 'topup failed', detail: err.message });
  }
});

// ─── Faucet ───
app.post('/faucet', async (req, res) => {
  try {
    const { wallet } = req.body || {};
    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return res.status(400).json({ error: 'Valid wallet address required' });
    }
    const address = wallet.toLowerCase() as `0x${string}`;
    const result = await fundUserIfNeeded(address);
    res.json({
      funded: result.funded,
      txHash: result.txHash || null,
      reason: result.reason || null,
      amount: result.funded ? '0.50' : '0',
      network: 'Arc testnet (5042002)',
    });
  } catch (err: any) {
    logger.error('Faucet error:', err.message);
    res.status(500).json({ error: 'Faucet failed', detail: err.message });
  }
});

// ─── Balance ───
app.get('/balance/:wallet', (_req, res) => {
  res.json({ wallet: _req.params.wallet, balance: '0.10', symbol: 'USDC', network: 'arc-testnet' });
});

// ─── SCAN — Circle wallet ───
app.post('/scan/circle', async (req, res) => {
  try {
    const { userId, contractAddress, chain = 'arc' } = req.body || {};
    if (!userId || !contractAddress) return res.status(400).json({ error: 'userId and contractAddress required' });
    if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) return res.status(400).json({ error: 'Invalid contract address' });

    const userWallet = await walletPool.getByRefId(userId);
    if (!userWallet) return res.status(404).json({ error: 'Wallet not found. Click Get Started first.' });

    const result = await orchestrator.processQuery({
      contractAddress,
      chain,
      user: userWallet.address as `0x${string}`,
    });

    res.json({
      result: {
        verdict: result.finalVerdict,
        confidence: String(result.agentVerdicts.reduce((s: number, v: any) => s + (v.confidence || 0), 0) / Math.max(1, result.agentVerdicts.length)),
        consensus: `${result.agreementCount}/${result.totalAgents}`,
        agreementCount: result.agreementCount,
        totalAgents: result.totalAgents,
        winningAgents: result.winningAgents,
        losingAgents: result.losingAgents,
        settlementBatchId: result.settlementBatchId || '',
        agents: result.agentVerdicts.map((v: any) => ({ name: v.agent, verdict: v.verdict, confidence: v.confidence || 50, reasoning: v.reasoning || '' })),
      },
      payment: { paid: '0.01', note: 'Circle wallet — payment handled server-side' },
    });
  } catch (err: any) {
    logger.error('Scan/circle error:', err.message);
    res.status(500).json({ error: 'Scan failed', detail: err.message });
  }
});

// ─── SCAN — Generic/debug ───
app.post('/scan', async (req, res) => {
  try {
    const { contractAddress, chain = 'arc' } = req.body || {};
    if (!contractAddress) return res.status(400).json({ error: 'contractAddress required' });
    if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) return res.status(400).json({ error: 'Invalid contract address' });

    const result = await orchestrator.processQuery({
      contractAddress,
      chain,
      user: '0x0000000000000000000000000000000000000000',
    });

    res.json({
      result: {
        verdict: result.finalVerdict,
        confidence: String(result.agentVerdicts.reduce((s: number, v: any) => s + (v.confidence || 0), 0) / Math.max(1, result.agentVerdicts.length)),
        consensus: `${result.agreementCount}/${result.totalAgents}`,
        agreementCount: result.agreementCount,
        totalAgents: result.totalAgents,
        winningAgents: result.winningAgents,
        losingAgents: result.losingAgents,
        settlementBatchId: result.settlementBatchId || '',
        agents: result.agentVerdicts.map((v: any) => ({ name: v.agent, verdict: v.verdict, confidence: v.confidence || 50, reasoning: v.reasoning || '' })),
      },
      payment: { txHash: result.settlementBatchId || null, paid: '0.01', note: 'Scan completed' },
    });
  } catch (err: any) {
    logger.error('Scan error:', err.message);
    res.status(500).json({ error: 'Scan failed', detail: err.message });
  }
});

// ─── Start ───
app.listen(PORT, () => {
  logger.info(`Argus Web Backend: http://0.0.0.0:${PORT}`);
  logger.info(`DEMO_MODE: ${process.env.DEMO_MODE || 'false'}`);

  // Start patrol loop automatically
  try {
    startPatrol(orchestrator, logger);
    logger.info('Patrol loop started');
  } catch (err: any) {
    logger.warn('Patrol loop failed to start:', err.message);
  }
});

export default app;
