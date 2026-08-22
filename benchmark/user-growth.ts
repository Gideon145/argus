#!/usr/bin/env tsx
/**
 * User Growth Counter
 * Reads wallet_pool.json assignedAt timestamps to compute
 * cumulative distinct user wallets by end-of-day for README growth table dates.
 * Excludes team wallets. Run on Railway where production data lives.
 * Usage: npx tsx benchmark/user-growth.ts
 */
import * as fs from 'fs';
import * as path from 'path';

// Repo root: use cwd when invoked from repo root; fallback to __dirname
const REPO_ROOT = fs.existsSync(path.join(process.cwd(), 'agent')) ? process.cwd() : path.resolve(__dirname || '', '..');
const DATA_DIR = fs.existsSync('/argus-data') ? '/argus-data' : path.join(REPO_ROOT, 'agent', 'data');
const POOL_FILE = path.join(DATA_DIR, 'wallet_pool.json');

console.log(`REPO_ROOT: ${REPO_ROOT}`);
console.log(`POOL_FILE: ${POOL_FILE}`);

const DATES = ['2026-06-16', '2026-06-18', '2026-06-21', '2026-06-25', '2026-06-29', '2026-07-01', '2026-07-03'];

const TEAM_ADDRESSES = new Set([
  '0x0699a029e2e05ec88d6418ec744232702cf77d81',
  '0x4dd5e289168ddb28f9b34134eabccaf373eb64cb',
  '0x07c8a0ceccf7af4f260bdcb02c464753887a8de7',
  '0x63d813f592957f12982c69e54a1dcb022982a556',
  '0x9083c68bf42f5ddf6c93bd45166ffcf9d4563baf',
  '0x5c0b33abc1c4df5e8f3a9b6c2d1e4f7a8b9c0d1e',
  '0x7d4897bc2d4e6f8a0b1c3d5e7f9a2b4c6d8e0f1',
  '0x43e063c3d5f7a9b1d3f5e7a9c1e3f5a7b9d1f3',
]);

interface PoolEntry {
  address: string;
  assigned: boolean;
  assignedAt: string | null;
  refId: string | null;
}

function run() {
  console.log(`POOL_FILE: ${POOL_FILE}`);
  console.log(`exists: ${fs.existsSync(POOL_FILE)}`);
  if (!fs.existsSync(POOL_FILE)) {
    console.log('wallet_pool.json not found. User counts require Railway production data.');
    return;
  }

  const pool: PoolEntry[] = JSON.parse(fs.readFileSync(POOL_FILE, 'utf8'));
  const assigned = pool.filter(e => e.assigned && e.assignedAt && !TEAM_ADDRESSES.has(e.address.toLowerCase()));

  console.log(`Total pool: ${pool.length} | Assigned (non-team): ${assigned.length}`);

  for (const date of DATES) {
    const count = assigned.filter(e => e.assignedAt!.slice(0, 10) <= date).length;
    console.log(`${date}: ${count} users`);
  }
}

run();
