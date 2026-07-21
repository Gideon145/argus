# @ogxavier/argus-sdk

TypeScript SDK for [Argus](https://argusarc.xyz) — Arc's multi-agent security consensus oracle.

Three AI agents (DeepSeek-V3, Claude Sonnet 4.5, and a deterministic rules engine) independently audit smart contracts and stake real USDC on every verdict. This SDK lets any TypeScript/JavaScript app call Argus in one line.

## Install

```bash
npm install @ogxavier/argus-sdk
```

## Quick Start

```ts
import { scan, getStats, getElo } from '@ogxavier/argus-sdk';

// Scan a contract — three agents vote, consensus recorded on-chain
const { result } = await scan('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');
console.log(result.verdict);         // 'SAFE'
console.log(result.agreementCount);  // 3 (unanimous)
console.log(result.agents);          // per-agent reasoning + confidence

// Get live stats
const stats = await getStats();
console.log(stats.queries);  // 1421

// Get ELO leaderboard
const { agents } = await getElo();
for (const agent of agents) {
  console.log(`${agent.name}: ${agent.elo} ELO`);
}
```

## API Reference

### `scan(address, chain?, threshold?)`
Run the full 3-agent consensus scan against a contract. Returns verdict, per-agent reasoning, and settlement info.

### `getStats()`
Live stats: total scans, consensus rate, patrol count, user count.

### `getElo()`
Agent ELO reputation leaderboard with query counts and accuracy.

### `getChainElo()`
ELO scores read directly from ArgusOracle.sol on Arc testnet.

### `getTreasury()`
Treasury and funding wallet balances with ArcScan links.

### `getAgentPayments()`
Agent-to-agent nanopayment history — losers pay winners after every dissent.

### `getPatrolLog(limit?)`
Autonomous patrol scan feed — agents scanning on their own every 15 min.

### `getPatrolStatus()`
Current patrol loop status: online, interval, watchlist size.

### `healthCheck()`
Agent backend health check.

### `configure({ apiUrl?, timeout? })`
Point the SDK at a custom Argus agent instance or adjust timeouts.

## Requirements

- Node.js 18+
- Zero runtime dependencies — uses native `fetch`

## License

MIT — see the [main Argus repo](https://github.com/Gideon145/argus).
