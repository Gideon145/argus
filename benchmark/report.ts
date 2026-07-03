#!/usr/bin/env tsx
/**
 * Argus Benchmark Report — v3 with Held-Out Evaluation
 * Generates confusion matrix + per-agent accuracy for both cohorts.
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
const HELDOUT_RESULTS_PATH = path.join(__dirname, 'heldout-results.json');

function computeMetrics(results: BenchmarkResult[], cohortName: string) {
  const valid = results.filter(r => r.consensus !== 'ERROR' && r.consensus !== 'HELD_OUT_VIOLATION');

  const isPositive = (label: string) => label === 'SCAM' || label === 'RISKY';

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

  const agentStats: Record<string, { correct: number; total: number }> = {};
  for (const r of valid) {
    for (const a of r.agents) {
      if (!agentStats[a.agent]) agentStats[a.agent] = { correct: 0, total: 0 };
      agentStats[a.agent].total++;
      // Agent is correct if its verdict matches the label direction
      const agentPositive = a.verdict === 'RISKY' || a.verdict === 'SCAM';
      const labelPositive = isPositive(r.label);
      if (agentPositive === labelPositive) agentStats[a.agent].correct++;
    }
  }

  return { accuracy, precision, recall, tp, fp, tn, fn, total, agentStats, errors: results.length - valid.length };
}

function run() {
  const hasKnown = fs.existsSync(RESULTS_PATH);
  const hasHeldout = fs.existsSync(HELDOUT_RESULTS_PATH);

  if (!hasKnown && !hasHeldout) {
    console.log('## Accuracy Evaluation');
    console.log('\n*Benchmark pending. Run `npx tsx benchmark/run-benchmark.ts`.*');
    return;
  }

  console.log('## Accuracy Evaluation\n');
  console.log('*60 tokens (40 known + 20 held-out) benchmarked against the real 3-agent pipeline.*\n');

  // Known cohort
  if (hasKnown) {
    const results: BenchmarkResult[] = JSON.parse(fs.readFileSync(RESULTS_PATH, 'utf8'));
    const m = computeMetrics(results, 'known');
    console.log('### Known Tokens (database-backed)\n');
    console.log(`| Metric | Value |`);
    console.log(`|--------|-------|`);
    console.log(`| Tokens tested | ${m.total} |`);
    console.log(`| Accuracy | ${m.accuracy}% |`);
    console.log(`| Precision | ${m.precision}% |`);
    console.log(`| Recall | ${m.recall}% |`);
    console.log(`| Scams caught | ${m.tp}/${m.tp + m.fn} |`);
    console.log(`| Safe confirmed | ${m.tn}/${m.tn + m.fp} |`);
    console.log(`| Errors | ${m.errors} |\n`);
  }

  // Held-out cohort
  if (hasHeldout) {
    const results: BenchmarkResult[] = JSON.parse(fs.readFileSync(HELDOUT_RESULTS_PATH, 'utf8'));
    const m = computeMetrics(results, 'held-out');
    console.log('### Held-Out Tokens (generalization — no DB entries)\n');
    console.log(`| Metric | Value |`);
    console.log(`|--------|-------|`);
    console.log(`| Tokens tested | ${m.total} |`);
    console.log(`| Accuracy | ${m.accuracy}% |`);
    console.log(`| Precision | ${m.precision}% |`);
    console.log(`| Recall | ${m.recall}% |`);
    console.log(`| Scams caught | ${m.tp}/${m.tp + m.fn} |`);
    console.log(`| Safe confirmed | ${m.tn}/${m.tn + m.fp} |`);
    console.log(`| Errors | ${m.errors} |\n`);

    if (Object.keys(m.agentStats).length > 0) {
      console.log('#### Per-Agent Accuracy (Held-Out)\n');
      console.log(`| Agent | Accuracy | Correct | Total |`);
      console.log(`|-------|----------|---------|-------|`);
      for (const [agent, stats] of Object.entries(m.agentStats)) {
        const acc = stats.total > 0 ? ((stats.correct / stats.total) * 100).toFixed(1) : '—';
        console.log(`| ${agent} | ${acc}% | ${stats.correct} | ${stats.total} |`);
      }
      console.log('');
    }
  }

  console.log(`*Known: [dataset.json](benchmark/dataset.json) · Held-out: [heldout.json](benchmark/heldout.json) · Run: \`npx tsx benchmark/run-benchmark.ts\`*`);
}

run();
