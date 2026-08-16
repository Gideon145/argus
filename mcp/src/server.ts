// Argus MCP — shared server construction (used by stdio + HTTP transports)
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ListResourcesRequestSchema, ListPromptsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { scanContract, recentScans, agentElo, poolStats } from "./api.js";
import { formatScanReport, formatRecentScans, formatElo, formatPoolStats } from "./format.js";

export function createArgusServer(): McpServer {
  const server = new McpServer(
    {
      name: "argus",
      version: "0.1.1",
    },
    {
      capabilities: { tools: {}, resources: {}, prompts: {} },
      instructions:
        "Argus is a multi-agent smart-contract security oracle. Use scan_contract to audit any EVM contract address. Three independent AI agents analyze it and vote with real stakes — the consensus verdict is the result. Powered by the Argus Arc testnet oracle.",
    }
  );

  // Tools-only server — answer resources/prompts listings with empty sets so
  // scanners (Smithery etc.) don't log Method-not-found warnings.
  server.server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: [] }));
  server.server.setRequestHandler(ListPromptsRequestSchema, async () => ({ prompts: [] }));

  // ── scan_contract ──────────────────────────────────────────────
  server.registerTool(
    "scan_contract",
    {
      title: "Scan Contract",
      description:
        "Run a full 3-agent consensus security audit on an EVM smart contract address. " +
        "Agent-α (DeepSeek-V3) analyzes contract logic, Agent-β (Claude) analyzes tokenomics, " +
        "Agent-γ (rules engine) runs deterministic checks. Returns the consensus verdict (SAFE / RISKY / SCAM), " +
        "per-agent confidence and detailed reasoning. Takes up to ~30 seconds.",
      inputSchema: {
        address: z
          .string()
          .regex(/^0x[a-fA-F0-9]{40}$/)
          .describe("EVM contract address to audit (0x...)"),
        chain: z
          .string()
          .default("arc")
          .describe("Chain to scan on (default 'arc' — works cross-chain via multi-RPC fallback)"),
        threshold: z
          .number()
          .int()
          .min(1)
          .max(3)
          .default(2)
          .describe("Consensus threshold — number of agents that must agree (default 2)"),
      },
    },
    async ({ address, chain, threshold }) => {
      try {
        const report = await scanContract(address, chain, threshold);
        return { content: [{ type: "text" as const, text: formatScanReport(report) }] };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Scan failed: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ── recent_scans ───────────────────────────────────────────────
  server.registerTool(
    "recent_scans",
    {
      title: "Recent Scans",
      description: "List the most recent contract scans performed by the Argus oracle.",
      inputSchema: {
        limit: z.number().int().min(1).max(50).default(10).describe("Number of recent scans (default 10)"),
      },
    },
    async ({ limit }) => {
      try {
        const scans = await recentScans(limit);
        return { content: [{ type: "text" as const, text: formatRecentScans(scans) }] };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Failed to fetch recent scans: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ── agent_elo ──────────────────────────────────────────────────
  server.registerTool(
    "agent_elo",
    {
      title: "Agent ELO Leaderboard",
      description:
        "Live ELO reputation scores for the three Argus agents (α, β, γ). Shows queries, win/loss records, and accuracy. Higher ELO = more accurate agent.",
    },
    async () => {
      try {
        const elo = await agentElo();
        return { content: [{ type: "text" as const, text: formatElo(elo) }] };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Failed to fetch ELO: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  // ── pool_stats ─────────────────────────────────────────────────
  server.registerTool(
    "pool_stats",
    {
      title: "Wallet Pool Stats",
      description: "Argus platform stats — assigned user wallets, available pre-created wallets, and total.",
    },
    async () => {
      try {
        const stats = await poolStats();
        return { content: [{ type: "text" as const, text: formatPoolStats(stats) }] };
      } catch (err: any) {
        return {
          content: [{ type: "text" as const, text: `Failed to fetch pool stats: ${err.message}` }],
          isError: true,
        };
      }
    }
  );

  return server;
}
