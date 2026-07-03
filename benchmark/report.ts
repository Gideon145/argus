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
  // Single source of truth for accuracy/precision/recall.
  // Positive class = SCAM. RISKY on SAFE-labeled token = INCORRECT.
  // RISKY on SCAM-labeled token = CORRECT.
  const valid = results.filter(r => r.consensus !== 'ERROR' && r.consensus !== 'HELD_OUT_VIOLATION');
  const abstained = results.filter(r => r.consensus === 'INSUFFICIENT_DATA');
  const scored = valid.filter(r => r.consensus !== 'INSUFFICIENT_DATA');

  const isPositive = (label: string) => label === 'SCAM' || label === 'RISKY';

  let tp = 0, fp = 0, tn = 0, fn = 0;
  for (const r of scored) {
    const actualPositive = isPositive(r.label);
    const predictedPositive = r.consensus === 'RISKY' || r.consensus === 'SCAM';
    if (actualPositive && predictedPositive) tp++;
    else if (actualPositive && !predictedPositive) fn++;
    else if (!actualPositive && predictedPositive) fp++;
    else tn++;
  }

  const total = tp + fp + tn + fn;
  const coverage = valid.length > 0 ? ((scored.length / valid.length) * 100).toFixed(1) : '—';
  const accuracy = total > 0 ? ((tp + tn) / total * 100).toFixed(1) : '—';
  const precision = (tp + fp) > 0 ? ((tp / (tp + fp)) * 100).toFixed(1) : '—';
  const recall = (tp + fn) > 0 ? ((tp / (tp + fn)) * 100).toFixed(1) : '—';

  // Inter-agent disagreement rate
  let disagreementCount = 0;
  for (const r of scored) {
    const verdicts = r.agents.map(a => a.verdict);
    if (new Set(verdicts).size > 1) disagreementCount++;
  }
  const disagreementRate = scored.length > 0 ? ((disagreementCount / scored.length) * 100).toFixed(1) : '—';
  if (disagreementCount === 0 && scored.length > 0) {
    console.warn(`⚠️  WARNING: 0% inter-agent disagreement across ${scored.length} scored tokens — agents may not be producing independent analyses`);
  }

  const agentStats: Record<string, { correct: number; total: number }> = {};
  for (const r of scored) {
    for (const a of r.agents) {
      if (a.verdict === 'INSUFFICIENT_DATA') continue;
      if (!agentStats[a.agent]) agentStats[a.agent] = { correct: 0, total: 0 };
      agentStats[a.agent].total++;
      const agentPositive = a.verdict === 'RISKY' || a.verdict === 'SCAM';
      const labelPositive = isPositive(r.label);
      if (agentPositive === labelPositive) agentStats[a.agent].correct++;
    }
  }

  return { accuracy, precision, recall, tp, fp, tn, fn, total, coverage, abstentionCount: abstained.length, disagreementRate, agentStats, errors: results.length - valid.length };
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
    console.log(`| Coverage (data fetched) | ${m.coverage}% |`);
    console.log(`| Abstentions (no data) | ${m.abstentionCount} |`);
    console.log(`| Accuracy (on scored) | ${m.accuracy}% |`);
    console.log(`| Precision | ${m.precision}% |`);
    console.log(`| Recall | ${m.recall}% |`);
    console.log(`| Scams caught | ${m.tp}/${m.tp + m.fn} |`);
    console.log(`| Safe confirmed | ${m.tn}/${m.tn + m.fp} |`);
    console.log(`| Disagreement rate | ${m.disagreementRate}% |`);
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
