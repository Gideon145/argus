#!/usr/bin/env tsx
/**
 * Argus Benchmark Runner — v3 with Held-Out Evaluation
 * Runs two cohorts:
 *   (a) "known" — tokens present in agent lookup DB (dataset.json)
 *   (b) "held-out" — 20 new tokens NOT in any agent DB (heldout.json)
 * Verifies held-out addresses are absent from knownTokens.ts before scoring.
 * Writes results.json (known) + heldout-results.json (held-out).
 */

import * as fs from 'fs';
import * as path from 'path';
import { Orchestrator, QueryRequest } from '../agent/src/orchestrator';
import { KNOWN_TOKENS } from '../agent/src/agents/knownTokens';

interface DatasetEntry {
  address: string;
  label: string;
  source: string;
}

interface AgentVerdict {
  agent: string;
  verdict: string;
  confidence: number;
  reasoning: string;
}

interface BenchmarkResult {
  address: string;
  label: string;
  agents: AgentVerdict[];
  consensus: string;
  consensusCount: string;
  error?: string;
}

const DATASET_PATH = path.join(__dirname, 'dataset.json');
const HELDOUT_PATH = path.join(__dirname, 'heldout.json');
const OUTPUT_PATH = path.join(__dirname, 'results.json');
const HELDOUT_OUTPUT_PATH = path.join(__dirname, 'heldout-results.json');

/** Verify an address is NOT in any agent lookup DB */
function assertHeldOut(address: string): boolean {
  const normalized = address.toLowerCase();
  if (KNOWN_TOKENS[normalized]) {
    throw new Error(`HELD-OUT VIOLATION: ${address} found in knownTokens.ts`);
  }
  return true;
}

async function runCohort(
  name: string,
  dataset: DatasetEntry[],
  outputPath: string,
  orchestrator: Orchestrator,
  verifyHeldOut: boolean
): Promise<BenchmarkResult[]> {
  console.log(`\n=== ${name.toUpperCase()} COHORT: ${dataset.length} tokens ===\n`);

  const results: BenchmarkResult[] = [];

  for (let i = 0; i < dataset.length; i++) {
    const entry = dataset[i];
    process.stdout.write(`[${String(i + 1).padStart(2)}/${dataset.length}] ${entry.address.slice(0, 10)}... `);

    if (verifyHeldOut) {
      try {
        assertHeldOut(entry.address);
      } catch (err: any) {
        console.log(`VIOLATION: ${err.message}`);
        results.push({
          address: entry.address,
          label: entry.label,
          agents: [],
          consensus: 'HELD_OUT_VIOLATION',
          consensusCount: '0/3',
          error: err.message,
        });
        continue;
      }
    }

    try {
      const queryReq: QueryRequest = {
        contractAddress: entry.address,
        chain: 'arc',
        user: '0xBenchmarkUser000000000000000000000000000000',
      };

      const result = await orchestrator.processQuery(queryReq, 2);

      results.push({
        address: entry.address,
        label: entry.label,
        agents: result.agentVerdicts.map(v => ({
          agent: v.agent,
          verdict: v.verdict,
          confidence: v.confidence,
          reasoning: v.reasoning?.slice(0, 200) || '',
        })),
        consensus: result.finalVerdict,
        consensusCount: `${result.agreementCount}/${result.totalAgents}`,
      });

      console.log(`${result.finalVerdict} (${result.agreementCount}/${result.totalAgents})`);
    } catch (err: any) {
      results.push({
        address: entry.address,
        label: entry.label,
        agents: [],
        consensus: 'ERROR',
        consensusCount: '0/3',
        error: err.message?.slice(0, 200),
      });
      console.log(`ERROR: ${err.message?.slice(0, 80)}`);
    }

    if (i < dataset.length - 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n✅ ${name} results → ${outputPath}`);
  console.log(`   ${results.filter(r => r.consensus !== 'ERROR' && r.consensus !== 'HELD_OUT_VIOLATION').length}/${dataset.length} completed`);
  return results;
}

async function run() {
  const knownDataset: DatasetEntry[] = JSON.parse(fs.readFileSync(DATASET_PATH, 'utf8'));
  const heldoutDataset: DatasetEntry[] = JSON.parse(fs.readFileSync(HELDOUT_PATH, 'utf8'));

  console.log(`Argus Benchmark v3 — Known: ${knownDataset.length} | Held-out: ${heldoutDataset.length}\n`);

  console.log('Pre-flight: verifying held-out addresses are absent from knownTokens.ts...');
  let violations = 0;
  for (const entry of heldoutDataset) {
    try {
      assertHeldOut(entry.address);
    } catch (err: any) {
      console.error(`  ❌ ${err.message}`);
      violations++;
    }
  }
  if (violations > 0) {
    console.error(`\n❌ ${violations} held-out violations found. Fix heldout.json before running.`);
    process.exit(1);
  }
  console.log('  ✅ All 20 held-out addresses verified absent from knownTokens.ts\n');

  const config = {
    arcRpc: process.env.ARC_RPC_URL || 'https://rpc.testnet.arc-node.thecanteenapp.com',
    treasuryAddress: process.env.TREASURY_ADDRESS || '0x0699a029e2e05EC88d6418EC744232702Cf77d81',
    loopIntervalMs: 15000,
  };

  const orchestrator = new Orchestrator(config, console as any);

  await runCohort('known', knownDataset, OUTPUT_PATH, orchestrator, false);
  await runCohort('held-out', heldoutDataset, HELDOUT_OUTPUT_PATH, orchestrator, true);

  console.log('\n=== BENCHMARK COMPLETE ===');
  console.log(`  Known:     ${OUTPUT_PATH}`);
  console.log(`  Held-out:  ${HELDOUT_OUTPUT_PATH}`);
}

run().catch(e => {
  console.error('Benchmark failed:', e.message);
  process.exit(1);
});
