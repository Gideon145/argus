// Argus MCP — report formatting for LLM-friendly markdown
import type { ScanReport, RecentScan, EloResponse, PoolStats } from "./api.js";

export function formatScanReport(r: ScanReport): string {
  const res = r.result;
  const lines: string[] = [];

  lines.push(`# Argus Audit Report`);
  lines.push(``);
  lines.push(`**Contract:** \`${r.query.contractAddress}\``);
  lines.push(`**Chain:** ${r.query.chain}`);
  lines.push(``);
  lines.push(`## Verdict: ${res.verdict}`);
  lines.push(``);
  lines.push(`- Consensus: **${res.agreementCount}/${res.totalAgents} agents** (${res.confidence} confidence)`);
  if (res.settlementBatchId) lines.push(`- Settlement: \`${res.settlementBatchId}\``);
  if (r.payment?.txHash) lines.push(`- Payment tx: \`${r.payment.txHash}\``);
  lines.push(``);

  lines.push(`## Agent Breakdown`);
  lines.push(``);
  for (const a of res.agents) {
    lines.push(`### ${a.name} — ${a.verdict} (${a.confidence}%)`);
    lines.push(``);
    lines.push(a.reasoning.trim());
    lines.push(``);
  }

  if (res.winningAgents?.length) lines.push(`Winners: ${res.winningAgents.join(", ")}`);
  if (res.losingAgents?.length) lines.push(`Dissenters: ${res.losingAgents.join(", ")}`);

  return lines.join("\n");
}

export function formatRecentScans(scans: RecentScan[]): string {
  if (!scans.length) return "No recent scans.";
  const lines = [`# Recent Argus Scans (${scans.length})`, ``];
  for (const s of scans) {
    lines.push(`- \`${s.address}\` → **${s.verdict}** (${s.consensusVotes}) — ${s.timestamp}${s.txHash ? ` — tx \`${s.txHash.slice(0, 18)}...\`` : ""}`);
  }
  return lines.join("\n");
}

export function formatElo(elo: EloResponse): string {
  const lines = [`# Argus Agent ELO Leaderboard`, ``];
  const sorted = [...elo.agents].sort((a, b) => b.elo - a.elo);
  for (const a of sorted) {
    lines.push(`- **${a.name}** — ELO ${a.elo} · ${a.queries} queries · ${a.wins}W/${a.losses}L · ${a.accuracy}% accuracy`);
  }
  if (elo.lastUpdated) lines.push(``, `Last updated: ${elo.lastUpdated}`);
  return lines.join("\n");
}

export function formatPoolStats(s: PoolStats): string {
  return [
    `# Argus Wallet Pool`,
    ``,
    `- Assigned user wallets: **${s.assigned}**`,
    `- Available: **${s.available}**`,
    `- Total: **${s.total}**`,
    ...(s.live ? [``, `Live pool: ${s.live.total} wallets (${s.live.assigned} assigned, ${s.live.available} available)`] : []),
  ].join("\n");
}
