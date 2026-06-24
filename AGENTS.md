# AGENTS.md — Argus

> **Argus is a multi-agent security consensus oracle on Arc.**  
> Any AI agent can call Argus to analyze a token contract, receive a verdict (SAFE/RISKY/SCAM), and get paid for providing security analysis.  
> This file tells other AI coding agents how to use, extend, and contribute to Argus.

---

## Quick start for AI agents

```bash
# Clone
git clone https://github.com/Gideon145/argus
cd argus

# Agent backend
cd agent && npm install && npm run dev

# Frontend
cd frontend && npm install && npm run dev

# Verify everything works
bash verify.sh
```

---

## Repository layout

| Path | Purpose |
|------|---------|
| `agent/src/index.ts` | Express server — all API endpoints |
| `agent/src/orchestrator.ts` | Query pipeline: 3 agents → consensus → ELO → payments |
| `agent/src/agents/alpha.ts` | Agent α — DeepSeek-V3 (contract logic) |
| `agent/src/agents/beta.ts` | Agent β — Claude Sonnet 4.5 (tokenomics) |
| `agent/src/agents/gamma.ts` | Agent γ — Rule engine (deterministic checks) |
| `agent/src/consensus.ts` | Configurable threshold consensus (2/3 or 3/3) |
| `agent/src/reputation.ts` | Pairwise ELO scoring, persisted to disk + on-chain |
| `agent/src/payments/agentPayments.ts` | Agent-to-agent nanopayments (RFB 3) |
| `agent/src/payments/chainElo.ts` | On-chain ELO via ArgusOracle.sol |
| `agent/src/payments/unifiedBalance.ts` | App Kit Unified Balance (Circle SDK) |
| `agent/src/wallets/funding.ts` | Auto-funding wallet — sends $0.50 test USDC on connect |
| `agent/src/wallets/precreate.ts` | Circle pre-create wallet pool — instant onboarding |
| `agent/src/gateway.ts` | Gateway x402 payment processing |
| `frontend/app/page.tsx` | Main scan UI |
| `frontend/app/stats/page.tsx` | Live stats dashboard |
| `contracts/ArgusOracle.sol` | Immutable verdict log + ELO on Arc testnet |

---

## How agents plug into Argus

### Call Argus as an API (any LLM can do this)

```bash
# Scan a token (free debug endpoint)
curl -X POST https://argus-agent-production-ab97.up.railway.app/debug/scan \
  -H "Content-Type: application/json" \
  -d '{"contractAddress":"0xADDRESS","chain":"arc","threshold":2}'

# Check ELO reputation
curl https://argus-agent-production-ab97.up.railway.app/elo

# View agent payment history
curl https://argus-agent-production-ab97.up.railway.app/agent-payments

# Get live stats
curl https://argus-agent-production-ab97.up.railway.app/stats
```

### Add a new agent

1. Create `agent/src/agents/delta.ts` following the Verdict interface:
```ts
export interface Verdict {
  agent: string;
  verdict: 'SAFE' | 'RISKY' | 'SCAM';
  confidence: number;
  reasoning: string;
  stake: string;
}
```

2. Register it in `agent/src/orchestrator.ts` in `processQuery()`
3. The consensus engine handles the rest — 2/3 or 3/3 threshold automatically applies

### Add a new Circle primitive

1. Install the SDK: `cd agent && npm install @circle-fin/[package]`
2. Create a module in `agent/src/payments/`
3. Add an endpoint in `agent/src/index.ts`
4. Update the Circle primitives table in `README.md`

---

## Key rules

1. **Contract state is source of truth.** ArgusOracle.sol on Arc testnet is the immutable record. API endpoints are convenience reads.
2. **Three agents, no shared state.** α (DeepSeek), β (Claude), γ (rules) run independently. Never share prompts or results between agents before consensus.
3. **USDC is native on Arc.** No ERC-20 approvals needed. Use `msg.value` for payments. 18 decimals at EVM level.
4. **Agent private keys in env vars.** AGENT_ALPHA/BETA/GAMMA_PRIVATE_KEY. Planned upgrade: Circle W3S Programmable Wallets (no local keys).
5. **Consensus is configurable.** Default 2/3 (pragmatic), 3/3 (maximum safety). Threshold flows through all endpoints.
6. **ELO is pairwise math.** `1/(1+10^((opponentElo-agentElo)/400))`. K=64 for <30 queries, K=32 for ≥30. Persisted to `/argus-data/elo_store.json`.
7. **Agent payments are autonomous.** After every scan with disagreement, losing agent pays 0.0005 USDC to each winner. No human in the loop.
8. **Frontend is Next.js 15 on Vercel.** Agent backend is Node.js + Express on Railway (Dockerfile deploy).
9. **All addresses public on ArcScan.** Treasury, funding wallet, oracle, agent SCAs — verifiable by anyone.
10. **Keep README traction numbers current.** Judges read the repo directly. Update the traction table after every major change.

---

## Running the full system

```bash
# Terminal 1 — Agent backend
cd agent && npm run dev

# Terminal 2 — Frontend
cd frontend && npm run dev

# Verify end-to-end (34 checks)
bash verify.sh
```

---

## Deploying

- **Agent (Railway):** `npx railway up --service argus-agent` from repo root. Uses Dockerfile.
- **Frontend (Vercel):** Auto-deploys on push to `master`. Force deploy: `cd frontend && npx vercel --prod --yes`

---

## What is NOT implemented (yet)

- W3S Programmable Wallets for agent signing (currently raw private keys)
- Real-time holder distribution queries (Agent β infers from training data)
- On-chain bytecode decompilation (agents use AI inference, not static analysis)
- Mainnet deployment (Arc testnet only)
- Multi-sig or DAO governance for ArgusOracle

---

## License

MIT
