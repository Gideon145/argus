#!/usr/bin/env node
// ─── Argus Telegram Bot ─────────────────────────────────
// /scan 0x... — 3-agent security verdict with real wallet
// /stats — live treasury & scan numbers
// /whoami — your wallet address
// ─────────────────────────────────────────────────────────

const { TelegramBot } = require('node-telegram-bot-api');
const https = require('https');
const crypto = require('crypto');

const TOKEN = 'REDACTED_TELEGRAM_TOKEN';
const API = 'argus-agent-production-ab97.up.railway.app';

let bot;
try {
  bot = new TelegramBot(TOKEN, { polling: true });
  console.log('🤖 Telegram bot polling started');
} catch (e) {
  console.error('Telegram bot init failed:', e.message);
  // Don't crash — create a dummy bot that logs errors
  bot = {
    onText: () => {},
    on: () => {},
    sendMessage: () => Promise.resolve(),
    editMessageText: () => Promise.resolve(),
  };
}

// ─── User wallet store (chatId → { userId, walletAddress, walletId, createdAt }) ──
const users = {};

// ─── Helpers ─────────────────────────────────────────────

function apiGet(path) {
  return new Promise((resolve, reject) => {
    https.get(`https://${API}${path}`, { headers: { Accept: 'application/json' } }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(data); }
      });
    }).on('error', reject);
  });
}

function apiPost(path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = https.request(`https://${API}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(data); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ─── Verdict emoji ───────────────────────────────────────

function verdictEmoji(v) {
  if (v === 'SAFE') return '🟢';
  if (v === 'RISKY') return '🟡';
  return '🔴';
}

// ─── Wallet setup per Telegram user ──────────────────────

async function ensureWallet(chatId) {
  if (users[chatId]) return users[chatId];

  const userId = 'tg-' + crypto.randomBytes(6).toString('hex');
  const wallet = await apiPost('/wallet/assign', { userId });

  if (!wallet || !wallet.address) {
    throw new Error('Wallet creation failed');
  }

  users[chatId] = {
    userId,
    walletAddress: wallet.address,
    walletId: wallet.walletId || null,
    createdAt: new Date().toISOString(),
  };

  return users[chatId];
}

// ─── Handlers ────────────────────────────────────────────

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id,
    `\`\`\`\n` +
    `     █████╗ ██████╗  ██████╗ ██╗   ██╗███████╗\n` +
    `    ██╔══██╗██╔══██╗██╔════╝ ██║   ██║██╔════╝\n` +
    `    ███████║██████╔╝██║  ███╗██║   ██║███████╗\n` +
    `    ██╔══██║██╔══██╗██║   ██║██║   ██║╚════██║\n` +
    `    ██║  ██║██║  ██║╚██████╔╝╚██████╔╝███████║\n` +
    `    ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝  ╚═════╝ ╚══════╝\n` +
    `\`\`\``,
    { parse_mode: 'Markdown' }
  );

  bot.sendMessage(msg.chat.id,
    `🛡️ *Argus* — Multi-Agent Security Oracle\n\n` +
    `Three AI agents independently analyze any token address. Each stakes real USDC on its verdict. Two must agree. Losers pay winners. Every result recorded on-chain.\n\n` +
    `*Try it:*\n` +
    `/scan 0x... (paste any token address)\n\n` +
    `*Commands:*\n` +
    `*/scan 0x...* — Scan a token address\n` +
    `*/stats* — Live treasury & scan numbers\n` +
    `*/whoami* — Your Circle wallet\n` +
    `*/help* — Show commands\n\n` +
    `_argusarc.xyz | npx argus-scan@latest_`,
    { parse_mode: 'Markdown' }
  );
});

bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id,
    `🛡️ *Argus Commands*\n\n` +
    `*/scan 0x...* — Scan a token address\n` +
    `*/stats* — Live treasury & scan numbers\n` +
    `*/whoami* — Your wallet address\n` +
    `*/help* — Show this menu\n\n` +
    `Example: /scan 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`,
    { parse_mode: 'Markdown' }
  );
});

bot.onText(/\/whoami/, async (msg) => {
  const chatId = msg.chat.id;
  try {
    const u = await ensureWallet(chatId);
    bot.sendMessage(chatId,
      `💳 *Your Wallet*\n\n` +
      `Address: \`${u.walletAddress}\`\n` +
      `User ID: \`${u.userId}\`\n` +
      `Created: ${u.createdAt?.slice(0, 10) || 'now'}\n\n` +
      `_Funded with 0.50 test USDC. $0.01 per scan._`,
      { parse_mode: 'Markdown' }
    );
  } catch (e) {
    bot.sendMessage(chatId, '❌ Failed to fetch wallet. Try /scan first.');
  }
});

bot.onText(/\/stats/, async (msg) => {
  try {
    const data = await apiGet('/treasury');
    const s = data.stats || {};
    const t = data.treasury || {};
    const u = users[msg.chat.id];

    let text = `📊 *Argus Live Stats*\n\n` +
      `🔍 Scans: *${s.queries || '?'}*\n` +
      `✅ Consensus: *${s.consensusReached || '?'}* (${s.avgConfidence || '?'}% avg)\n` +
      `💰 Treasury: *$${t.balance || '?'} USDC*\n` +
      `⛓️ On-chain: *${s.onChainRecords || '?'}* records\n` +
      `🌐 Network: Arc testnet (5042002)`;

    if (u) {
      text += `\n\n💳 *Your Wallet:* \`${u.walletAddress.slice(0, 12)}...\``;
    }

    text += `\n\n_argusarc.xyz | npx argus-scan@latest_`;
    bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
  } catch (e) {
    bot.sendMessage(msg.chat.id, '❌ Failed to fetch stats. Try again.');
  }
});

bot.onText(/\/scan (.+)/, async (msg, match) => {
  const address = (match[1] || '').trim();
  const chatId = msg.chat.id;

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return bot.sendMessage(chatId, '❌ Invalid address. Use format: /scan 0x...');
  }

  const statusMsg = await bot.sendMessage(chatId, `🔍 *Scanning ${address.slice(0, 10)}...*`, { parse_mode: 'Markdown' });

  try {
    // Ensure wallet
    let u;
    let isNewWallet = false;
    if (!users[chatId]) {
      u = await ensureWallet(chatId);
      isNewWallet = true;
    } else {
      u = users[chatId];
    }

    // Run scan
    const result = await apiPost('/scan/circle', {
      userId: u.userId,
      contractAddress: address,
      chain: 'arc',
    });

    if (!result || !result.result) {
      return bot.editMessageText('❌ No result from agents. Try again.', { chat_id: chatId, message_id: statusMsg.message_id });
    }

    const r = result.result;
    const v = r.verdict || 'UNKNOWN';
    const consensus = r.consensus || `${r.agreementCount}/${r.totalAgents}`;
    const agents = r.agents || [];
    const payment = result.payment || {};
    const agentNames = { 'Agent-α': 'α', 'Agent-β': 'β', 'Agent-γ': 'γ' };

    // Build response
    let text = '';

    // Wallet info
    if (isNewWallet) {
      text += `💳 *Wallet Created*\n\`${u.walletAddress}\`\n_Funded with 0.50 test USDC._\n\n`;
    } else {
      text += `💳 \`${u.walletAddress.slice(0, 12)}...\`\n\n`;
    }

    // Verdict
    text += `${verdictEmoji(v)} *VERDICT: ${v}*\n`;
    text += `Consensus: ${consensus}\n\n`;

    // Agent votes with confidence
    text += `*Agent Votes:*\n`;
    for (const a of agents) {
      const short = agentNames[a.name] || a.name;
      text += `${verdictEmoji(a.verdict)} Agent ${short}: *${a.verdict}* — ${a.confidence || '?'}% confidence\n`;
    }

    // Agent payments (if dissent)
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

    // Full reasoning (not summarized)
    text += `\n*Analysis:*\n`;
    for (const a of agents) {
      const short = agentNames[a.name] || a.name;
      const lines = (a.reasoning || '').split('\n').filter(Boolean);
      text += `\n${verdictEmoji(a.verdict)} *Agent ${short} — ${a.verdict}*\n`;
      for (const line of lines.slice(0, 3)) {
        text += `_${line.trim().slice(0, 200)}_\n`;
      }
    }

    // Footer with payment info
    text += `\n───────────────\n`;
    text += `💰 Paid: $0.01 USDC to treasury\n`;
    if (payment.txHash && payment.txHash !== 'null' && payment.txHash.startsWith('0x')) {
      text += `🔗 [View on ArcScan](https://testnet.arcscan.app/tx/${payment.txHash})\n`;
    }
    text += `⛓️ Settlement: ${r.settlementBatchId || 'n/a'}`;

    bot.editMessageText(text, { chat_id: chatId, message_id: statusMsg.message_id, parse_mode: 'Markdown', disable_web_page_preview: true });
  } catch (e) {
    bot.editMessageText(`❌ Scan failed: ${e.message?.slice(0, 100) || 'API unreachable'}`, { chat_id: chatId, message_id: statusMsg.message_id });
  }
});

// Catch-all
bot.on('message', (msg) => {
  if (msg.text && msg.text.startsWith('/')) {
    const known = ['/start', '/help', '/stats', '/scan', '/whoami'];
    if (!known.some((k) => msg.text.startsWith(k))) {
      bot.sendMessage(msg.chat.id, 'Unknown command. Try /help for available commands.');
    }
  }
});

console.log('🤖 Argus Telegram Bot is running...');
console.log('   /scan 0x... | /stats | /whoami | /help');
