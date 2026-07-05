#!/usr/bin/env node

// ─── Argus CLI ───────────────────────────────────────────
// Multi-agent security oracle — scan any token address
// Usage: npx argus-scan 0x... | npx argus-scan stats
// ─────────────────────────────────────────────────────────

const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const API = 'argus-agent-production-ab97.up.railway.app';

// ─── Config ──────────────────────────────────────────────

const CONFIG_DIR = path.join(os.homedir(), '.argus');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
  } catch {}
  return null;
}

function saveConfig(cfg) {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
}

// ─── Wallet setup ────────────────────────────────────────

async function ensureWallet() {
  let cfg = loadConfig();

  // Already registered
  if (cfg && cfg.userId && cfg.walletAddress) {
    return cfg;
  }

  // First time — register a Circle wallet
  const userId = 'cli-' + crypto.randomBytes(8).toString('hex');
  process.stderr.write(`  First time setup — creating your wallet...\n`);

  let wallet;
  try {
    wallet = await apiPost('/wallet/assign', { userId });
  } catch (e) {
    throw new Error(`Failed to create wallet: ${e.message}`);
  }

  if (!wallet || !wallet.address) {
    throw new Error('Wallet creation returned no address.');
  }

  cfg = {
    userId,
    walletAddress: wallet.address,
    walletId: wallet.walletId || null,
    createdAt: new Date().toISOString(),
  };
  saveConfig(cfg);

  process.stderr.write(`  Wallet created: ${wallet.address.slice(0, 10)}...\n`);
  process.stderr.write(`  Funded with 0.50 test USDC (one-time)\n\n`);

  return cfg;
}

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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Spinner ─────────────────────────────────────────────

async function spinner(text, promise) {
  const frames = ['|', '/', '-', '\\'];
  let i = 0;
  const id = setInterval(() => {
    process.stderr.write(`\r  ${frames[i++ % frames.length]} ${text}    `);
  }, 80);
  try {
    const result = await promise;
    clearInterval(id);
    process.stderr.write(`\r  ${text} - done.\n`);
    return result;
  } catch (e) {
    clearInterval(id);
    process.stderr.write(`\r  ${text} - failed.\n`);
    throw e;
  }
}

// ─── Colors ──────────────────────────────────────────────

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  white: '\x1b[37m',
};

// ─── Banner ──────────────────────────────────────────────

const BANNER = `
${C.cyan}     █████╗ ██████╗  ██████╗ ██╗   ██╗███████╗${C.reset}
${C.cyan}    ██╔══██╗██╔══██╗██╔════╝ ██║   ██║██╔════╝${C.reset}
${C.cyan}    ███████║██████╔╝██║  ███╗██║   ██║███████╗${C.reset}
${C.cyan}    ██╔══██║██╔══██╗██║   ██║██║   ██║╚════██║${C.reset}
${C.cyan}    ██║  ██║██║  ██║╚██████╔╝╚██████╔╝███████║${C.reset}
${C.cyan}    ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝  ╚═════╝ ╚══════╝${C.reset}
${C.dim}       Three eyes. One verdict. — argusarc.xyz${C.reset}
`;

// ─── Verdict display ─────────────────────────────────────

function verdictColor(v) {
  if (v === 'SAFE') return C.green;
  if (v === 'RISKY') return C.yellow;
  return C.red;
}

function verdictBg(v) {
  if (v === 'SAFE') return C.bgGreen;
  if (v === 'RISKY') return C.bgYellow;
  return C.bgRed;
}

function riskMeter(score) {
  const bar = '█'.repeat(Math.round(score / 10)) + '░'.repeat(10 - Math.round(score / 10));
  const color = score < 30 ? C.green : score < 60 ? C.yellow : C.red;
  return `${color}${bar}${C.reset}`;
}

// ─── Commands ────────────────────────────────────────────

async function cmdScan(address, opts = {}) {
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    console.error(`${C.red}Error:${C.reset} Invalid Ethereum address. Must be 0x followed by 40 hex chars.`);
    process.exit(1);
  }

  // Ensure wallet is set up
  let cfg;
  try {
    cfg = await ensureWallet();
  } catch (e) {
    console.error(`${C.red}Error:${C.reset} ${e.message}`);
    process.exit(1);
  }

  // JSON mode — silent, no banner, no spinner
  if (opts.json) {
    try {
      const result = await apiPost('/scan/circle', {
        userId: cfg.userId,
        contractAddress: address,
        chain: 'arc',
      });
      console.log(JSON.stringify(result, null, 2));
    } catch (e) {
      console.error(JSON.stringify({ error: 'API unreachable', detail: e.message }));
      process.exit(1);
    }
    return;
  }

  console.log(BANNER);
  console.log(`${C.dim}  Wallet: ${cfg.walletAddress.slice(0, 10)}...  ·  Scanning ${address}...${C.reset}\n`);

  let result;
  try {
    result = await spinner('Agents analyzing...', apiPost('/scan/circle', {
      userId: cfg.userId,
      contractAddress: address,
      chain: 'arc',
    }));
  } catch (e) {
    console.error(`${C.red}Error:${C.reset} API unreachable — ${e.message}`);
    process.exit(1);
  }

  if (!result || !result.result) {
    console.error(`${C.red}Error:${C.reset} No result returned from API.`);
    process.exit(1);
  }

  const r = result.result;
  const v = r.verdict || 'UNKNOWN';
  const consensus = r.consensus || `${r.agreementCount}/${r.totalAgents}`;

  // Verdict card
  console.log(`  ${verdictBg(v)}${C.white}${C.bold}  VERDICT: ${v}  ${C.reset}  ${C.bold}Consensus: ${consensus}${C.reset}\n`);

  // Agent votes
  const agentNames = { 'Agent-α': 'α', 'Agent-β': 'β', 'Agent-γ': 'γ' };
  if (r.agents) {
    console.log(`  ${C.bold}Agent Votes:${C.reset}`);
    for (const a of r.agents) {
      const short = agentNames[a.name] || a.name;
      const vc = verdictColor(a.verdict);
      const confBar = '▓'.repeat(Math.round((a.confidence || 70) / 10)) + '░'.repeat(10 - Math.round((a.confidence || 70) / 10));
      console.log(`    ${C.bold}Agent ${short}${C.reset}  ${vc}${a.verdict}${C.reset}  ${C.dim}${confBar} ${a.confidence || '?'}%${C.reset}`);
    }
    console.log();
  }

  // Risk score
  const riskScore = r.riskScore || (v === 'SAFE' ? 15 : v === 'RISKY' ? 55 : 85);
  console.log(`  ${C.bold}Risk Score:${C.reset}  ${riskMeter(riskScore)} ${riskScore}/100\n`);

  // Agent reasoning
  if (r.agents) {
    console.log(`  ${C.bold}Analysis:${C.reset}`);
    for (const a of r.agents) {
      const short = agentNames[a.name] || a.name;
      const vc = verdictColor(a.verdict);
      console.log(`    ${C.bold}${vc}Agent ${short} — ${a.verdict}${C.reset}`);
      if (a.reasoning) {
        const lines = a.reasoning.split('\n').filter(Boolean);
        for (const line of lines.slice(0, 10)) {
          console.log(`      ${C.dim}${line.trim().slice(0, 200)}${C.reset}`);
        }
      }
      console.log();
    }
  }

  // Footer
  const payment = result.payment || {};
  const txHash = payment.txHash || null;
  console.log(`${C.dim}  ─────────────────────────────────────────────${C.reset}`);
  console.log(`${C.dim}  Paid: $0.01 USDC  ·  Treasury grew  ·  argusarc.xyz${C.reset}`);
  if (txHash) console.log(`${C.dim}  Tx: ${txHash.slice(0, 20)}...  ·  ArcScan${C.reset}`);
  console.log(`${C.dim}  Settlement: ${r.settlementBatchId || 'n/a'}${C.reset}\n`);
}

async function cmdStats() {
  console.log(BANNER);
  const cfg = loadConfig();

  let data;
  try {
    data = await spinner('Fetching stats...', apiGet('/treasury'));
  } catch (e) {
    console.error(`${C.red}Error:${C.reset} API unreachable — ${e.message}`);
    process.exit(1);
  }

  const s = data.stats || {};
  const t = data.treasury || {};

  console.log(`  ${C.bold}Argus Status${C.reset}\n`);
  console.log(`    ${C.bold}Scans:${C.reset}        ${s.queries || '?'}`);
  console.log(`    ${C.bold}Consensus:${C.reset}     ${s.consensusReached || '?'} (${s.avgConfidence || '?'}% avg confidence)`);
  console.log(`    ${C.bold}Treasury:${C.reset}      $${t.balance || '?'} USDC`);
  console.log(`    ${C.bold}On-chain:${C.reset}      ${s.onChainRecords || '?'} records`);
  console.log(`    ${C.bold}Network:${C.reset}       Arc testnet (5042002)`);
  if (cfg) {
    console.log(`\n  ${C.bold}Your Wallet${C.reset}`);
    console.log(`    ${C.bold}Address:${C.reset}      ${cfg.walletAddress}`);
    console.log(`    ${C.bold}User ID:${C.reset}       ${cfg.userId}`);
  }
  console.log(`\n  ${C.dim}Treasury: ${t.address}${C.reset}`);
  console.log(`  ${C.dim}Explorer: ${t.explorer || 'https://testnet.arcscan.app'}${C.reset}\n`);
}

async function cmdWhoami() {
  const cfg = loadConfig();
  if (!cfg) {
    console.log(`  No wallet found. Run a scan first to create one.`);
    return;
  }
  console.log(`  ${C.bold}Wallet:${C.reset}  ${cfg.walletAddress}`);
  console.log(`  ${C.bold}User ID:${C.reset} ${cfg.userId}`);
  console.log(`  ${C.bold}Created:${C.reset} ${cfg.createdAt || 'unknown'}`);
  console.log(`  ${C.dim}Config: ${CONFIG_FILE}${C.reset}\n`);
}

async function cmdShame() {
  console.log(BANNER);
  console.log(`  ${C.bold}Case Files${C.reset} — Investigation Archive\n`);
  console.log(`  ${C.dim}Open ${C.cyan}https://argusarc.xyz/shame${C.reset}${C.dim} for the full archive with evidence sources.${C.reset}\n`);
}

// ─── Main ────────────────────────────────────────────────

function isAddress(s) {
  return s && /^0x[a-fA-F0-9]{40}$/.test(s);
}

async function main() {
  const args = process.argv.slice(2);
  let command = args[0];

  // Auto-detect: if first arg looks like an address, default to scan
  if (isAddress(command)) {
    const json = args.includes('--json') || args.includes('-j');
    await cmdScan(command, { json });
    return;
  }

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    console.log(BANNER);
    console.log(`  ${C.bold}Usage:${C.reset}`);
    console.log(`    npx argus-scan <address>          Scan a token address`);
    console.log(`    npx argus-scan <address> --json   JSON output`);
    console.log(`    npx argus-scan stats              Live stats`);
    console.log(`    npx argus-scan whoami             Show your wallet`);
    console.log(`    npx argus-scan help               This help`);
    console.log(`\n  ${C.bold}Examples:${C.reset}`);
    console.log(`    npx argus-scan 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`);
    console.log(`    npx argus-scan 0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE --json`);
    console.log(`    npx argus-scan stats`);
    console.log(`\n  ${C.bold}Flow:${C.reset} First scan creates a Circle wallet + funds it. Every scan pays $0.01 USDC to treasury.`);
    console.log(`  ${C.dim}Live: https://argusarc.xyz  ·  npm: argus-scan${C.reset}\n`);
    return;
  }

  switch (command) {
    case 'scan': {
      const addr = args[1];
      const json = args.includes('--json') || args.includes('-j');
      await cmdScan(addr, { json });
      break;
    }
    case 'stats':
      await cmdStats();
      break;
    case 'whoami':
      await cmdWhoami();
      break;
    case 'shame':
      await cmdShame();
      break;
    default:
      console.error(`${C.red}Unknown command:${C.reset} ${command}`);
      console.error(`Run ${C.bold}npx argus help${C.reset} for usage.`);
      process.exit(1);
  }
}

main().catch((e) => {
  console.error(`${C.red}Fatal:${C.reset} ${e.message}`);
  process.exit(1);
});
