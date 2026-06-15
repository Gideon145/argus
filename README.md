# Argus

**Τρεις οφθαλμοί. Μια κρίσις.** — Three eyes. One verdict.

Multi-agent security consensus oracle on Arc. Three autonomous AI agents stake USDC on security verdicts. 2/3 consensus required. $0.01 per query via Gateway nanopayments.

> Built for the Lepton Agents Hackathon (Jun 15–29, 2026) — Canteen × Circle × Arc

---

## Architecture

```
User pays $0.01 USDC
  │
  ▼
┌─────────────────────────────────┐
│  Gateway Nanopayment (Circle)   │  ← Real USDC, gasless batch
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│       Orchestrator (Node.js)    │  ← Railway, 15s loop
│  Fan-out → 3 agents → collect   │
│  Consensus → settle stakes       │
└────┬──────────┬──────────┬──────┘
     │          │          │
     ▼          ▼          ▼
┌─────────┐ ┌─────────┐ ┌──────────┐
│Agent-α  │ │Agent-β  │ │Agent-γ   │
│Claude   │ │GPT-4o   │ │Rule      │
│Sonnet 4 │ │mini     │ │Engine    │
│contract │ │tokenom. │ │determin.  │
└────┬────┘ └────┬────┘ └────┬─────┘
     │          │          │
     └──────────┼──────────┘
                ▼
┌─────────────────────────────────┐
│     ArgusOracle (Arc testnet)   │  ← Immutable verdict log
│     Treasury (Arbitrum)         │  ← Real USDC settlement
└─────────────────────────────────┘
     │                    │
     ▼                    ▼
  ELO scores         Agent stakes
  Reputation          won/lost
```

## Stack

| Layer | Tech |
|-------|------|
| Consensus | Arc Testnet (ArgusOracle.sol, chain ID 5042002) |
| Payments | arc-agent-pay (signed payment intents, receipt hashing, settlement batches) |
| Gateway | Circle Gateway nanopayments (planned: live testnet settlement) |
| Agent-α | Gemini 2.0 Flash (contract logic) |
| Agent-β | Gemini 2.0 Flash (tokenomics analysis) |
| Agent-γ | Rule engine (local, deterministic checks) |
| Orchestrator | Node.js + TypeScript |
| Wallet layer | viem + arc-agent-pay account primitives |
| Frontend | Next.js + Tailwind v4 |
| Deploy | Railway (agent) + Vercel (frontend) |

## Payment Flow (arc-agent-pay)

```
1. User pays $0.01 → createPaymentIntent() signed by user wallet
2. Merchant (treasury) verifies via verifyMerchantRequest()
3. 3 agents analyze → each signs a createReasoningReceipt()
4. Consensus reached → stakes settled via createSettlementBatch()
5. Dashboard updates → createDashboardSnapshot() shows revenue
```

**Adapted from [rick-best/arc-agent-pay](https://github.com/rick-best/arc-agent-pay) — Canteen-endorsed payment intent toolkit for AI agents on Arc.**

## Quick Start

```bash
# Agent
cd agent && npm install && npm run dev

# Frontend
cd frontend && npm install && npm run dev

# Contracts
cd contracts && npm install && npx hardhat compile
```
