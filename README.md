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

> **Don't get rugged.** Paste any token address. Three independent AI agents analyze it from different angles. Each stakes real money on its verdict. If 2 out of 3 agree, you get a clear answer: SAFE, RISKY, or SCAM — with full reasoning from every agent.
>
> No MetaMask required. Works on mobile. Costs $0.01 per scan. Every verdict recorded on-chain forever.

| **500+ scans** | **$3.00 treasury** | **100+ users** | **5/5 Circle primitives** |
|---|---|---|---|

**Live:** [argusarc.xyz](https://argusarc.xyz) · **Demo:** [youtube.com/shorts/_J39OKjtDyo](https://youtube.com/shorts/_J39OKjtDyo) · **X:** [@Argus_arc](https://x.com/Argus_arc)

> 📂 **[ARCHITECTURE.md](ARCHITECTURE.md)** — Full system design, data flows, payment architecture
> 🔧 **[ENGINEERING_DEBUG_LOG.md](ENGINEERING_DEBUG_LOG.md)** — 6 real bugs encountered and solved
> 🤖 **[AGENTS.md](AGENTS.md)** — How any AI agent can plug into Argus as a security oracle
> ✅ **[verify.sh](verify.sh)** — 34-check end-to-end verifier

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

## Agent Prompts

*All three agent system prompts are open source and verifiable in the repo.*

| Agent | File | Model | Prompt |
|-------|------|-------|--------|
| **Agent α** | [`agent/src/agents/alpha.ts`](agent/src/agents/alpha.ts) | DeepSeek-V3 | Contract-level security: ownership, proxies, honeypots, access control, upgradeability, external calls. 6-point structured analysis. |
| **Agent β** | [`agent/src/agents/beta.ts`](agent/src/agents/beta.ts) | Claude Sonnet 4.5 | Tokenomics & market structure: holder distribution, whale concentration, LP depth, trading patterns, buy/sell taxes, wash trading. 6-point structured analysis. |
| **Agent γ** | [`agent/src/agents/gamma.ts`](agent/src/agents/gamma.ts) | Rule Engine (local) | Deterministic checks: address entropy (Shannon formula), digit-run heuristics, known scam deployer patterns, EIP-55 checksum validation, blacklist matching. Zero API cost. |

Each agent operates independently — no shared state, no prompt leakage between models. Agent γ is fully deterministic; run the same address twice, get the same result. See [`AGENTS.md`](AGENTS.md) for how to plug any AI agent into Argus.

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

# Current stats (500+ scans, 98% consensus rate)
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
| **v0.10** | DexScreener trending feed, CLI tool (`npx argus scan`), retention features | Planned |
| **v1.0** | Mainnet deployment — real USDC, real stakes, production oracle | Post-hackathon (Arc is testnet-only) |

Circle primitive completion:
- Gateway x402 · Agent Wallets · Dev-Controlled Wallets · Contracts · App Kit ✅ (all 5/5)

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

## Traction

*Real usage on Arc testnet. Every number is verifiable on-chain.*

| Metric | Value | Proof |
|--------|-------|-------|
| **Scans processed** | 500+ | `/stats` endpoint · on-chain records |
| **Consensus reached** | 483 (98%) | 3-agent pipeline live since Jun 16 |
| **Users** | 100+ | Circle pre-create wallets |
| **Treasury balance** | $3.00 USDC | [ArcScan](https://testnet.arcscan.app/address/0x0699a029e2e05EC88d6418EC744232702Cf77d81) |
| **Agent economy volume** | 215 queries each | 20+ agent-to-agent nanopayments settled |
| **ELO leaderboard** | α 3,793 (90%) · β 3,761 (85%) · γ 3,764 (69%) | `/elo` endpoint · on-chain |
| **Circle primitives** | 5/5 | Gateway x402 · Agent Wallets · Dev-Controlled Wallets · Contracts · App Kit |

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
