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
  <a href="https://www.npmjs.com/package/argus-scan">
    <img src="https://img.shields.io/npm/dw/argus-scan" alt="npm downloads">
  </a>
</p>

**Τρεις οφθαλμοί. Μια κρίσις.** — Three eyes. One verdict.

![Argus scan verdict](docs/media/scan-result.png)

> **Don't get rugged.** Paste any token address — on web, CLI, or Telegram. Two AI agents (DeepSeek-V3, Claude Sonnet 4.5) plus a deterministic rule engine analyze it from different angles. Each stakes real money on its verdict. If 2 out of 3 agree, you get a clear answer: SAFE, RISKY, or SCAM — with full reasoning from every agent.
>
> No MetaMask required. Works on mobile. Costs $0.01 per scan. Every verdict recorded on-chain forever.

| **806 scans** | **$7.93 treasury** | **125 users** | **5/5 Circle primitives** |
|---|---|---|---|

**Live:** [argusarc.xyz](https://argusarc.xyz) · **Telegram:** [t.me/argus_arc_bot](https://t.me/argus_arc_bot) · **CLI:** `npx argus-scan@latest` · **X:** [@Argus_arc](https://x.com/Argus_arc) · **Demo:** [youtube.com/shorts/GNrcgwZZx0Y](https://youtube.com/shorts/GNrcgwZZx0Y)

---

## Contents

- [Why This Exists](#why-this-exists)
- [How It Works](#how-it-works)
- [Why Arc](#why-arc)
- [The Three Agents](#the-three-agents)
- [Circle/Arc Stack](#circlearc-stack)
- [Shadow Float V2](#shadow-float-v2--agent-credit-lines)
- [Agent-to-Agent Nanopayments](#agent-to-agent-nanopayments-rfb-3)
- [No MetaMask Required](#no-metamask-required)
- [CLI: Scan from Your Terminal](#cli-scan-from-your-terminal)
- [Telegram: Scan from Any Chat](#telegram-scan-from-any-chat)
- [Live Verification](#live-verification)
- [Smart Contracts](#smart-contracts)
- [What Makes This Different](#what-makes-this-different)
- [What's Next](#whats-next)
- [Honest Limits](#honest-limits)
- [Traction](#traction)
- [Quick Start](#quick-start)
- [Team](#team)

**Supplemental docs:**
- 📂 [ARCHITECTURE.md](ARCHITECTURE.md) — Full system design, data flows, payment architecture
- 🔧 [ENGINEERING_DEBUG_LOG.md](ENGINEERING_DEBUG_LOG.md) — 6 real bugs encountered and solved
- 🤖 [AGENTS.md](AGENTS.md) — How any AI agent can plug into Argus
- 📋 [JUDGE_GUIDE.md](JUDGE_GUIDE.md) — 5-minute review walkthrough for judges
- ✅ [verify.sh](verify.sh) — 34-check end-to-end verifier

---

## Why This Exists

Token scams and malicious contracts drain billions annually. Audits cost $5K–$50K and take weeks. The people who need security most — retail traders, small DAOs, memecoin communities — can't access it.

Nanopayments change the equation. When a payment can be $0.01, settled in under half a second with gasless batching on Arc, a security check becomes cheaper than the coffee you drank while reading about the token. The lepton was the smallest coin in the Greek world — a hundredth of a drachma. Gateway nanopayments are the lepton reborn for machines: value as small as $0.000001, clearing in under 500ms.

**Argus makes contract security a nanopayment-native primitive.** Three AI agents — not one, not a wrapper around a single API call — independently analyze every contract. They stake real USDC on their verdicts. They reach consensus. They earn reputation when they're right and lose it when they're wrong. And now, they pay each other.

> *"The hard part of a payments product was never the rail. It was finding the people."* — Canteen, The Distribution Bootstrap

**Argus is a Distribution Bootstrap security sidecar.** No SDK. No integration. No API key. Any token launch, any DAO, any trader can call Argus for $0.01. Paste an address, get a verdict. The users are already here — they just need a security layer that costs less than the coffee they drank while reading about the token.

**Built for everyone.** Connect with MetaMask and get auto-funded, or click "Get Started" on mobile — Circle wallet created instantly. No signup. No email. Just paste a token address and get a security verdict from three independent AI agents. Web, CLI, or Telegram — same consensus, your choice.

> We didn't just build a website. We built three ways to reach the same truth — three independent AI agents, staking real USDC on every verdict, paying each other when they disagree. Web, CLI, Telegram. Pick your surface. Same consensus.
>
> The third eye is the tiebreaker. Always has been.

---

## How It Works

```mermaid
flowchart TB
    U[User] -->|$0.01 USDC| GW[Gateway x402]
    U -->|paste address| WEB[Web - argusarc.xyz]
    U -->|npx| CLI[CLI - npx argus-scan]
    U -->|/scan| TG[Telegram - t.me/argus_arc_bot]

    WEB --> O[Orchestrator]
    CLI --> O
    TG --> O

    O -->|fan out| A[Agent Alpha - DeepSeek-V3 - Contract logic]
    O -->|fan out| B[Agent Beta - Claude Sonnet 4.5 - Tokenomics]
    O -->|fan out| G[Agent Gamma - Rule Engine - Deterministic]

    A -->|verdict + stake| C[Consensus - 2/3 threshold]
    B -->|verdict + stake| C
    G -->|verdict + stake| C

    C -->|SAFE / RISKY / SCAM| R[Verdict]
    C -->|dissenters pay winners| P[Agent Payments - 0.0005 USDC each]
    C -->|record verdict| ORA[ArgusOracle - on-chain]

    GW -->|$0.01 fee| TR[Treasury]
    GW -->|fund wallets| W[Circle Wallets]
```

Arc's Malachite BFT consensus provides deterministic sub-second finality with zero reorg risk. Argus verdicts settle on the same finality guarantee — once a consensus result is recorded, it's immutable. No waiting for confirmations. No probabilistic uncertainty. The payment clears and the verdict stands.

---

## Why Arc

Argus could only exist on Arc:

- **Native USDC gas** — $0.01 scans, no volatile gas token, no fee surprise
- **Malachite BFT finality** — verdict and agent payment settle in the same sub-second instant
- **Gateway x402** — 100+ agent payments cleared at zero gas cost to users via gasless batching
- **Cross-protocol composability** — agents use Shadow Float V2 for on-chain credit on the same chain
- **5/5 Circle primitives** — Gateway, Agent Wallets, Dev-Controlled Wallets, Contracts, App Kit — each solves a problem that would otherwise need external infra

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

> **How payments work:** For Circle "Get Started" users (no MetaMask), the funding wallet covers the $0.01 scan fee and sends it to treasury. This is why all treasury transactions appear from a single address — it's the funding wallet paying on behalf of users who onboarded via one-click Circle wallets. MetaMask users pay directly from their own wallet. Every transaction is verifiable on ArcScan.

Argus integrates all 5 Circle developer primitives:

| Primitive | Status | How Argus Uses It |
|-----------|--------|-------------------|
| **Gateway x402** | ✅ Live | $0.01 USDC nanopayment paywall on every scan. Gasless batched settlement. |
| **Agent Wallets** | ✅ Live | Three autonomous Circle SCAs — one per agent. Each stakes USDC on verdicts independently. |
| **Dev-Controlled Wallets** | ✅ Live | Pre-created wallet pool. Users get instant SCA wallets — no MetaMask, no extension. 100+ wallets, auto-refill. |
| **Contracts** | ✅ Live | On-chain ELO reputation via ArgusOracle. Immutable verdict log + ELO scores written to Arc after every scan. |
| **App Kit** | ✅ Live | Unified Balance — chain-abstracted USDC balance API. All 5 Circle primitives fully integrated. |

Every scan result is verifiable on-chain. Treasury, funding wallet, agent wallets, and oracle — all publicly auditable on ArcScan.

---

## Shadow Float V2 — Agent Credit Lines

All three Argus agents have on-chain credit lines via [Shadow Float V2](https://testnet.arcscan.app/address/0x20dcA96B0C487D94De885c726c956ffaF38b12C2) on Arc. Each agent signs EIP-712 FloatSpendIntents, borrows USDC from Shadow's sponsor reserve, and repays after the scan cycle — a full autonomous credit lifecycle with no human intervention.

| Agent | Borrow | Repay | ArcScan |
|-------|--------|-------|---------|
| **Agent α** (`0x5c0b33`) | `0x50831f...53aa2c` | `0x4ae592...0bf896` | [Borrow](https://testnet.arcscan.app/tx/0x50831fd00ef83a2c5fdb5bd5829ac6800c783aa34ec2149eb92c1bb38553aa2c) · [Repay](https://testnet.arcscan.app/tx/0x4ae5922841cb91b090e2785e26b94789a9c4028340bea5c162106657280bf896) |
| **Agent β** (`0x7D4897`) | `0x03d67f...a9ba9` | `0xac1b0d...97d679` | [Borrow](https://testnet.arcscan.app/tx/0x03d67f3f911abda8e862700787f33d5ad7002e49a6fd989172dfbca5d6aa9ba9) · [Repay](https://testnet.arcscan.app/tx/0xac1b0d231b0d19ebcb8e18877e7fcffbb2cbf990f204f648c288053bb597d679) |
| **Agent γ** (`0x43e063`) | `0x49acee...dc33e` | `0xad8301...bb1682` | [Borrow](https://testnet.arcscan.app/tx/0x49aceee516b7eb037c9b475cdf9f238335eea9975c2102731b05826c6a0dc33e) · [Repay](https://testnet.arcscan.app/tx/0xad8301ca4edbbed18bc7204d8da9be53492116649a326728ad0ca5bc19bb1682) |

**Why this matters:** Autonomous agents need autonomous capital. Shadow Float V2 gives each agent a sponsor-backed credit line — they borrow to cover x402 data costs, produce verdicts, then repay from earnings. Six on-chain transactions, all verified. Full lifecycle: sign → bind → spend → approve → repay. No private keys exposed to the credit protocol — only EIP-712 signed intents.

This is cross-protocol agent infrastructure on Arc: Argus agents using Shadow Float for credit, Circle for wallets, and Gateway x402 for nanopayments — three protocols, one autonomous agent economy.

---

## Agent Prompts

All three agent system prompts are open source: [`agent/src/agents/`](agent/src/agents/). See [`AGENTS.md`](AGENTS.md) for how to plug any AI agent into Argus.

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

> **[Prior Art #08](https://lepton.thecanteenapp.com/#priorart): Reputation you post as collateral, not a score you ask to be trusted.**
>
> *"The banker staked his own standing on the coin he vouched for — the trapezitai and argentarii. A broker agent posts a USDC bond to stand behind a match, and if the provider underdelivers, the bond slashes automatically. Reputation becomes capital at risk rather than a number you have to believe, which is far harder to fake."*
>
> Argus agents do exactly this — in real time, on-chain, per decision. Every dissent costs 0.0005 USDC. Every wrong verdict drops ELO. No trust required. The stakes are public. The slash is automatic. This is Prior Art #08, live on Arc.

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

# Current stats (648 scans, 95% consensus rate)
curl https://argus-agent-production-ab97.up.railway.app/stats | jq .

# ELO leaderboard
curl https://argus-agent-production-ab97.up.railway.app/elo | jq .

# Agent-to-agent payment history
curl https://argus-agent-production-ab97.up.railway.app/agent-payments | jq .

# Treasury balance (on-chain)
curl https://argus-agent-production-ab97.up.railway.app/treasury | jq .

# Wallet pool stats
curl https://argus-agent-production-ab97.up.railway.app/wallet/pool-stats | jq .

# App Kit Unified Balance (5/5 Circle primitives)
curl https://argus-agent-production-ab97.up.railway.app/balance/unified/0x0699a029e2e05EC88d6418EC744232702Cf77d81 | jq .
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

6. **Builds on the Canteen thesis** — The Distribution Bootstrap sketches eight sidecars for attaching payments to existing communities. Argus is one of them: a security sidecar that any token launch, any DAO, any trader can call for $0.01. No integration required. No SDK. Just an address.

---

## What's Next

| Phase | What | Status |
|-------|------|--------|
| **v0.1–v0.8** | Core oracle, paid scans, ELO, agent economy, Circle wallets, App Kit | ✅ Shipped (Jun 15–23) |
| **v0.9** | UI redesign, Case Files archive, shareable scan links, Gamma rework, evidence sources, agent contributions, risk scores | ✅ Shipped (Jun 24–25) |
| **v0.10** | CLI tool (`npx argus-scan`), retention features, polish | ✅ Shipped (Jun 29) |
| **v0.11** | Telegram bot (`t.me/argus_arc_bot`) — third surface, multi-platform reach | ✅ Shipped (Jul 1) |
| **v0.12** | Scan history per user, agent accuracy trends, public ELO leaderboard | Post-hackathon |
| **v0.13** | Agent β on-chain upgrade — real-time holder queries, DEX liquidity data | Post-hackathon |
| **v0.14** | Circle W3S migration — Programmable Wallets, no raw private keys in env | Post-hackathon |
| **v1.0** | Arc mainnet deployment — real USDC, real stakes, production oracle | Post-hackathon |

---

## Honest Limits

*What Argus does NOT claim — and what's planned.*

| Limit | Status |
|-------|--------|
| **Agent analysis is AI-inferred, not on-chain bytecode audit** | Agents use training knowledge + pattern matching. They cannot decompile or verify deployed bytecode. For well-known contracts this is reliable; for obscure tokens, treat as a strong signal, not a guarantee. |
| **Private keys in environment variables** | Agent wallets use raw private keys for signing (RFB 3 payments + ELO writes). A planned upgrade migrates to Circle W3S Programmable Wallets (like Mimir's approach) so no key material sits in worker processes. Implementation path: provision W3S wallets → replace `privateKeyToAccount` with `executeContract(...)` via Circle W3S API → remove all ARGENT_*_PRIVATE_KEY env vars. Estimated: 2-3 hours of focused work. |
| **Holder distribution + liquidity are estimated** | Agent β infers tokenomics from training data — it does not query holder snapshots or DEX liquidity pools in real-time. Production upgrade: integrate on-chain balanceOf queries + DexScreener/GeckoTerminal APIs. |
| **Arc testnet only** | All USDC is testnet. No real value at risk. Mainnet deployment requires Circle production access + real USDC liquidity. |
| **Single oracle address** | ArgusOracle.sol has one owner. Multi-sig or DAO-governed upgrade is planned for mainnet. |

---

## Accuracy Evaluation

*Benchmark pending — 40 labeled tokens, 3-agent pipeline. Run: `npx tsx benchmark/run-benchmark.ts`*

---

## Traction

*Real usage on Arc testnet. Every number is verifiable on-chain.*

| Metric | Value | Proof |
|--------|-------|-------|
| **Scans processed** | 806 | `/stats` endpoint · on-chain records |
| **Consensus reached** | 759 (94%) | 3-agent pipeline live since Jun 16 |
| **Users** | 125 | Web (114) · CLI (2) · Telegram (9) |
| **Treasury balance** | $7.93 USDC | [ArcScan](https://testnet.arcscan.app/address/0x0699a029e2e05EC88d6418EC744232702Cf77d81) |
| **Agent economy volume** | 100+ payments | Losers pay winners 0.0005 USDC per dissent |
| **ELO leaderboard** | α 91% · β 83% · γ 72% | `/elo` endpoint · on-chain |
| **Circle primitives** | 5/5 | Gateway x402 · Agent Wallets · Dev-Controlled Wallets · Contracts · App Kit |
| **Shadow Float V2** | 3 agents + CitePay | 4 on-chain lifecycles closed · cross-protocol on Arc |

### Where Users Come From

```
Web    ████████████████████████████████████████████████████ 114
CLI    █ 2
TG     ████ 9
       ─────────────────────────────────────────────────────
       Total: 125 assigned wallets
```

Web is the primary surface. Telegram growing from the bot launch. CLI just launched — dev adoption starting.

### User Growth

| Date | Users | Scans | Treasury | Milestone |
|------|-------|-------|----------|-----------|
| Jun 15 | 0 | 0 | $0.00 | Agent pipeline + ArgusOracle deployed |
| Jun 16 | 0 | 5 | $0.00 | 3-agent consensus live · v0.1 submitted |
| Jun 17 | 0 | 12 | $0.00 | Circle Agent Wallets created · 2/5 primitives |
| Jun 18 | — | 45 | $0.00 | argusarc.xyz live · X launch · v0.3 submitted |
| Jun 19 | 5 | 70 | $0.05 | Paid scans live · MetaMask flow · v0.4 submitted |
| Jun 20 | 8 | 332 | $0.12 | ELO fixed · Agent γ overhauled · v0.5 submitted |
| Jun 21 | 12 | 340 | $0.22 | Circle wallets (no MetaMask) · agent payments · v0.6 submitted |
| Jun 22 | 16 | 365 | $0.28 | Threshold toggle · on-chain ELO · v0.7 submitted |
| **Jun 23** | **52** | **398** | **$0.83** | **App Kit 5/5 · Dockerfile deploy · v0.8 submitted** |
| Jun 24 | 63 | 467 | $1.27 | UI redesign · Case Files · shareable links · v0.9 submitted |
| Jun 25 | 100+ | 500+ | $3.00 | 100 users milestone · 500 scans crossed · v0.9 shipped |
| **Jun 26** | **100+** | **642** | **$3.00** | **Arc Ecosystem section · v0.10 live** |
| Jun 27 | 100+ | 644 | $5.63 | Shadow Float V2 Alpha — borrow + repay lifecycle closed |
| Jun 28 | 100+ | 646 | $5.79 | Shadow Float V2 Beta & Gamma — all 3 agents with credit lines |
| **Jun 29** | **100+** | **648** | **$5.80** | **CLI shipped to npm · `npx argus-scan` live · Discord + X posted** |
| Jun 30 | 100+ | 664 | $6.85 | Shadow Float CitePay lifecycle closed · Why Arc section added |
| **Jul 1** | **100+** | **666** | **$6.93** | **Telegram bot live · t.me/argus_arc_bot · three surfaces shipped** |
| **Jul 2** | **125** | **806** | **$7.93** | **800+ scans · 125 users · Mermaid diagram · JUDGE_GUIDE · TOC** |

---

## Telegram: Scan from Any Chat

Open Telegram, paste an address, get a verdict. Same 3-agent consensus as web and CLI — now one `/scan` away.

**[t.me/argus_arc_bot](https://t.me/argus_arc_bot)**

```
/scan 0x... — Scan any token
/stats — Live treasury & scans
/whoami — Your Circle wallet
```

First `/scan` auto-creates a Circle wallet per Telegram user. Every scan pays $0.01 USDC via Gateway x402. Full agent reasoning — not summarized. Agent payments shown when dissenters pay winners. Verdict recorded on-chain.

Web. CLI. Telegram. Three surfaces. One oracle.

---

## CLI: Scan from Your Terminal

No browser. No MetaMask. No signup. Just a terminal.

```bash
npx argus-scan@latest 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
```

**What happens:**
1. First run auto-creates a Circle wallet (stored locally, no key management)
2. Pays $0.01 USDC to treasury via Gateway x402 — real on-chain transaction
3. Three agents analyze independently (DeepSeek, Claude, Rule Engine)
4. Consensus locks in — dissenters pay winners 0.0005 USDC each
5. Verdict recorded on-chain via ArgusOracle on Arc

Every CLI scan is identical to a website scan — same agents, same consensus, same on-chain record. The only difference is where you type.

```bash
# Scan any token address
npx argus-scan@latest 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48

# Pipe-friendly JSON
npx argus-scan@latest 0x... --json | jq .result.verdict

# Live stats
npx argus-scan@latest stats

# Show your Circle wallet
npx argus-scan@latest whoami
```

📦 Published as [`argus-scan`](https://www.npmjs.com/package/argus-scan) on npm. Zero dependencies, Node 18+. Source in [`cli/`](cli/).

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
