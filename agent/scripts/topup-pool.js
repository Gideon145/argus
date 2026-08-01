// Create 100 new SCA wallets and append to the existing pool on Railway.
// Run via: railway run "node"
// Pipe this file content to it.
const { initiateDeveloperControlledWalletsClient } = require("@circle-fin/developer-controlled-wallets");
const fs = require("fs");

const POOL = "/argus-data/wallet_pool.json";
const apiKey = process.env.CIRCLE_API_KEY;
const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
const walletSetId = process.env.WALLET_SET_ID;

async function main() {
  const client = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });

  // Load existing pool
  let pool = [];
  try { pool = JSON.parse(fs.readFileSync(POOL, 'utf8')); } catch(e) {}
  const beforeCount = pool.length;

  // Create 100 wallets in 2 batches
  const all = [];
  for (let i = 0; i < 2; i++) {
    const resp = await client.createWallets({
      walletSetId,
      blockchains: ["ARC-TESTNET"],
      count: 50,
      accountType: "SCA",
    });
    const wallets = resp.data?.wallets ?? [];
    for (const w of wallets) {
      all.push({ walletId: w.id, address: w.address, assigned: false, refId: null, assignedAt: null });
    }
    console.log('Batch ' + (i+1) + ': ' + wallets.length + ' wallets');
  }

  // Merge
  pool.push(...all);
  fs.writeFileSync(POOL, JSON.stringify(pool, null, 2), 'utf8');
  console.log('Done: ' + beforeCount + ' + ' + all.length + ' = ' + pool.length + ' wallets');
}

main().catch(e => { console.error(e.message); process.exit(1); });
