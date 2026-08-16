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
