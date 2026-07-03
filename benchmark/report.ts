#!/usr/bin/env tsx
/**
 * Argus Benchmark Report
 * Computes confusion matrix, accuracy, precision, recall from results.json.
 * Generates markdown table for README.
 */

import * as fs from 'fs';
import * as path from 'path';

interface BenchmarkResult {
  address: string;
  label: string;
  agents: { agent: string; verdict: string; confidence: number }[];
  consensus: string;
  consensusCount: string;
  error?: string;
}

const RESULTS_PATH = path.join(__dirname, 'results.json');

function run() {
  if (!fs.existsSync(RESULTS_PATH)) {
    console.log('No results.json found. Run run-benchmark.ts first.');
    console.log('## Accuracy Evaluation');
    console.log('');
    console.log('*Benchmark pending. Run `npx tsx benchmark/run-benchmark.ts` to generate results.*');
    return;
  }

  const results: BenchmarkResult[] = JSON.parse(fs.readFileSync(RESULTS_PATH, 'utf8'));
  const valid = results.filter(r => r.consensus !== 'ERROR');

  // Treat RISKY + SCAM as positive class
  const isPositive = (label: string) => label === 'SCAM' || label === 'RISKY';
  const isSafe = (label: string) => label === 'SAFE';

  // Confusion matrix: predicted positive = RISKY or SCAM; predicted negative = SAFE
  let tp = 0, fp = 0, tn = 0, fn = 0;

  for (const r of valid) {
    const actualPositive = isPositive(r.label);
    const predictedPositive = r.consensus === 'RISKY' || r.consensus === 'SCAM';

    if (actualPositive && predictedPositive) tp++;
    else if (actualPositive && !predictedPositive) fn++;
    else if (!actualPositive && predictedPositive) fp++;
    else tn++;
  }

  const total = tp + fp + tn + fn;
  const accuracy = total > 0 ? ((tp + tn) / total * 100).toFixed(1) : '—';
  const precision = (tp + fp) > 0 ? ((tp / (tp + fp)) * 100).toFixed(1) : '—';
  const recall = (tp + fn) > 0 ? ((tp / (tp + fn)) * 100).toFixed(1) : '—';

  // Per-agent accuracy
  const agentStats: Record<string, { correct: number; total: number }> = {};
  for (const r of valid) {
    for (const a of r.agents) {
      if (!agentStats[a.agent]) agentStats[a.agent] = { correct: 0, total: 0 };
      agentStats[a.agent].total++;
      const agentPositive = a.verdict === 'RISKY' || a.verdict === 'SCAM';
      const actualPositive = isPositive(r.label);
      if (agentPositive === actualPositive) agentStats[a.agent].correct++;
    }
  }

  const errors = results.filter(r => r.consensus === 'ERROR').length;

  // Output markdown
  console.log('## Accuracy Evaluation');
  console.log('');
  console.log(`*${valid.length} tokens benchmarked against the real 3-agent pipeline. ${errors} errors excluded.*`);
  console.log('');
  console.log('| Metric | Value |');
  console.log('|--------|-------|');
  console.log(`| Tokens tested | ${valid.length} |`);
  console.log(`| Accuracy | ${accuracy}% |`);
  console.log(`| Precision | ${precision}% |`);
  console.log(`| Recall | ${recall}% |`);
  console.log(`| True Positives (caught scams) | ${tp} |`);
  console.log(`| False Positives (safe flagged risky) | ${fp} |`);
  console.log(`| True Negatives (safe confirmed safe) | ${tn} |`);
  console.log(`| False Negatives (scams missed) | ${fn} |`);
  console.log(`| Errors | ${errors} |`);
  console.log('');
  console.log('### Per-Agent Accuracy');
  console.log('');
  console.log('| Agent | Accuracy | Correct | Total |');
  console.log('|-------|----------|---------|-------|');
  for (const [agent, stats] of Object.entries(agentStats).sort()) {
    const acc = stats.total > 0 ? ((stats.correct / stats.total) * 100).toFixed(1) : '—';
    console.log(`| ${agent} | ${acc}% | ${stats.correct} | ${stats.total} |`);
  }
  console.log('');
  console.log(`*Benchmark data: [dataset.json](benchmark/dataset.json) · [results.json](benchmark/results.json) · Run: \`npx tsx benchmark/run-benchmark.ts\`*`);
}

run();
