#!/usr/bin/env tsx
/**
 * Argus Benchmark Runner
 * Runs all 40 labeled tokens through the real 3-agent pipeline.
 * Writes results.json with per-address verdicts from α, β, γ and consensus.
 */

import * as fs from 'fs';
import * as path from 'path';
import { Orchestrator, QueryRequest } from '../agent/src/orchestrator';

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
const OUTPUT_PATH = path.join(__dirname, 'results.json');

async function run() {
  const dataset: DatasetEntry[] = JSON.parse(fs.readFileSync(DATASET_PATH, 'utf8'));
  console.log(`Running benchmark on ${dataset.length} tokens...\n`);

  const config = {
    arcRpc: process.env.ARC_RPC_URL || 'https://rpc.testnet.arc-node.thecanteenapp.com',
    treasuryAddress: process.env.TREASURY_ADDRESS || '0x0699a029e2e05EC88d6418EC744232702Cf77d81',
    loopIntervalMs: 15000,
  };

  const orchestrator = new Orchestrator(config, console as any);
  const results: BenchmarkResult[] = [];

  for (let i = 0; i < dataset.length; i++) {
    const entry = dataset[i];
    process.stdout.write(`[${String(i + 1).padStart(2)}/${dataset.length}] ${entry.address.slice(0, 10)}... `);

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

    // Rate limit: 2s between queries to avoid LLM rate limits
    if (i < dataset.length - 1) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2));
  console.log(`\n✅ Results written to ${OUTPUT_PATH}`);
  console.log(`   ${results.filter(r => r.consensus !== 'ERROR').length}/${dataset.length} completed successfully`);
}

run().catch(e => {
  console.error('Benchmark failed:', e.message);
  process.exit(1);
});
