/**
 * Merge new wallets into the live pool on Railway volume.
 * Run via: railway run "node merge-pool.js"
 */
const fs = require('fs');
const path = require('path');

const POOL_PATH = '/argus-data/wallet_pool.json';
const NEW_WALLETS_PATH = path.join(__dirname, 'new-wallets.json');

// Load existing pool
let pool = [];
try {
  pool = JSON.parse(fs.readFileSync(POOL_PATH, 'utf8'));
} catch (e) {
  console.error('Failed to read pool:', e.message);
  process.exit(1);
}

// Load new wallets
let newWallets = [];
try {
  newWallets = JSON.parse(fs.readFileSync(NEW_WALLETS_PATH, 'utf8'));
} catch (e) {
  console.error('Failed to read new wallets:', e.message);
  process.exit(1);
}

const before = pool.length;
pool.push(...newWallets);

// Write back
fs.writeFileSync(POOL_PATH, JSON.stringify(pool, null, 2), 'utf8');
console.log(`Merged: ${before} + ${newWallets.length} = ${pool.length} wallets`);
