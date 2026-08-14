// ─── Argus Telegram Bot ─────────────────────────────────
// Shared module: polls Telegram and serves /scan, /stats, /whoami.
// Used by the production entrypoint (index.ts) and the local
// dev entrypoint (web-index.ts). Self-contained: talks to the
// local HTTP API on the configured port with a remote fallback.
// ─────────────────────────────────────────────────────────

export function startTelegramBot(logger: any, apiPort: number) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    logger.info('TELEGRAM_BOT_TOKEN not set — bot disabled');
    return;
  }

  const API_BASE = `http://localhost:${apiPort}`;
  const users: Record<string, any> = {};

  // Fetch stats with timeout + remote fallback so the bot never hangs on local RPC stalls
  async function fetchJson(path: string): Promise<any> {
    const local = new AbortController();
    const timer = setTimeout(() => local.abort(), 8000);
    try {
      const res = await fetch(`${API_BASE}${path}`, { signal: local.signal });
      const data = await res.json();
      clearTimeout(timer);
      return data;
    } catch {
      clearTimeout(timer);
      // Fall back to the production API (works when local server is down or RPCs hang)
      const res = await fetch(`https://argus-web-backend-production.up.railway.app${path}`);
      return res.json();
    }
  }

  async function postJson(path: string, body: any): Promise<any> {
    const local = new AbortController();
    const timer = setTimeout(() => local.abort(), 30000);
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: local.signal,
      });
      const data = await res.json();
      clearTimeout(timer);
      return data;
    } catch {
      clearTimeout(timer);
      const res = await fetch(`https://argus-web-backend-production.up.railway.app${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return res.json();
    }
  }

  try {
    const TelegramBot = require('node-telegram-bot-api').default || require('node-telegram-bot-api');
    // Start polling directly — no webhook cleanup needed for fresh tokens
    const bot = new TelegramBot(token, {
      polling: { interval: 300, params: { timeout: 10 } },
      filepath: false,
    });
    setupHandlers(bot);
    logger.info('Telegram bot polling started');
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
        const data = await fetchJson('/treasury');
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
          const walletResp = await postJson('/wallet/assign', { userId });
          if (!walletResp.address) throw new Error('Wallet creation failed');
          u = { userId, walletAddress: walletResp.address };
          users[chatId] = u;
          isNewWallet = true;
        }

        const scanResp = await postJson('/scan/circle', { userId: u.userId, contractAddress: address, chain: 'arc' });

        if (!scanResp.result) throw new Error('No scan result');
        const r = scanResp.result;
        const payment = scanResp.payment || {};
        const agentNames: Record<string, string> = { 'Agent-α': 'α', 'Agent-β': 'β', 'Agent-γ': 'γ' };

        let text = '';
        if (isNewWallet) {
          text += `💳 *New Wallet Created*\n\`${u.walletAddress}\`\n_Funded with 0.10 test USDC._\n\n`;
        } else {
          text += `💳 \`${u.walletAddress}\`\n\n`;
        }

        const vEmoji = r.verdict === 'SAFE' ? '🟢' : r.verdict === 'RISKY' ? '🟡' : '🔴';
        text += `${vEmoji} *VERDICT: ${r.verdict}*\n`;
        text += `Consensus: ${r.consensus}\n\n`;

        text += `*Agent Votes:*\n`;
        for (const a of (r.agents || [])) {
          const short = agentNames[a.name] || a.name;
          const aEmoji = a.verdict === 'SAFE' ? '🟢' : a.verdict === 'RISKY' ? '🟡' : '🔴';
          text += `${aEmoji} Agent ${short}: *${a.verdict}* — ${a.confidence || '?'}% confidence`;
          if (a.riskScore != null) text += ` (risk: ${a.riskScore}/100)`;
          text += '\n';
        }

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

        text += `\n📋 *Analysis:*\n`;
        for (const a of (r.agents || [])) {
          const short = agentNames[a.name] || a.name;
          const aEmoji = a.verdict === 'SAFE' ? '🟢' : a.verdict === 'RISKY' ? '🟡' : '🔴';
          const reasoning = (a.reasoning || '').split('\n').filter((l: string) => l.trim());
          text += `\n${aEmoji} *Agent ${short} — ${a.verdict}*\n`;
          for (const line of reasoning.slice(0, 4)) {
            const trimmed = line.trim().slice(0, 250);
            if (trimmed) text += `_${trimmed}_\n`;
          }
        }

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
  }
}
