# Judge Guide — Argus

> **Build for a reviewer who will click around without you in the room.**
> — Lepton Agents Hackathon judging guidelines

This guide walks you through Argus in 5 minutes. Every step is verifiable on-chain. No setup required.

---

## Step 1: Open the App (30 seconds)

Go to **[argusarc.xyz](https://argusarc.xyz)**

You'll see a clean search bar. No wallet connect prompts. No signup wall.

---

## Step 2: Scan a Token (60 seconds)

Paste this address and hit enter:
```
0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
```

**What happens:**
- Three AI agents (DeepSeek-V3, Claude Sonnet 4.5, Rule Engine) analyze the token in parallel
- Each agent independently decides: SAFE, RISKY, or SCAM
- Each agent stakes USDC on its verdict
- 2/3 consensus required

**Expected result:** 🟢 SAFE — this is USDC. All three agents agree. You'll see:
- Verdict card with risk score
- Per-agent voting breakdown with confidence bars
- Full reasoning from each agent
- On-chain settlement batch ID

**Try a riskier one:**
```
0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE
```
🟡 RISKY — 2/3 consensus. Agent γ dissented — it paid 0.0005 USDC to each winning agent.

---

## Step 3: Explore Case Files (30 seconds)

Go to **[argusarc.xyz/shame](https://argusarc.xyz/shame)**

This is the investigation archive. 5 real projects analyzed with:
- Verdict with severity badge
- Full evidence sources (clickable, with agent attribution)
- Agent contributions breakdown
- Expandable findings

Click any card — it opens the full scan result at `/scan/:address`.

---

## Step 4: Try the CLI (60 seconds)

Open your terminal and run:

```bash
npx argus-scan@latest 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
```

**What happens:**
- First run auto-creates a Circle wallet (stored in `~/.argus/config.json`)
- Pays $0.01 USDC via Gateway x402 — real on-chain transaction
- Same 3-agent consensus as the web
- Full verdict card with agent votes, confidence bars, risk meter
- Agent payments shown when dissenters pay winners
- Paid footer with ArcScan link

**Other commands:**
```bash
npx argus-scan@latest stats        # Live treasury & scan numbers
npx argus-scan@latest whoami        # Your Circle wallet address
npx argus-scan@latest 0x... --json  # Pipe-friendly JSON output
```

📦 Published on npm: [npmjs.com/package/argus-scan](https://www.npmjs.com/package/argus-scan)

---

## Step 5: Try the Telegram Bot (30 seconds)

Open Telegram and go to **[t.me/argus_arc_bot](https://t.me/argus_arc_bot)**

Send:
```
/scan 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
```

**What happens:**
- Auto-creates a Circle wallet per Telegram user (one user, one wallet)
- Pays $0.01 USDC via Gateway x402
- Full verdict with agent votes, agent payments (if dissent), and full reasoning
- ArcScan link for the payment transaction

**Other commands:**
```
/stats   — Live treasury & scan numbers
/whoami  — Your Circle wallet address
/help    — All commands
```

---

## Step 6: Verify On-Chain (60 seconds)

Every scan is recorded on Arc. Here's how to verify independently:

### Treasury
[0x0699a029e2e05EC88d6418EC744232702Cf77d81](https://testnet.arcscan.app/address/0x0699a029e2e05EC88d6418EC744232702Cf77d81) — currently **$7.01 USDC** from 728+ paid scans.

### ArgusOracle (verdict log)
[0x563b2DA572948C2b54B5f1f26CcFebC153Cb46C8](https://testnet.arcscan.app/address/0x563b2DA572948C2b54B5f1f26CcFebC153Cb46C8) — immutable on-chain verdict log with ELO reputation settlement.

### Agent Wallets
| Agent | ArcScan |
|-------|---------|
| Agent α | [0x284e38...](https://testnet.arcscan.app/address/0x284e38e6f139b3b85c746e00f8a3cf46d2b2d320) |
| Agent β | [0x3f752a...](https://testnet.arcscan.app/address/0x3f752a72d8e2d9d3a4f2011ca9e0407bc5b7a34f) |
| Agent γ | [0x1fa79f...](https://testnet.arcscan.app/address/0x1fa79f59abbada269de477b45ded38c75a6146de) |

### Shadow Float V2 (cross-protocol)
All three agents hold on-chain credit lines on Shadow Float V2 with closed borrow-repay lifecycles:
- [Float V2 Contract](https://testnet.arcscan.app/address/0x20dcA96B0C487D94De885c726c956ffaF38b12C2)
- 4 on-chain lifecycles: Alpha, Beta, Gamma spend + Alpha CitePay

### Run the Verifier
```bash
bash verify.sh
```
34 automated checks against live contracts and endpoints.

---

## Step 7: Check the Numbers

| Metric | Value |
|--------|-------|
| Scans processed | 728 |
| Consensus reached | 689 (95%) |
| Users | 100+ across web, CLI, Telegram |
| Treasury | $7.01 USDC |
| Agent-to-agent payments | 100+ (0.05 USDC volume) |
| Circle primitives | 5/5 (Gateway x402, Agent Wallets, Dev-Controlled Wallets, Contracts, App Kit) |
| Shadow Float V2 | 3 agents + CitePay, 4 lifecycles |
| User sources | Web 113 · CLI 2 · Telegram 6 |

---

## What Makes Argus Different

1. **Real economic stakes** — agents stake USDC on verdicts. Losers pay winners. ELO reputation is on-chain, not a static score.

2. **Three independent models** — DeepSeek-V3, Claude Sonnet 4.5, and a deterministic rule engine. Not three calls to the same API.

3. **Real traction** — 100+ users, 728 paid scans, $7.01 treasury. All verifiable on ArcScan.

4. **Multi-surface** — web, CLI (`npx argus-scan`), Telegram (`t.me/argus_arc_bot`). Same consensus, different surfaces.

5. **Cross-protocol** — agents use Shadow Float V2 for on-chain credit. Gateway x402 for nanopayments. Circle for wallets. Three protocols, one agent economy.

---

## Quick Links

| Resource | URL |
|----------|-----|
| Live App | [argusarc.xyz](https://argusarc.xyz) |
| Case Files | [argusarc.xyz/shame](https://argusarc.xyz/shame) |
| CLI (npm) | [npmjs.com/package/argus-scan](https://www.npmjs.com/package/argus-scan) |
| Telegram | [t.me/argus_arc_bot](https://t.me/argus_arc_bot) |
| Demo Video | [youtube.com/shorts/GNrcgwZZx0Y](https://youtube.com/shorts/GNrcgwZZx0Y) |
| GitHub | [github.com/Gideon145/argus](https://github.com/Gideon145/argus) |
| X | [@Argus_arc](https://x.com/Argus_arc) |
| ArcScan (Treasury) | [0x0699...f77d81](https://testnet.arcscan.app/address/0x0699a029e2e05EC88d6418EC744232702Cf77d81) |

---

**Time to review:** ~5 minutes. **Everything is verifiable on-chain.** No API keys, no setup, no "trust us."
