// Argus MCP — streamable HTTP entrypoint (Smithery, remote MCP clients)
import express from "express";
import cors from "cors";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createArgusServer } from "./server.js";
import { ARGUS_API_URL } from "./api.js";

const PORT = parseInt(process.env.PORT || "8080", 10);

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    service: "argus-mcp",
    name: "Argus — Multi-Agent Security Oracle",
    endpoint: "/mcp",
    docs: "https://github.com/Gideon145/argus/tree/master/mcp",
    live: "https://argusarc.dev",
  });
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", backend: ARGUS_API_URL });
});

// OpenAPI spec for ChatGPT Actions (Custom GPT) — describes the Argus REST API
const BACKEND_URL = "https://argus-web-backend-production.up.railway.app";
app.get("/openapi.json", (_req, res) => {
  res.json({
    openapi: "3.1.0",
    info: {
      title: "Argus — Multi-Agent Security Oracle",
      description:
        "Audit any EVM smart contract with three independent AI agents (DeepSeek-V3, Claude, rules engine). Returns a consensus verdict: SAFE, RISKY, or SCAM, with per-agent confidence and reasoning.",
      version: "1.0.0",
    },
    servers: [{ url: BACKEND_URL }],
    paths: {
      "/debug/scan": {
        post: {
          operationId: "scanContract",
          summary: "Scan a smart contract address (3-agent consensus audit)",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    contractAddress: { type: "string", description: "EVM contract address to audit (0x...)" },
                    chain: { type: "string", description: "Chain (default: arc)", default: "arc" },
                    threshold: { type: "integer", description: "Consensus threshold (2 or 3)", default: 2 },
                  },
                  required: ["contractAddress"],
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Audit report with verdict and per-agent analysis",
              content: {
                "application/json": {
                  schema: { type: "object" },
                },
              },
            },
          },
        },
      },
      "/recent-scans": {
        get: {
          operationId: "getRecentScans",
          summary: "List recent contract scans",
          parameters: [
            { name: "limit", in: "query", schema: { type: "integer", default: 10 }, description: "Number of scans (max 50)" },
          ],
          responses: {
            "200": { description: "Recent scans", content: { "application/json": { schema: { type: "array", items: { type: "object" } } } } },
          },
        },
      },
      "/elo": {
        get: {
          operationId: "getAgentElo",
          summary: "Live ELO reputation leaderboard for the three Argus agents",
          responses: {
            "200": { description: "Agent ELO leaderboard", content: { "application/json": { schema: { type: "object" } } } },
          },
        },
      },
    },
  });
});

// Stateless streamable-HTTP MCP endpoint
app.post("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless — Smithery & remote clients friendly
    enableJsonResponse: true,
  });
  const server = createArgusServer();
  res.on("close", () => {
    transport.close().catch(() => {});
    server.close().catch(() => {});
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err: any) {
    console.error("[argus-mcp/http] error:", err.message);
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: err.message }, id: null });
    }
  }
});

app.listen(PORT, () => {
  console.error(`[argus-mcp] HTTP transport listening on :${PORT} → POST /mcp (backend: ${ARGUS_API_URL})`);
});
