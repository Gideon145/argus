import { Verdict, ConsensusResult } from './orchestrator';
import fs from 'fs';
import path from 'path';
import { writeEloToChain } from './payments/chainElo';

/**
 * ELO reputation engine (SYMBIOSIS pattern)
 * K=64 for new agents (<30 queries), K=32 for veterans
 * Agents gain ELO when they agree with consensus.
 * Agents lose ELO when they dissent.
 * In-memory store persists across queries within a session.
 */

// Persistent ELO store (falls back to in-memory defaults)
const DATA_DIR = fs.existsSync('/argus-data') ? '/argus-data' : path.join(process.cwd(), 'data');
const ELO_FILE = path.join(DATA_DIR, 'elo_store.json');

const DEFAULT_STORE: Record<string, { elo: number; queries: number; wins: number; losses: number }> = {
  'Agent-α': { elo: 1200, queries: 0, wins: 0, losses: 0 },
  'Agent-β': { elo: 1200, queries: 0, wins: 0, losses: 0 },
  'Agent-γ': { elo: 1200, queries: 0, wins: 0, losses: 0 },
};

// Historical baseline ELO — prevents reset to 1200 on redeploy
const BASELINE_ELO: Record<string, { elo: number; queries: number; wins: number; losses: number }> = {
  'Agent-α': { elo: 18157, queries: 1060, wins: 1059, losses: 1 },
  'Agent-β': { elo: 18162, queries: 1060, wins: 1058, losses: 2 },
  'Agent-γ': { elo: 17996, queries: 1060, wins: 988, losses: 72 },
};

function loadStore(): Record<string, { elo: number; queries: number; wins: number; losses: number }> {
  try {
    if (fs.existsSync(ELO_FILE)) {
      const raw = fs.readFileSync(ELO_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      // Merge baseline: use stored values if higher, otherwise baseline
      const merged = { ...DEFAULT_STORE };
      for (const [k, v] of Object.entries(BASELINE_ELO)) {
        merged[k] = {
          elo: Math.max(v.elo, parsed[k]?.elo || 0),
          queries: Math.max(v.queries, parsed[k]?.queries || 0),
          wins: Math.max(v.wins, parsed[k]?.wins || 0),
          losses: Math.max(v.losses, parsed[k]?.losses || 0),
        };
      }
      return merged;
    }
  } catch (e: any) {
    console.warn('Failed to load elo store:', e.message || e);
  }
  return { ...BASELINE_ELO };
}

function saveStore(store: Record<string, { elo: number; queries: number; wins: number; losses: number }>) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(ELO_FILE, JSON.stringify(store, null, 2), 'utf8');
  } catch (e: any) {
    console.warn('Failed to save elo store:', e.message || e);
  }
}

const eloStore = loadStore();

export function getEloStore() {
  return eloStore;
}

export async function updateReputation(
  verdicts: Verdict[],
  result: ConsensusResult
): Promise<string[]> {
  const txHashes: string[] = [];
  if (!result.consensusReached) return txHashes;

  // Compute pairwise expected scores vs other agents and apply averaged update
  const agents = Object.keys(eloStore);
  for (const v of verdicts) {
    const agent = v.agent;
    if (!eloStore[agent]) eloStore[agent] = { elo: 1200, queries: 0, wins: 0, losses: 0 };
    const record = eloStore[agent];
    record.queries++;

    // Expected score: average of pairwise expectations
    let expectedSum = 0;
    let opponents = 0;
    for (const opp of agents) {
      if (opp === agent) continue;
      const diff = (eloStore[opp].elo - record.elo) / 400;
      const exp = 1 / (1 + Math.pow(10, diff));
      expectedSum += exp;
      opponents++;
    }
    const expectedScore = opponents > 0 ? expectedSum / opponents : 0.5;
    const actualScore = result.winningAgents.includes(agent) ? 1.0 : 0.0;
    const K = record.queries < 30 ? 64 : 32;
    const eloDelta = Math.round(K * (actualScore - expectedScore));

    record.elo += eloDelta;
    if (actualScore === 1.0) record.wins++; else record.losses++;

    console.log(`[ELO] ${agent}: ${actualScore === 1.0 ? '+' : ''}${eloDelta} -> ${record.elo} (${record.wins}W/${record.losses}L)`);

    // Write ELO to on-chain ArgusOracle and capture the real TX hash
    const txHash = await writeEloToChain(agent, eloDelta).catch(() => null);
    if (txHash) txHashes.push(txHash);
  }

  // Persist store after update
  try { saveStore(eloStore); } catch (e) { /* already warned in saveStore */ }
  return txHashes;
}
