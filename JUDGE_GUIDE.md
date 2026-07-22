# Judge Guide — Argus (4 minutes)

> "Build for a reviewer who will click around without you in the room." — Lepton judging guidelines

**🎥 [Watch the 3-min demo](https://www.youtube.com/watch?v=sHgjJe5jx6s) — Updated Jul 10 with the new UI**

**The punchline:** Three AI agents stake real USDC on every token verdict. DeepSeek and Claude pay each other automatically through their verdicts — nanopayments settle in under 500ms. 300+ users. 1,483 scans. 319 OKX sales at 4.95★. 100+ agent-to-agent payments. Everything verifiable on ArcScan.

---

## 1. See it work (60 seconds)

Go to **[argusarc.xyz](https://argusarc.xyz)** → paste an address → hit Scan. No signup needed.

The dashboard shows a **live activity feed** of every scan happening in real time, a **Quick Scan** bar for fast lookups, and an **FAQ accordion** explaining the protocol. Below the scan form, the **Recent Audits Log** shows every verdict with on-chain verification hashes.

Scan this: `0x07865c6e87b9a5e213ae308ba4f8a9aadf7e2b0c` (Arc-native USDC)
→ 🟢 **SAFE** · 3/3 consensus

Scan this: `0x6944e1df6bf5972305f9ab25df47ef10de01bcc8` (Unibase AI — documented proxy rug)
→ 🔴 **SCAM** · 2/3 consensus · agents show exact evidence

**Every scan shows:** which agent voted what, their confidence, their full reasoning, and the on-chain settlement hash.

---

## 2. Autonomous Patrol — agents don't wait (60 seconds)

Go to **[argusarc.xyz/patrol](https://argusarc.xyz/patrol)** — every 15 minutes, three agents autonomously scan a contract, stake USDC, reach consensus, and settle on-chain. Zero human input. 1,772 patrol scans completed.

This is not a cron job. Agents independently decide, stake, and pay each other. The patrol feed shows every autonomous scan with verdict, consensus breakdown, and ArcScan links.

---

## 3. Verify the agent economy on-chain (60 seconds)

**This is not mock data.** Every dissent costs real USDC. Losers pay winners 0.0005 USDC, scaled by confidence. 100+ payments, all on ArcScan.

| What | ArcScan |
|------|---------|
| Treasury ($15.76+ USDC) | [0x0699...f77d81](https://testnet.arcscan.app/address/0x0699a029e2e05EC88d6418EC744232702Cf77d81) |
| Oracle (verdict log) | [0x563b...b46C8](https://testnet.arcscan.app/address/0x563b2DA572948C2b54B5f1f26CcFebC153Cb46C8) |
| Agent α wallet | [0x284e...2d320](https://testnet.arcscan.app/address/0x284e38e6f139b3b85c746e00f8a3cf46d2b2d320) |
| Agent β wallet | [0x3f75...7a34f](https://testnet.arcscan.app/address/0x3f752a72d8e2d9d3a4f2011ca9e0407bc5b7a34f) |
| Agent γ wallet | [0x1fa7...6146de](https://testnet.arcscan.app/address/0x1fa79f59abbada269de477b45ded38c75a6146de) |
| Shadow Float V2 (agent credit) | [0x20dc...b12C2](https://testnet.arcscan.app/address/0x20dcA96B0C487D94De885c726c956ffaF38b12C2) |

**Quick check:** Open any agent wallet → see USDC flowing between them on dissent.

---

## 4. CLI + Telegram (30 seconds)

```bash
npx argus-scan@latest 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
```
No signup. Auto-creates Circle wallet. Same consensus. [npm](https://www.npmjs.com/package/argus-scan)

**Telegram:** [t.me/argus_arc_bot](https://t.me/argus_arc_bot) → `/scan 0x...` → verdict in chat.

**SDK:** `npm i @ogxavier/argus-sdk` → `import { scan } from '@ogxavier/argus-sdk'` → call from any JS/TS codebase.

---

## 5. Numbers you can verify

| Metric | Value | Proof |
|--------|-------|-------|
| Scans | 1,483 | `GET /stats` |
| Patrol scans | 1,772 | `GET /patrol-log` |
| Users | 300+ (web, CLI, Telegram, npm, OKX) | `GET /stats` |
| OKX Marketplace | 319 sold · 4.95★ · 103 reviews | okx.ai/agents/5047 |
| Consensus rate | 89.6% | on-chain |
| Agent-to-agent payments | 100+ | `/agent-payments` |
| Circle primitives | 5/5 | Gateway x402, Agent Wallets, DCW, Contracts, App Kit |
| Benchmark (held-out) | 85.7% accuracy, 100% precision | [`benchmark/`](benchmark/) |

---

## 6. What makes this a Lepton project

- **RFB 3** (Agent-to-Agent Nanopayments) — DeepSeek and Claude pay each other automatically through their verdicts
- **Prior Art #08** (Reputation as collateral) — agents stake real USDC, not a score. ELO updates on-chain
- **Distribution Bootstrap** — security sidecar: no SDK, no integration, paste an address
- **5/5 Circle primitives** — every piece of the Arc stack, integrated and live

---

**4 minutes. Everything on-chain. Nothing to install.** Questions? The README, ARCHITECTURE.md, and AGENTS.md have full detail.
