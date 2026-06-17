# Argus

<p align="center">
  <a href="https://x.com/Argus_arc">
    <img src="https://img.shields.io/badge/X-@Argus__arc-1DA1F2?style=for-the-badge&logo=x&logoColor=white" alt="X">
  </a>
  <a href="https://testnet.arcscan.app/address/0x563b2DA572948C2b54B5f1f26CcFebC153Cb46C8">
    <img src="https://img.shields.io/badge/ArcScan-ArgusOracle-6C5CE7?style=for-the-badge" alt="ArcScan">
  </a>
</p>

**Τρεις οφθαλμοί. Μια κρίσις.** — Three eyes. One verdict.

Multi-agent security consensus oracle on Arc. Three independent AI agents stake USDC on security verdicts. 2/3 consensus required. $0.01 per query via Gateway nanopayments.

> Built for the Lepton Agents Hackathon (Jun 15–29, 2026) — Canteen × Circle × Arc

---

## Architecture

```
User pays $0.01 USDC
  │
  ▼
┌─────────────────────────────────┐
│  Gateway Nanopayment (Circle)    │  ← Real USDC, gasless batch
└────────────┬────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│       Orchestrator (Node.js)     │  ← Fan-out → 3 agents → consensus
└────┬──────────┬──────────┬──────┘
     │          │          │
     ▼          ▼          ▼
┌─────────┐ ┌─────────┐ ┌──────────┐
│Agent-α  │ │Agent-β  │ │Agent-γ   │
│DeepSeek │ │Claude   │ │Rule      │
│V3       │ │Sonnet 4 │ │Engine    │
│contract │ │tokenom. │ │instant    │
└────┬────┘ └────┬────┘ └────┬─────┘
     │          │          │
     └──────────┼──────────┘
                ▼
┌─────────────────────────────────┐
│  ArgusOracle (Arc testnet)       │  ← Immutable verdict log
│  0x563b2DA572...C153Cb46C8       │
└─────────────────────────────────┘
     │                    │
     ▼                    ▼
  ELO scores         Agent stakes
  Reputation          won/lost
```

## Stack

| Layer | Tech |
|-------|------|
| Agent-α | DeepSeek-V3 (contract logic, via OpenAI SDK) |
| Agent-β | Claude Sonnet 4 (tokenomics, via Anthropic SDK) |
| Agent-γ | Deterministic rule engine (local, zero cost) |
| Consensus | 2/3 threshold with per-agent reasoning |
| Blockchain | ArgusOracle.sol on Arc testnet (chain 5042002) |
| Payments | Circle Gateway x402 nanopayments ($0.01/scan) |
| Staking | arc-agent-pay primitives (signed intents, settlement batches) |
| Reputation | ELO engine (K=32) — self-correcting |
| Orchestrator | Node.js + TypeScript + Express |
| Frontend | Next.js 15 + Tailwind v4 |
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

## Daily Log

| Day | Date | Shipped |
|-----|------|---------|
| 1 | Jun 15 | Scaffold: agent, contracts, frontend. ARC CLI setup. |
| 2 | Jun 16 | 3-agent pipeline live (DeepSeek + Claude + rules). Consensus + ELO working. ArgusOracle deployed on Arc testnet. Gateway x402 wired. Per-agent reasoning in responses. v0.1 submitted. |
| 3 | Jun 17 | Circle Agent Wallets created for all 3 agents (0x284e...a320, 0x3f75...a34f, 0x1fa7...46de). Circle CLI authenticated. Stack now 2/5 Circle primitives. |

---

<p align="center">
  <b>Building in public — follow along</b><br>
  <a href="https://x.com/Argus_arc">x.com/Argus_arc</a>
</p>
