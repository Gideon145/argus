# Engineering Debug Log — Argus

Real problems encountered during the Lepton Agents Hackathon build, and how we solved them. Judges: this is the unfiltered development record.

---

## 1. ELO Scoring — Static Expected Score

**Problem:** The initial ELO engine used a hardcoded `expectedScore = 0.5` for every agent, regardless of their actual rating. This meant a 1600-rated agent beating a 1000-rated agent gained the same ELO as beating a 1600-rated peer. Mathematically wrong.

**Root cause:** Rushed initial implementation. The ELO formula was stubbed out to get consensus working, then forgotten in the shipping sprint.

**Fix (Jun 20):** Replaced with proper pairwise expected-score computation:
```
expectedScore = average of 1/(1 + 10^((opponentElo - agentElo)/400)) across all other agents
```
K-factor: 64 for agents with <30 queries (provisional), 32 for veterans (>30 queries). Persisted to disk at `data/elo_store.json` via Railway volume mount. Survives redeploys.

**Verification:**
```bash
curl https://argus-agent-production-ab97.up.railway.app/elo | jq '.agents'
```
ELO values now reflect genuine pairwise skill differentials, not a static offset.

---

## 2. Stats avgConfidence Bug — Consensus Rate vs Actual Confidence

**Problem:** The `/stats` endpoint returned `avgConfidence: 100` for the first 326 scans. This was suspicious — no real system has perfect confidence.

**Root cause:** The stats aggregation was computing `consensusReached / queries` (i.e., consensus rate), not the actual confidence values from agent verdicts. Since consensus was reached on every single scan, this always returned 100%.

**Fix (Jun 20):** Changed the calculation to average the stored `confidence` field from scan history records. Each scan record stores the rounded average of all three agents' confidence scores. Now returns a genuine average.

**Before:** `avgConfidence: 100` (consensus rate, misleading)
**After:** `avgConfidence: 92` (real average across 340+ scans)

**Verification:**
```bash
curl https://argus-agent-production-ab97.up.railway.app/stats | jq '.avgConfidence'
```

---

## 3. Agent γ — Over-Confident Deterministic Engine

**Problem:** Agent γ (Rule Engine) had a confidence function of `Math.min(95, 60 + riskScore)`. For addresses with no flags (riskScore=0), it reported 70% confidence. For addresses with moderate flags (riskScore=15), it jumped to 75%. The bands were too narrow and didn't reflect the actual reliability of deterministic checks.

**Root cause:** The confidence bands were calibrated on a handful of test addresses without real-world validation. Deterministic checks (address entropy, digit patterns) are useful signals but shouldn't carry the same weight as full contract analysis.

**Fix (Jun 20):**
- Added hex entropy computation (Shannon entropy over address nibbles)
- Added digit-run detection (consecutive numeric sequences)
- Rebalanced risk score thresholds: SAFE < 20, RISKY 20-49, SCAM >= 50
- Calibrated confidence bands:
  - SAFE: `max(55, 90 - riskScore/1.5)`
  - RISKY: `max(30, 70 - riskScore/1.2)`
  - SCAM: `max(10, 50 - (riskScore-50)/2)`
- Known token database expanded (USDC, WETH, USDT, SQUID)

**Result:** Agent γ now reports more nuanced confidence levels. A clean address gets 90% (high but not overconfident). A flagged address at riskScore=30 gets ~45%. The deterministic engine no longer overstates its certainty.

---

## 4. Circle Pre-Create Wallets — Pagination Gap

**Problem:** After creating 50+ wallets in the Circle wallet set, the `listWallets` API only returned 10 results. The pool sync script (`sync-pool.ts`) was overwriting our 100-entry local pool with only 10 wallets, causing "pool empty" errors for real users.

**Root cause:** The Circle SDK's `listWallets` method defaults to 10 results per page without surfacing a pagination token. The syncing logic didn't account for this — it treated the first page as the complete set.

**Fix (Jun 21):**
1. Bypassed `listWallets` for pool management
2. Modified `topup.ts` to directly append new wallets to the local pool file on creation
3. Added `walletPool.initIfEmpty()` to auto-populate the pool on first deploy via Railway volume
4. Pool now self-heals: if the assign endpoint detects an empty pool, it triggers a 10-wallet topup automatically

**Lesson:** Never trust list APIs as the source of truth for asset pools. Track creations locally and use the list API only for verification.

---

## 5. Route Ordering — Express Parameter Collision

**Problem:** `GET /wallet/pool-stats` returned "No wallet found for this user" instead of pool statistics.

**Root cause:** Express matches routes in definition order. `/wallet/pool-stats` was defined AFTER `/wallet/:userId`, so Express matched "pool-stats" as a `:userId` parameter and routed to the wrong handler.

**Fix (Jun 21):** Moved the static route (`/wallet/pool-stats`) before the parameterized route (`/wallet/:userId`). Standard Express best practice that was missed in the shipping rush.

**Verification:**
```bash
curl https://argus-agent-production-ab97.up.railway.app/wallet/pool-stats
# Returns: {"total":50,"assigned":7,"available":43}
```

---

## 6. Agent EOA Wallets — Zero Balance on First Agent-to-Agent Payment

**Problem:** The agent-to-agent nanopayment system failed silently on first deployment. Agent γ attempted to pay 0.001 USDC to winning agents but every transaction reverted with "insufficient funds."

**Root cause:** The agent EOA wallets (used for signing nanopayment transactions) had 0 USDC balance. They were created during initial setup but never funded — the Circle SCA wallets (which had 20 USDC each) were separate from the EOA signing wallets.

**Fix (Jun 21):**
1. Created `scripts/fund-agents.ts` to send $1 USDC to each agent EOA wallet from the funding wallet
2. Added balance checking to the agent payment settlement logic
3. Documented the EOA/SCA wallet architecture distinction

**Verification:**
```bash
curl https://argus-agent-production-ab97.up.railway.app/agent-payments | jq '.totalPayments'
```

---

## Lessons for Future Builds

1. **Never trust a list API as source of truth** — track state locally, verify remotely
2. **ELO is a solved formula** — don't approximate it, implement it correctly the first time
3. **Two-wallet architecture (EOA + SCA) creates blind spots** — document which key signs what
4. **Express route ordering matters** — static routes before parameterized routes, always
5. **Confidence scores need real-world calibration** — not just linear interpolation from test data
