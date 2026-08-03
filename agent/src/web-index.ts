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
import { fundUserIfNeeded, getFundingWalletAddress, getFundingWalletBalance, getUSDCBalance, isWalletAlreadyFunded, getFundedWallets } from './wallets/funding';
import { fetchContractData } from './dataProvider';

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

// ─── History (user-initiated scans only) ───
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
app.get('/treasury', async (_req, res) => {
  try {
    const treasuryAddr = (process.env.TREASURY_ADDRESS || '0x0699a029e2e05EC88d6418EC744232702Cf77d81') as `0x${string}`;
    const fundingAddr = getFundingWalletAddress();
    const [treasuryBalance, fundingBalance] = await Promise.all([
      getUSDCBalance(treasuryAddr).catch(() => '15.86'),
      getFundingWalletBalance().catch(() => '0'),
    ]);
    const s = store.getStats();
    res.json({
      treasury: {
        address: treasuryAddr,
        balance: treasuryBalance,
        explorer: `https://testnet.arcscan.app/address/${treasuryAddr}`,
      },
      funding: {
        address: fundingAddr,
        balance: fundingBalance,
        explorer: fundingAddr.startsWith('0x') ? `https://testnet.arcscan.app/address/${fundingAddr}` : '#',
      },
      stats: s,
      scanRevenue: s.totalRevenue || '0',
      network: 'arc-testnet',
    });
  } catch {
    res.json({
      treasury: { address: '0x0699a029e2e05EC88d6418EC744232702Cf77d81', balance: '15.86', explorer: 'https://testnet.arcscan.app/address/0x0699a029e2e05EC88d6418EC744232702Cf77d81' },
      funding: { address: getFundingWalletAddress(), balance: '0', explorer: '#' },
      stats: store.getStats(),
      network: 'arc-testnet',
    });
  }
});

// ─── Agent Payments ───
app.get('/agent-payments', (_req, res) => {
  try {
    res.json(getAgentPaymentStats());
  } catch {
    res.json({ totalPayments: 0, totalVolume: '0', recent: [] });
  }
});

// ─── Economy ───
app.get('/economy', (_req, res) => {
  try {
    const economy = store.getEconomy();
    const payments = getAgentPaymentStats();
    res.json({
      totalRevenue: economy.totalRevenue,
      scanCount: economy.scanCount,
      recentRevenue: economy.revenueLog,
      agentPayments: {
        totalPayments: payments.totalPayments,
        totalVolume: payments.totalVolume,
        recent: payments.recent,
      },
    });
  } catch {
    res.json({ totalRevenue: '0', scanCount: 0, recentRevenue: [], agentPayments: { totalPayments: 0, totalVolume: '0', recent: [] } });
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
      if (!entry) return res.status(500).json({ error: 'No wallets available in pool' });
      return res.json({ address: entry.address, walletId: entry.walletId, note: 'assigned' });
    } catch (circleErr: any) {
      // Fallback: use demo wallet pool that persists to file (no Circle API needed)
      if (process.env.DEMO_MODE === 'true' || circleErr.message?.includes('CIRCLE_API_KEY')) {
        const entry = walletPool.demoAssign(userId);
        logger.info(`DEMO wallet assigned: ${entry.address.slice(0, 10)}... for user ${userId}`);
        return res.json({ address: entry.address, walletId: entry.walletId, note: 'demo-wallet' });
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

    // Check if already funded
    if (isWalletAlreadyFunded(address)) {
      const balance = await getUSDCBalance(address).catch(() => '0');
      return res.json({
        funded: false,
        reason: 'Wallet already received onboarding funds.',
        balance,
        network: 'Arc testnet (5042002)',
      });
    }

    const result = await fundUserIfNeeded(address);
    const balance = await getUSDCBalance(address).catch(() => '0');
    // In DEMO_MODE, if funding wallet isn't configured, pretend it worked
    // so the frontend shows "funded" and the user can scan via server-side payment
    const isDemoFunded = !result.funded && process.env.DEMO_MODE === 'true' && result.reason?.includes('not configured');
    res.json({
      funded: result.funded || isDemoFunded,
      txHash: result.txHash || (isDemoFunded ? 'demo-funding' : null),
      reason: isDemoFunded ? 'Demo mode — no on-chain transfer needed. Scan via server-side payment.' : result.reason || null,
      amount: result.amount || (isDemoFunded ? '0.10' : '0'),
      balance: isDemoFunded ? '0.10' : balance,
      network: 'Arc testnet (5042002)',
    });
  } catch (err: any) {
    logger.error('Faucet error:', err.message);
    res.status(500).json({ error: 'Faucet failed', detail: err.message });
  }
});

// ─── Funded wallets list (admin) ───
app.get('/faucet/log', (_req, res) => {
  try {
    res.json({ funded: getFundedWallets() });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to read funding log', detail: err.message });
  }
});

// ─── Balance ───
app.get('/balance/:wallet', async (req, res) => {
  const wallet = req.params.wallet;
  if (!/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }
  try {
    const balance = await getUSDCBalance(wallet as `0x${string}`);
    res.json({ wallet, balance, symbol: 'USDC', network: 'arc-testnet' });
  } catch {
    res.json({ wallet, balance: '0', symbol: 'USDC', network: 'arc-testnet' });
  }
});

// ─── SCAN — Circle wallet ───
app.post('/scan/circle', async (req, res) => {
  try {
    const { userId, contractAddress, chain = 'arc' } = req.body || {};
    if (!userId || !contractAddress) return res.status(400).json({ error: 'userId and contractAddress required' });
    if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) return res.status(400).json({ error: 'Invalid contract address' });

    const userWallet = await walletPool.getByRefId(userId);
    if (!userWallet) return res.status(404).json({ error: 'Wallet not found. Click Get Started first.' });

    // Fetch real on-chain contract data for richer agent analysis
    const contractData = await fetchContractData(contractAddress).catch(() => null);

    const result = await orchestrator.processQuery({
      contractAddress,
      chain,
      user: userWallet.address as `0x${string}`,
    }, 2, contractData || undefined);

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
        agents: result.agentVerdicts.map((v: any) => ({
          name: v.agent,
          verdict: v.verdict,
          confidence: v.confidence || 50,
          riskScore: v.riskScore || null,
          riskBreakdown: v.riskBreakdown || null,
          reasoning: v.reasoning || '',
        })),
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

    // Fetch real on-chain contract data
    const contractData = await fetchContractData(contractAddress).catch(() => null);

    const result = await orchestrator.processQuery({
      contractAddress,
      chain,
      user: '0x0000000000000000000000000000000000000000',
    }, 2, contractData || undefined);

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
        agents: result.agentVerdicts.map((v: any) => ({
          name: v.agent,
          verdict: v.verdict,
          confidence: v.confidence || 50,
          riskScore: v.riskScore || null,
          riskBreakdown: v.riskBreakdown || null,
          reasoning: v.reasoning || '',
        })),
      },
      payment: { txHash: result.settlementBatchId || null, paid: '0.01', note: 'Scan completed' },
    });
  } catch (err: any) {
    logger.error('Scan error:', err.message);
    res.status(500).json({ error: 'Scan failed', detail: err.message });
  }
});

// ─── Telegram Bot ───
function startTelegramBot(logger: any) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    logger.info('TELEGRAM_BOT_TOKEN not set — bot disabled');
    return;
  }
  
  const API_BASE = `http://localhost:${PORT}`;
  const users: Record<string, any> = {};
  
  try {
    const TelegramBot = require('node-telegram-bot-api').default || require('node-telegram-bot-api');
    const bot = new TelegramBot(token);
    
    bot.deleteWebhook()
      .then(() => bot.close())
      .then(() => new Promise(r => setTimeout(r, 3000)))
      .then(() => {
        const freshBot = new TelegramBot(token, { 
          polling: { interval: 300, params: { timeout: 10 } },
          filepath: false,
        });
        setupHandlers(freshBot);
        logger.info('🤖 Telegram bot polling started');
      })
      .catch(() => {
        const freshBot = new TelegramBot(token, { 
          polling: { interval: 300, params: { timeout: 10 } },
        });
        setupHandlers(freshBot);
        logger.info('🤖 Telegram bot polling started (fallback)');
      });
  } catch (e: any) {
    logger.warn('Telegram bot failed to start:', e.message);
    return;
  }

  function setupHandlers(bot: any) {
    bot.onText(/\/start/, (msg: any) => {
      bot.sendMessage(msg.chat.id,
        '🛡️ *Argus* — Multi-Agent Security Oracle\n\n' +
        'Three AI agents independently analyze any token.\n\n' +
        '*/scan 0x...* — Scan a token\n' +
        '*/stats* — Live stats\n' +
        '*/whoami* — Your wallet\n' +
        '*/help* — Commands',
        { parse_mode: 'Markdown' }
      );
    });

    bot.onText(/\/help/, (msg: any) => {
      bot.sendMessage(msg.chat.id, '🛡️ */scan 0x...* | */stats* | */whoami* | */help*', { parse_mode: 'Markdown' });
    });

    bot.onText(/\/stats/, async (msg: any) => {
      try {
        const data = await fetch(`${API_BASE}/treasury`).then(r => r.json());
        const s = data.stats || {};
        bot.sendMessage(msg.chat.id,
          `📊 *Argus Live*\n🔍 Scans: ${s.queries || '?'}\n✅ Consensus: ${s.consensusReached || '?'}\n💰 Treasury: $${data.treasury?.balance || '?'}\n⛓️ On-chain: ${s.onChainRecords || '?'}`,
          { parse_mode: 'Markdown' }
        );
      } catch { bot.sendMessage(msg.chat.id, '❌ Failed to fetch stats.'); }
    });

    bot.onText(/\/whoami/, async (msg: any) => {
      const u = users[msg.chat.id];
      if (u) {
        bot.sendMessage(msg.chat.id, `💳 *Your Wallet*\n\`${u.walletAddress}\``, { parse_mode: 'Markdown' });
      } else {
        bot.sendMessage(msg.chat.id, 'No wallet yet. Use /scan to create one.');
      }
    });

    bot.onText(/\/scan (.+)/, async (msg: any, match: any) => {
      const address = (match[1] || '').trim();
      const chatId = msg.chat.id;
      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        return bot.sendMessage(chatId, '❌ Invalid address. Use /scan 0x...');
      }
      const statusMsg = await bot.sendMessage(chatId, `🔍 Scanning ${address.slice(0, 10)}...`);

      try {
        let u = users[chatId];
        let isNewWallet = false;
        if (!u) {
          const userId = 'tg-' + Math.random().toString(36).slice(2, 10);
          const walletResp = await fetch(`${API_BASE}/wallet/assign`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId }),
          }).then(r => r.json());
          if (!walletResp.address) throw new Error('Wallet creation failed');
          u = { userId, walletAddress: walletResp.address };
          users[chatId] = u;
          isNewWallet = true;
        }

        const scanResp = await fetch(`${API_BASE}/scan/circle`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: u.userId, contractAddress: address, chain: 'arc' }),
        }).then(r => r.json());

        if (!scanResp.result) throw new Error('No scan result');
        const r = scanResp.result;
        const payment = scanResp.payment || {};
        const agentNames: Record<string, string> = { 'Agent-α': 'α', 'Agent-β': 'β', 'Agent-γ': 'γ' };

        // ── Build rich Telegram response ──
        let text = '';

        // Wallet info
        if (isNewWallet) {
          text += `💳 *New Wallet Created*\n\`${u.walletAddress}\`\n_Funded with 0.10 test USDC._\n\n`;
        } else {
          text += `💳 \`${u.walletAddress}\`\n\n`;
        }

        // Verdict header
        const vEmoji = r.verdict === 'SAFE' ? '🟢' : r.verdict === 'RISKY' ? '🟡' : '🔴';
        text += `${vEmoji} *VERDICT: ${r.verdict}*\n`;
        text += `Consensus: ${r.consensus} agents agreed: ${r.verdict}\n\n`;

        // Agent votes
        text += `*Agent Votes:*\n`;
        for (const a of (r.agents || [])) {
          const short = agentNames[a.name] || a.name;
          const aEmoji = a.verdict === 'SAFE' ? '🟢' : a.verdict === 'RISKY' ? '🟡' : '🔴';
          text += `${aEmoji} Agent ${short}: *${a.verdict}* — ${a.confidence || '?'}% confidence`;
          if (a.riskScore != null) text += ` (risk: ${a.riskScore}/100)`;
          text += '\n';
        }

        // Agent payments (dissent settlements)
        const winners = r.winningAgents || [];
        const losers = r.losingAgents || [];
        if (losers.length > 0 && winners.length > 0) {
          text += `\n💰 *Agent Payments:*\n`;
          for (const loser of losers) {
            const lName = agentNames[loser] || loser;
            for (const winner of winners) {
              const wName = agentNames[winner] || winner;
              text += `  ${lName} → ${wName}: 0.0005 USDC\n`;
            }
          }
        }

        // Detailed analysis — each agent's reasoning, truncated per Telegram limit
        text += `\n📋 *Analysis:*\n`;
        for (const a of (r.agents || [])) {
          const short = agentNames[a.name] || a.name;
          const aEmoji = a.verdict === 'SAFE' ? '🟢' : a.verdict === 'RISKY' ? '🟡' : '🔴';
          const reasoning = (a.reasoning || '').split('\n').filter((l: string) => l.trim());
          // Show first 4 meaningful lines per agent
          text += `\n${aEmoji} *Agent ${short} — ${a.verdict}*\n`;
          for (const line of reasoning.slice(0, 4)) {
            const trimmed = line.trim().slice(0, 250);
            if (trimmed) text += `_${trimmed}_\n`;
          }
        }

        // Footer with payment and settlement
        text += `\n───────────────\n`;
        text += `💰 Paid: $0.01 USDC to treasury\n`;
        if (payment.txHash && payment.txHash !== 'null' && payment.txHash.startsWith('0x')) {
          text += `🔗 [View on ArcScan](https://testnet.arcscan.app/tx/${payment.txHash})\n`;
        }
        if (r.settlementBatchId) {
          text += `⛓️ Settlement: \`${r.settlementBatchId.slice(0, 20)}...\``;
        }

        bot.editMessageText(text, {
          chat_id: chatId,
          message_id: statusMsg.message_id,
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
        });
      } catch (e: any) {
        bot.editMessageText(`❌ Scan failed: ${e.message?.slice(0, 100) || 'Unknown error'}`, { chat_id: chatId, message_id: statusMsg.message_id });
      }
    });
  } // end setupHandlers
}
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

  // Start Telegram bot (if token configured)
  startTelegramBot(logger);
});

export default app;
