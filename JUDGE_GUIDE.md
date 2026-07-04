# Judge Guide — Argus (4 minutes)

> "Build for a reviewer who will click around without you in the room." — Lepton judging guidelines

**The punchline:** Three AI agents stake real USDC on every token verdict. Losers pay winners. 128 users. $9.60 in on-chain treasury. Everything verifiable on ArcScan.

---

## 1. See it work (60 seconds)

Go to **[argusarc.xyz](https://argusarc.xyz)** → click **Get Started** (Circle wallet, instant).

Scan this: `0x07865c6e87b9a5e213ae308ba4f8a9aadf7e2b0c` (Arc-native USDC)
→ 🟢 **SAFE** · 3/3 consensus

Scan this: `0x6944e1df6bf5972305f9ab25df47ef10de01bcc8` (Unibase AI — documented proxy rug)
→ 🔴 **SCAM** · 2/3 consensus · agents show exact evidence

**Every scan shows:** which agent voted what, their confidence, their full reasoning, and the on-chain settlement.

---

## 2. Verify the agent economy on-chain (60 seconds)

**This is not mock data.** Every dissent costs real USDC. Losers pay winners 0.0005 USDC, scaled by confidence. 100+ payments, all on ArcScan.

| What | ArcScan |
|------|---------|
| Treasury ($9.60 USDC) | [0x0699...f77d81](https://testnet.arcscan.app/address/0x0699a029e2e05EC88d6418EC744232702Cf77d81) |
| Oracle (verdict log) | [0x563b...b46C8](https://testnet.arcscan.app/address/0x563b2DA572948C2b54B5f1f26CcFebC153Cb46C8) |
| Agent α wallet | [0x284e...2d320](https://testnet.arcscan.app/address/0x284e38e6f139b3b85c746e00f8a3cf46d2b2d320) |
| Agent β wallet | [0x3f75...7a34f](https://testnet.arcscan.app/address/0x3f752a72d8e2d9d3a4f2011ca9e0407bc5b7a34f) |
| Agent γ wallet | [0x1fa7...6146de](https://testnet.arcscan.app/address/0x1fa79f59abbada269de477b45ded38c75a6146de) |
| Shadow Float V2 (agent credit) | [0x20dc...b12C2](https://testnet.arcscan.app/address/0x20dcA96B0C487D94De885c726c956ffaF38b12C2) |

**Quick check:** Open any agent wallet → see USDC flowing between them on dissent.

---

## 3. CLI + Telegram (60 seconds)

```bash
npx argus-scan@latest 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
```
No signup. Auto-creates Circle wallet. Same consensus. [npm](https://www.npmjs.com/package/argus-scan)

**Telegram:** [t.me/argus_arc_bot](https://t.me/argus_arc_bot) → `/scan 0x...` → verdict in chat.

---

## 4. Numbers you can verify

| Metric | Value | Proof |
|--------|-------|-------|
| Scans | 924 | `GET /stats` |
| Users | 128 (114 web, 2 CLI, 12 TG) | `GET /sources` |
| Consensus rate | 94% | on-chain |
| Agent payments | 100+ (0.05 USDC vol) | `/agent-payments` |
| Circle primitives | 5/5 | Gateway x402, Agent Wallets, DCW, Contracts, App Kit |
| Benchmark (held-out) | 85.7% accuracy, 100% precision | [`benchmark/`](benchmark/) |

---

## 5. What makes this a Lepton project

- **RFB 3** (Agent-to-Agent Nanopayments) — agents pay each other on dissent
- **Prior Art #08** (Reputation as collateral) — agents stake real USDC, not a score
- **Distribution Bootstrap** — security sidecar: no SDK, no integration, $0.01/scan
- **5/5 Circle primitives** — every piece of the Arc stack, integrated and live

---

**4 minutes. Everything on-chain. Nothing to install.** Questions? The README, ARCHITECTURE.md, and AGENTS.md have full detail.
