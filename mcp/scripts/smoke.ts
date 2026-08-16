// Smoke test — calls the live Argus backend through the MCP API layer
import { scanContract, recentScans, agentElo, poolStats } from "../src/api.js";
import { formatScanReport } from "../src/format.js";

async function main() {
  console.log("=== pool_stats ===");
  const pool = await poolStats();
  console.log(`assigned=${pool.assigned} available=${pool.available} total=${pool.total}`);

  console.log("\n=== recent_scans(3) ===");
  const recent = await recentScans(3);
  console.log(`got ${recent.length} scans`);

  console.log("\n=== agent_elo ===");
  const elo = await agentElo();
  console.log(elo.agents.map((a) => `${a.name}: ${a.elo}`).join(" | "));

  console.log("\n=== scan_contract (USDC) ===");
  const report = await scanContract("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "arc", 2);
  console.log(`verdict=${report.result.verdict} consensus=${report.result.agreementCount}/${report.result.totalAgents}`);
  console.log("\n--- formatted output (first 500 chars) ---");
  console.log(formatScanReport(report).slice(0, 500));
  console.log("\nSMOKE TEST PASSED");
  process.exit(0);
}

main().catch((err) => {
  console.error("SMOKE TEST FAILED:", err.message);
  process.exit(1);
});
