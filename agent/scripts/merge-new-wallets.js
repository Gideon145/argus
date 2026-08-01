// Merge 100 new wallets into the live pool on Railway volume
// Run via: railway run "node /argus-data/merge-new-wallets.js"
const fs = require('fs');

const POOL = '/argus-data/wallet_pool.json';
const NEW = '/argus-data/new-wallets.json';

if (!fs.existsSync(NEW)) {
  console.error('new-wallets.json not found at ' + NEW);
  process.exit(1);
}

if (!fs.existsSync(POOL)) {
  console.error('wallet_pool.json not found at ' + POOL);
  process.exit(1);
}

try {
  const pool = JSON.parse(fs.readFileSync(POOL, 'utf8'));
  const nw = JSON.parse(fs.readFileSync(NEW, 'utf8'));
  const before = pool.length;
  pool.push(...nw);
  fs.writeFileSync(POOL, JSON.stringify(pool, null, 2), 'utf8');
  console.log('Merged: ' + before + ' + ' + nw.length + ' = ' + pool.length + ' wallets');
  fs.unlinkSync(NEW);
  console.log('Cleaned up new-wallets.json');
} catch (e) {
  console.error('Merge failed:', e.message);
  process.exit(1);
}
