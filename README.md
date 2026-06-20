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
| Frontend | Next.js 15 + Tailwind v3 |
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
| 4 | Jun 18 | v0.3 — live at argusarc.xyz (Vercel + custom domain + SSL). Agent on Railway with persistent volume-backed store. Server-side global stats + scan history. Premium dark UI — real data, no mockups. Per-agent check indicators, performance tracking, analysis history table. Free scans for first 24h. X launch thread. Build shared in Canteen Discord. 5+ test scans producing accurate differentiated verdicts. Google form v0.3 submitted. |
| 5 | Jun 19 | v0.4 — paid scans + auto-funding pipeline. Real MetaMask tx confirmation ($0.01 USDC), payment verified on-chain before scan runs. Auto-funding: connect wallet → agent sends $0.50 test USDC → zero faucet friction. Two-wallet architecture (funding + treasury). Fixed Arc chain ID hex (0x4CE902 → 0x4CEF52). 70+ real scans in first 24h. Agent performance: DeepSeek-V3 100%, Claude Sonnet 4.5 61%, Rule Engine 70%. X post with stats published. Google form v0.4 + CLI submitted. |

---

<p align="center">
  <b>Building in public — follow along</b><br>
  <a href="https://x.com/Argus_arc">x.com/Argus_arc</a>
</p>
