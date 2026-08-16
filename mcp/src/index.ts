#!/usr/bin/env node
// Argus MCP — stdio entrypoint (Claude Desktop, ChatGPT connectors, Cursor)
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createArgusServer } from "./server.js";
import { ARGUS_API_URL } from "./api.js";

async function main() {
  const server = createArgusServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[argus-mcp] connected to ${ARGUS_API_URL} (stdio)`);
}

main().catch((err) => {
  console.error("[argus-mcp] fatal:", err);
  process.exit(1);
});