# Architecture — Argus

Multi-agent security consensus oracle on Arc.

---

## System Overview

```mermaid
flowchart TB
    U[User] -->|Submit address| F[Frontend<br/>Next.js 15 + Vercel]
    U -->|"Get Started (no wallet)"| CW[Circle Pre-Create<br/>Wallet Pool]
    CW -->|Assign SCA wallet| U
    
    F -->|$0.01 USDC| GW[Gateway x402<br/>Nanopayment]
    F -->|Free scan| CS[/scan/circle]
    
    GW --> O[Orchestrator<br/>Node.js + Express]
    CS --> O
    
    O -->|Fan-out| A1[Agent α<br/>DeepSeek-V3]
    O -->|Fan-out| A2[Agent β<br/>Claude Sonnet 4.5]
    O -->|Fan-out| A3[Agent γ<br/>Rule Engine]
    
    A1 --> C[Consensus Engine<br/>2/3 Threshold]
    A2 --> C
    A3 --> C
    
    C -->|Consensus reached| R[Reputation Engine<br/>ELO Scoring]
    C -->|Dissenter exists| AP[Agent Payments<br/>Loser → Winners<br/>0.001 USDC]
    
    R --> S[Store<br/>Railway Volume]
    AP --> S
    
    C --> AO[ArgusOracle.sol<br/>Arc Testnet<br/>Immutable Verdict Log]
    
    S --> F2[Stats + History<br/>Public Endpoints]
```

---

## Component Architecture

### 1. Frontend (`frontend/`)
- **Framework:** Next.js 15, deployed on Vercel
- **Domain:** argusarc.xyz (custom domain + SSL)
- **Key features:**
  - Dark-themed premium UI with Framer Motion animations
  - Real-time scan progress with per-agent check indicators
  - ELO leaderboard badge (polls `/elo` every 30s)
  - Stats polling (every 10s from `/stats`)
  - Global scan history (every 15s from `/history`)
  - Dual wallet flow: "Get Started" (Circle pre-create) + "MetaMask" (traditional)
  - Mobile-responsive with fluid typography and touch targets

### 2. Agent Backend (`agent/`)
- **Runtime:** Node.js + TypeScript + Express
- **Deployment:** Railway (Metal builder, Nixpacks)
- **Port:** 3001 (STATUS_PORT)
- **Persistence:** Railway volume mounted at `/argus-data`
  - `elo_store.json` — ELO reputation (survives redeploys)
  - `store.json` — Scan counts + history (global, shared)
  - `wallet_pool.json` — Circle pre-create wallet tracking
- **Key modules:**
  - `orchestrator.ts` — Query processing pipeline (payment → agents → consensus → ELO → payments)
  - `reputation.ts` — Pairwise ELO engine (K=64/<30 queries, K=32/≥30 queries)
  - `consensus.ts` — 2/3 threshold with weighted staking
  - `agents/alpha.ts` — DeepSeek-V3 (contract logic)
  - `agents/beta.ts` — Claude Sonnet 4.5 (tokenomics)
  - `agents/gamma.ts` — Deterministic rule engine (local, zero cost)
  - `wallets/precreate.ts` — Circle wallet pool (assign, topup, stats)
  - `wallets/funding.ts` — Auto-funding pipeline (viem, native USDC transfers)
  - `payments/agentPayments.ts` — Agent-to-agent nanopayment settlement
  - `store.ts` — File-based persistent store (Railway volume)
  - `treasury.ts` — Stake settlement via arc-agent-pay
  - `gateway.ts` — Payment intent processing

### 3. Smart Contracts (`contracts/`)
- **Framework:** Hardhat + Solidity 0.8.28 (viaIR pipeline)
- **Network:** Arc testnet (chain ID 5042002)
- **Contracts:**
  - `ArgusOracle.sol` — Immutable verdict log. Records contract address, verdict, consensus breakdown, timestamp, settlement batch ID
  - Deployed at: `0x563b2DA572948C2b54B5f1f26CcFebC153Cb46C8`

### 4. Circle Infrastructure

| Component | Purpose | Status |
|-----------|---------|--------|
| Gateway x402 | $0.01 USDC nanopayment paywall | Live |
| Agent Wallets (SCA) | 3 wallets — one per agent. Stake USDC on verdicts | Live |
| Dev-Controlled Wallets | Pre-created pool of 50 SCA wallets. Assigned on demand | Live |
| Entity Secret | Registered Jun 21 for dev-controlled wallet signing | Live |
| Contracts (ArgusOracle) | On-chain verdict log | Live |
| App Kit | Planned: Unified Balance + CCTP | Planned |

---

## Data Flow: Scan Lifecycle

```
1. USER INPUT
   User pastes token address at argusarc.xyz
   │
2. WALLET RESOLUTION
   ├── Circle user: POST /scan/circle {userId, contractAddress}
   │   ├── Backend looks up walletPool.getByRefId(userId)
   │   ├── Sends $0.01 from funding wallet → treasury (viem)
   │   └── Proceeds to step 3
   │
   └── MetaMask user: POST /scan {contractAddress}
       ├── eth_sendTransaction (user → treasury, $0.01 USDC)
       ├── Wait for tx receipt (up to 20s)
       └── Proceeds to step 3
   │
3. ORCHESTRATOR (orchestrator.processQuery)
   ├── Cache check: same address → instant return (zero API cost)
   ├── Payment intent created (via gateway.ts)
   ├── Fan-out to 3 agents in parallel (Promise.all)
   │   ├── alphaAgent.analyze(req)
   │   ├── betaAgent.analyze(req)
   │   └── gammaAgent.analyze(req)
   ├── Consensus: runConsensus(verdicts)
   │   ├── Count SAFE / RISKY / SCAM votes
   │   ├── 2/3 threshold → consensus reached
   │   └── Return winningAgents + losingAgents
   ├── Stake settlement: settleStakes(verdicts, result)
   ├── ELO update: updateReputation(verdicts, result)
   │   ├── Compute pairwise expected scores
   │   ├── Apply K-weighted Elo delta
   │   └── Persist to elo_store.json
   ├── Agent payments: settleAgentPayments(winners, losers)
   │   └── Fire-and-forget (doesn't block response)
   └── Store: store.recordScan(record, consensusReached)
       └── Persist to store.json
   │
4. RESPONSE
   {
     verdict, confidence, consensus,
     agents: [{name, verdict, confidence, reasoning}],
     agreementCount, totalAgents,
     winningAgents, losingAgents,
     settlementBatchId
   }
```

---

## Payment Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    PAYMENT FLOWS                         │
├───────────────┬────────────────────┬────────────────────┤
│   META MASK    │   CIRCLE WALLET    │   AGENT-TO-AGENT   │
│   (v0.4)       │   (v0.6)           │   (v0.6)           │
├───────────────┼────────────────────┼────────────────────┤
│ User sends    │ Funding wallet     │ Losing agent pays  │
│ $0.01 USDC    │ sends $0.01 to     │ 0.001 USDC to      │
│ to treasury   │ treasury on behalf │ each winning agent │
│ via MetaMask  │ of Circle user     │ via EOA signing    │
│               │                    │                    │
│ On-chain tx   │ On-chain tx        │ On-chain tx        │
│ User-paid     │ Server-paid        │ Agent-paid         │
└───────────────┴────────────────────┴────────────────────┘
                          │
                          ▼
              ┌─────────────────────┐
              │  TREASURY WALLET     │
              │  0x0699a029e2e05...  │
              │  Public on ArcScan   │
              └─────────────────────┘

FUNDING FLOW:
  Circle Faucet → Funding Wallet (0x4Dd5e289...)
    ├── $0.50 → New MetaMask users (on first connect)
    ├── $0.50 → New Circle users (on wallet assign)
    ├── $0.01 → Treasury (per Circle scan)
    └── $1.00 → Agent EOAs (one-time gas funding)
```

---

## ELO Reputation System

```
AGENT RATINGS (pairwise expected-score model)

Expected score for agent i vs opponent j:
  E(i,j) = 1 / (1 + 10^((R_j - R_i) / 400))

Overall expected score for agent i:
  E(i) = average of E(i,j) across all j ≠ i

ELO update:
  R_new = R_old + K × (actualScore - expectedScore)

K-factor:
  K = 64  if queries < 30  (provisional rating)
  K = 32  if queries >= 30 (established rating)

actualScore:
  1.0 if agent agreed with consensus
  0.0 if agent dissented

Persistence:
  /argus-data/elo_store.json (Railway volume)
  Survives redeploys, loaded on startup
```

---

## Agent-to-Agent Economy

```
After each scan with 2/3 consensus:

  Losing Agent ──$0.0005 USDC──► Winning Agent A
  Losing Agent ──$0.0005 USDC──► Winning Agent B

Settled on-chain via native USDC transfers.
Tracked at GET /agent-payments.
Fire-and-forget — doesn't block scan response.
```

---

## Deployment

| Component | Platform | URL |
|-----------|----------|-----|
| Frontend | Vercel | https://argusarc.xyz |
| Agent | Railway | https://argus-agent-production-ab97.up.railway.app |
| Contracts | Arc Testnet | Chain 5042002 |
| Volume | Railway | /argus-data (4.9 GB) |
