# Argus

<p align="center">
  <a href="https://argusarc.xyz">
    <img src="https://img.shields.io/badge/LIVE-argusarc.xyz-3CB878?style=for-the-badge" alt="Live">
  </a>
  <a href="https://x.com/Argus_arc">
    <img src="https://img.shields.io/badge/X-@Argus__arc-1DA1F2?style=for-the-badge&logo=x&logoColor=white" alt="X">
  </a>
  <a href="https://testnet.arcscan.app/address/0x0699a029e2e05EC88d6418EC744232702Cf77d81">
    <img src="https://img.shields.io/badge/Treasury-ArcScan-6C5CE7?style=for-the-badge" alt="Treasury">
  </a>
  <a href="https://testnet.arcscan.app/address/0x4Dd5e289168ddb28f9b34134EAbccAF373eb64Cb">
    <img src="https://img.shields.io/badge/Funding-ArcScan-F0A030?style=for-the-badge" alt="Funding">
  </a>
  <a href="https://testnet.arcscan.app/address/0x563b2DA572948C2b54B5f1f26CcFebC153Cb46C8">
    <img src="https://img.shields.io/badge/Oracle-ArcScan-6C5CE7?style=for-the-badge" alt="Oracle">
  </a>
  <br>
  <a href="https://testnet.arcscan.app/address/0x284e38e6f139b3b85c746e00f8a3cf46d2b2d320">
    <img src="https://img.shields.io/badge/Agent_α-ArcScan-7eb8da?style=flat-square" alt="Agent α">
  </a>
  <a href="https://testnet.arcscan.app/address/0x3f752a72d8e2d9d3a4f2011ca9e0407bc5b7a34f">
    <img src="https://img.shields.io/badge/Agent_β-ArcScan-D4AF37?style=flat-square" alt="Agent β">
  </a>
  <a href="https://testnet.arcscan.app/address/0x1fa79f59abbada269de477b45ded38c75a6146de">
    <img src="https://img.shields.io/badge/Agent_γ-ArcScan-b57ed8?style=flat-square" alt="Agent γ">
  </a>
</p>

**Τρεις οφθαλμοί. Μια κρίσις.** — Three eyes. One verdict.

Multi-agent security consensus oracle on Arc. Three independent AI agents analyze token contracts, stake real USDC on their verdicts, and reach 2/3 consensus. Every scan costs $0.01. Every verdict is immutable on-chain. Agents pay each other when they disagree.

> Built for the [Lepton Agents Hackathon](https://lepton.thecanteenapp.com/) (Jun 15–29, 2026) — Canteen × Circle × Arc
> 
> **Stack:** 3/5 Circle primitives · 3 AI models · $0.01 nanopayments · Autonomous agent economy
> 
> **Live:** [argusarc.xyz](https://argusarc.xyz) · **Demo:** [youtube.com/shorts/a4Mn7s_OKoU](https://youtube.com/shorts/a4Mn7s_OKoU) · **X:** [@Argus_arc](https://x.com/Argus_arc)

> **Stack:** 3/5 Circle primitives · 3 AI models · $0.01 nanopayments · Autonomous agent economy
> 📂 **[ARCHITECTURE.md](ARCHITECTURE.md)** — Full system design, data flows, payment architecture
> 🔧 **[ENGINEERING_DEBUG_LOG.md](ENGINEERING_DEBUG_LOG.md)** — 6 real bugs encountered and solved during the build

---

## Why This Exists

Token scams and malicious contracts drain billions annually. Audits cost $5K–$50K and take weeks. The people who need security most — retail traders, small DAOs, memecoin communities — can't access it.

Nanopayments change the equation. When a payment can be $0.01, settled in under half a second with gasless batching on Arc, a security check becomes cheaper than the coffee you drank while reading about the token. The lepton was the smallest coin in the Greek world — a hundredth of a drachma. Gateway nanopayments are the lepton reborn for machines: value as small as $0.000001, clearing in under 500ms.

**Argus makes contract security a nanopayment-native primitive.** Three AI agents — not one, not a wrapper around a single API call — independently analyze every contract. They stake real USDC on their verdicts. They reach consensus. They earn reputation when they're right and lose it when they're wrong. And now, they pay each other.

---

## How It Works

```
User submits a token address
  │
  ▼
┌─────────────────────────────┐
│  Payment: $0.01 USDC          │  ← Gateway x402 nanopayment OR Circle wallet scan
│  (MetaMask or instant wallet) │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│  Orchestrator                │  ← Fans out to 3 agents in parallel
└────┬──────────┬──────────┬───┘
     │          │          │
     ▼          ▼          ▼
┌─────────┐ ┌─────────┐ ┌──────────┐
│ Agent α  │ │ Agent β  │ │ Agent γ   │
│ DeepSeek │ │ Claude   │ │ Rule      │
│ V3       │ │ Sonnet 4 │ │ Engine    │
│          │ │          │ │           │
│ Contract │ │ Tokenomics│ │ Determin.  │
│ logic    │ │ holders  │ │ patterns  │
│ proxies  │ │ liquidity│ │ signatures│
│ access   │ │ whales   │ │ bytecode  │
└────┬────┘ └────┬────┘ └────┬─────┘
     │          │          │
     └──────────┼──────────┘
                ▼
┌─────────────────────────────┐
│  Consensus (2/3 threshold)   │
│  Agents stake USDC on verdict│
└────────────┬────────────────┘
             │
     ┌───────┴───────┐
     ▼               ▼
┌──────────────┐  ┌──────────────────┐
│ ELO updated   │  │ Agent-to-Agent    │
│ Reputation    │  │ Nanopayments      │
│ (persisted)   │  │ Loser pays winners│
└──────────────┘  │ 0.001 USDC each   │
                  └──────────────────┘
             │
             ▼
┌─────────────────────────────┐
│  ArgusOracle (Arc testnet)   │  ← Immutable verdict log
│  0x563b2DA572...C153Cb46C8   │
└─────────────────────────────┘
```

Arc's Malachite BFT consensus provides deterministic sub-second finality with zero reorg risk. Argus verdicts settle on the same finality guarantee — once a consensus result is recorded, it's immutable. No waiting for confirmations. No probabilistic uncertainty. The payment clears and the verdict stands.

---

## The Three Agents

| Agent | Model | Role | Cost per scan |
|-------|-------|------|---------------|
| **Agent α** | DeepSeek-V3 | Contract-level security: ownership, proxies, honeypots, access control, upgradeability, external calls | ~$0.001 |
| **Agent β** | Claude Sonnet 4.5 | Tokenomics & market structure: holder distribution, whale concentration, LP depth, trading patterns, buy/sell taxes, wash trading | ~$0.002 |
| **Agent γ** | Rule Engine (local) | Deterministic checks: address entropy, digit-run heuristics, known scam deployer patterns, EIP-55 checksum validation, blacklist matching | $0 (no API) |

Each agent operates independently — no shared state, no prompt leakage between models. Agent γ is deterministic and reproducible; run the same address twice, get the same result. Agents α and β bring deep reasoning from different model families (DeepSeek and Anthropic), creating genuine cognitive diversity in the consensus.

**Why three agents?** Because single-model security scanners are fundamentally trusting one API's opinion. Argus requires disagreement to surface. When Agent β (the tokenomics skeptic) and Agent γ (the pattern matcher) both flag a contract as RISKY while Agent α calls it SAFE, the consensus mechanism surfaces the split — and the user sees exactly why each agent voted the way it did, with full reasoning.

---

## Circle/Arc Stack

Argus integrates 3 of the 5 Circle developer primitives, with the remaining 2 in active development:

| Primitive | Status | How Argus Uses It |
|-----------|--------|-------------------|
| **Gateway x402** | ✅ Live | $0.01 USDC nanopayment paywall on every scan. Gasless batched settlement. |
| **Agent Wallets** | ✅ Live | Three autonomous Circle SCAs — one per agent. Each stakes USDC on verdicts independently. |
| **Dev-Controlled Wallets** | ✅ Live | Pre-created wallet pool. Users get instant SCA wallets — no MetaMask, no extension. 50 wallets, auto-refill. |
| **Contracts** | 🚧 Planned | On-chain ELO reputation via ArgusOracle. Immutable verdict log already deployed. |
| **App Kit** | 🚧 Planned | Unified Balance for chain-abstracted payments. CCTP for cross-chain USDC settlement. |

Every scan result is verifiable on-chain. Treasury, funding wallet, agent wallets, and oracle — all publicly auditable on ArcScan.

---

## Agent-to-Agent Nanopayments (RFB 3)

Since v0.6, Argus agents run an internal economy. After every scan where consensus is reached but not unanimous:

- The **losing agent** pays **0.001 USDC** to each winning agent
- Settled on-chain via native USDC transfers on Arc
- Creates a real economic incentive: agents that consistently agree with consensus accumulate USDC; dissenters bleed

This directly implements [Prior Art #08](https://lepton.thecanteenapp.com/#priorart) from the Lepton brief: *"Reputation you post as collateral, not a score you ask to be trusted."* The banker staked his own standing on the coin he vouched for — the trapezitai and argentarii. Argus agents do the same, in real time, on-chain, per decision.

```
Agent γ votes SAFE. Agents α and β vote RISKY.
Consensus: 2/3 → RISKY. Agent γ is the loser.

Agent γ → Agent α: 0.0005 USDC ✓
Agent γ → Agent β: 0.0005 USDC ✓

Total agent economy volume visible at /agent-payments
```

This hits RFB 3 (Agent-to-Agent Nanopayment Networks) directly. It also touches RFB 1 (Autonomous Paying Agents — agents decide when to pay based on consensus outcome) and the reputation-as-collateral thesis that runs through the entire Lepton design brief.

---

## No MetaMask Required

The biggest onboarding unlock. Since v0.6:

1. User visits [argusarc.xyz](https://argusarc.xyz)
2. Clicks **"Get Started"**
3. Backend assigns a pre-created Circle SCA wallet instantly
4. Funding wallet sends $0.50 test USDC
5. User pastes a token address and scans — 30 seconds, no extension, works on mobile

MetaMask remains available as a secondary option. But the primary path requires nothing but a browser.

---

## Live Verification

```bash
# Agent health
curl https://argus-agent-production-ab97.up.railway.app/health

# Current stats (340+ scans, 89% avg confidence)
curl https://argus-agent-production-ab97.up.railway.app/stats | jq .

# ELO leaderboard
curl https://argus-agent-production-ab97.up.railway.app/elo | jq .

# Agent-to-agent payment history
curl https://argus-agent-production-ab97.up.railway.app/agent-payments | jq .

# Treasury balance (on-chain)
curl https://argus-agent-production-ab97.up.railway.app/treasury | jq .

# Wallet pool stats
curl https://argus-agent-production-ab97.up.railway.app/wallet/pool-stats | jq .
```

**All addresses are public and verifiable on ArcScan:**

| Wallet | Address | ArcScan |
|--------|---------|---------|
| Treasury | `0x0699a029e2e05EC88d6418EC744232702Cf77d81` | [View](https://testnet.arcscan.app/address/0x0699a029e2e05EC88d6418EC744232702Cf77d81) |
| Funding | `0x4Dd5e289168ddb28f9b34134EAbccAF373eb64Cb` | [View](https://testnet.arcscan.app/address/0x4Dd5e289168ddb28f9b34134EAbccAF373eb64Cb) |
| ArgusOracle | `0x563b2DA572948C2b54B5f1f26CcFebC153Cb46C8` | [View](https://testnet.arcscan.app/address/0x563b2DA572948C2b54B5f1f26CcFebC153Cb46C8) |
| Agent α (SCA) | `0x284e38e6f139b3b85c746e00f8a3cf46d2b2d320` | [View](https://testnet.arcscan.app/address/0x284e38e6f139b3b85c746e00f8a3cf46d2b2d320) |
| Agent β (SCA) | `0x3f752a72d8e2d9d3a4f2011ca9e0407bc5b7a34f` | [View](https://testnet.arcscan.app/address/0x3f752a72d8e2d9d3a4f2011ca9e0407bc5b7a34f) |
| Agent γ (SCA) | `0x1fa79f59abbada269de477b45ded38c75a6146de` | [View](https://testnet.arcscan.app/address/0x1fa79f59abbada269de477b45ded38c75a6146de) |

---

## Smart Contracts

### ArgusOracle.sol

Address: `0x563b2DA572948C2b54B5f1f26CcFebC153Cb46C8` on Arc testnet (chain 5042002)

Immutable verdict log. Every consensus result is recorded with:
- Contract address analyzed
- Final verdict (SAFE / RISKY / SCAM)
- Consensus breakdown (which agents agreed/dissented)
- Timestamp and query ID
- Settlement batch reference

Deployed with Solidity 0.8.28 via IR pipeline. Minimal, auditable, gas-optimized for Arc's native USDC fee model.

---

## What Makes This Different

Most security tools are single-model wrappers. Argus:

1. **Runs genuine multi-agent consensus** — three independent AI models, not three calls to the same API with different prompts. DeepSeek-V3, Claude Sonnet 4.5, and a deterministic rule engine produce genuinely diverse reasoning.

2. **Has real economic stakes** — agents stake USDC on verdicts. Losing agents pay winning agents. ELO reputation is proper pairwise math, not a static score.

3. **Ships real payments, not mockups** — $0.01 USDC flows through Gateway x402. Treasury is verifiable on-chain. 5+ paying users. Agent-to-agent economy is live.

4. **Works without a wallet** — Circle pre-create wallets remove the single biggest onboarding barrier. No MetaMask. No extension. Works on mobile.

5. **Is publicly verifiable** — every address, every transaction, every verdict is on ArcScan. Judges can verify everything independently without running the code.

6. **Builds on the Canteen thesis** — Argus is a security sidecar for any token launch, any contract interaction. The Distribution Bootstrap for Payments Founders sketches eight patterns for attaching payments to existing communities. Argus attaches security to the community that already exists: token traders, DAO members, and anyone who's ever asked "is this token safe?"

---

## Daily Log

*Built for the [Lepton Agents Hackathon](https://lepton.thecanteenapp.com/) (Jun 15–29, 2026) — Canteen × Circle × Arc*

| Day | Date | Shipped |
|-----|------|---------|
| 1 | Jun 15 | Scaffold: agent, contracts, frontend. ARC CLI setup. |
| 2 | Jun 16 | 3-agent pipeline live (DeepSeek + Claude + rules). Consensus + ELO working. ArgusOracle deployed on Arc testnet. Gateway x402 wired. Per-agent reasoning in responses. v0.1 submitted. |
| 3 | Jun 17 | Circle Agent Wallets created for all 3 agents (0x284e...a320, 0x3f75...a34f, 0x1fa7...46de). Circle CLI authenticated. Stack now 2/5 Circle primitives. |
| 4 | Jun 18 | v0.3 — live at argusarc.xyz (Vercel + custom domain + SSL). Agent on Railway with persistent volume-backed store. Server-side global stats + scan history. Premium dark UI — real data, no mockups. Per-agent check indicators, performance tracking, analysis history table. Free scans for first 24h. X launch thread. Build shared in Canteen Discord. 5+ test scans producing accurate differentiated verdicts. Google form v0.3 submitted. |
| 5 | Jun 19 | v0.4 — paid scans + auto-funding pipeline. Real MetaMask tx confirmation ($0.01 USDC), payment verified on-chain before scan runs. Auto-funding: connect wallet → agent sends $0.50 test USDC → zero faucet friction. Two-wallet architecture (funding + treasury). Fixed Arc chain ID hex (0x4CE902 → 0x4CEF52). 70+ real scans in first 24h. Agent performance: DeepSeek-V3 100%, Claude Sonnet 4.5 61%, Rule Engine 70%. X post with stats published. Google form v0.4 + CLI submitted. |
| 6 | Jun 20 | v0.5 — ELO scoring fixed (was static 0.5 expected score, now proper pairwise math against other agents, persisted to disk, survives redeploys). Stats bug fixed (avgConfidence was 100% computing consensus rate, now 92% real average across 332 scans). Agent γ overhauled (entropy detection, digit-run heuristics, calibrated confidence). First 5 paying users verified on-chain. Scoreboard: γ 1384/100%, β 1333/83%, α 1281/67%. Google form v0.5 + CLI submitted. |
| 7 | Jun 21 | v0.6 — Circle pre-create wallets: users click "Get Started", instant Circle SCA wallet, auto-funded $0.50, no MetaMask needed, works on mobile. 50-wallet pool with auto-refill. Agent-to-agent nanopayments live: losing agent pays winners 0.001 USDC on-chain per scan (RFB 3). Circle scans now pay $0.01 to treasury via funding wallet. 3/5 Circle primitives integrated (Dev-Controlled Wallets + Gateway x402 + Agent Wallets). 340+ scans. Demo: youtube.com/shorts/a4Mn7s_OKoU. Google form v0.6 + CLI submitted. |

---

## Quick Start

```bash
# Agent
cd agent && npm install && npm run dev

# Frontend
cd frontend && npm install && npm run dev

# Contracts
cd contracts && npm install && npx hardhat compile
```

---

## Team

| | |
|---|---|
| **Gideon** | Full-stack engineer, smart contracts, agent architecture, AI pipeline |
| **Jazreel** | Product, distribution, community |

---

## License

MIT

---

<p align="center">
  <b>Building in public — follow along</b><br>
  <a href="https://x.com/Argus_arc">x.com/Argus_arc</a> · <a href="https://argusarc.xyz">argusarc.xyz</a> · <a href="https://github.com/Gideon145/argus">github.com/Gideon145/argus</a>
</p>
