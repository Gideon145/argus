// MCP protocol smoke test — spawns the built server and speaks JSON-RPC over stdio
import { spawn } from "node:child_process";

const child = spawn("node", ["dist/index.js"], { cwd: process.cwd(), stdio: ["pipe", "pipe", "pipe"] });

let buf = "";
const pending = new Map();
let nextId = 1;

child.stdout.on("data", (d) => {
  buf += d.toString();
  let idx;
  while ((idx = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (!line) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    } catch {}
  }
});
child.stderr.on("data", (d) => process.stderr.write("[server] " + d));

function send(method, params) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, resolve);
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`timeout waiting for ${method}`));
      }
    }, 120000);
  });
}

async function main() {
  const init = await send("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "smoke", version: "1.0" },
  });
  console.log("INIT OK — server:", init.result.serverInfo.name, init.result.serverInfo.version);

  await send("notifications/initialized", {}).catch(() => {});

  const tools = await send("tools/list", {});
  console.log("TOOLS:", tools.result.tools.map((t) => t.name).join(", "));

  const call = await send("tools/call", {
    name: "scan_contract",
    arguments: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
  });
  const text = call.result.content?.[0]?.text || "";
  console.log("CALL OK — verdict line:", text.split("\n").find((l) => l.includes("Verdict")));
  console.log("isError:", call.result.isError ?? false);

  const bad = await send("tools/call", {
    name: "scan_contract",
    arguments: { address: "not-an-address" },
  });
  console.log("BAD ADDR → isError:", bad.result.isError ?? false);

  console.log("MCP PROTOCOL TEST PASSED");
  child.kill();
  process.exit(0);
}

main().catch((err) => {
  console.error("MCP PROTOCOL TEST FAILED:", err.message);
  child.kill();
  process.exit(1);
});
