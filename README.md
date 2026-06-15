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
| Consensus | Arc Testnet (ArgusOracle.sol) |
| Settlement | Arbitrum (Treasury.sol) |
| Payments | Circle Gateway nanopayments |
| Agent-α | Claude Sonnet 4 |
| Agent-β | GPT-4o-mini |
| Agent-γ | Rule engine (local) |
| Orchestrator | Node.js + TypeScript |
| Frontend | Next.js + Tailwind v4 |
| Deploy | Railway (agent) + Vercel (frontend) |

## Quick Start

```bash
# Agent
cd agent && npm install && npm run dev

# Frontend
cd frontend && npm install && npm run dev

# Contracts
cd contracts && npm install && npx hardhat compile
```
