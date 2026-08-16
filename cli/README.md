# Argus CLI

Scan any token address from your terminal. Same 3-agent consensus as the web app.

> Prefer talking to an AI? Argus also ships as an MCP server for Claude & ChatGPT: `npx @ogxavier/mcp` · [Smithery](https://smithery.ai/servers/argus-arc/argus)

## Install

```bash
npx argus-scan@latest 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
```

## Commands

```bash
# Scan any token address
npx argus-scan@latest 0x...

# Pipe-friendly JSON output
npx argus-scan@latest 0x... --json | jq .result.verdict

# Live stats
npx argus-scan@latest stats

# Show your Circle wallet
npx argus-scan@latest whoami
```

## What happens

1. First run auto-creates a Circle wallet (stored in `~/.argus/config.json`)
2. Pays $0.01 USDC to treasury via Gateway x402 — real on-chain transaction
3. Two AI agents + one deterministic rule engine analyze independently
4. Consensus locks in — dissenters pay winners 0.0005 USDC each
5. Verdict recorded on-chain via ArgusOracle on Arc

📦 Published as [`argus-scan`](https://www.npmjs.com/package/argus-scan) on npm. Zero dependencies, Node 18+. Source in [`cli/`](cli/).
