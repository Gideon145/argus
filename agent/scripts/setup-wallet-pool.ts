/**
 * Setup script: creates wallet set + pre-creates a pool of SCA wallets on Arc testnet.
 * Run: npx tsx --env-file=.env scripts/setup-wallet-pool.ts
 */
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const apiKey = process.env.CIRCLE_API_KEY!;
const entitySecret = process.env.CIRCLE_ENTITY_SECRET!;

if (!apiKey || !entitySecret) {
  console.error("Missing CIRCLE_API_KEY or CIRCLE_ENTITY_SECRET in .env");
  process.exit(1);
}

const client = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });

const POOL_SIZE = 20; // Pre-create 20 wallets
const WALLET_SET_NAME = "Argus User Wallets";
const DATA_DIR = path.join(__dirname, "..", "data");
const POOL_FILE = path.join(DATA_DIR, "wallet_pool.json");

interface PoolEntry {
  walletId: string;
  address: string;
  assigned: boolean;
  refId: string | null;
  assignedAt: string | null;
}

async function main() {
  // 1. Check if wallet set already exists in env
  let walletSetId = process.env.WALLET_SET_ID;

  if (!walletSetId) {
    console.log("Creating wallet set:", WALLET_SET_NAME);
    const setResp = await client.createWalletSet({ name: WALLET_SET_NAME });
    walletSetId = setResp.data?.walletSet?.id;
    if (!walletSetId) throw new Error("Failed to create wallet set");
    console.log(`Wallet set created: ${walletSetId}`);

    // Save to .env
    const envPath = path.join(__dirname, "..", ".env");
    fs.appendFileSync(envPath, `\nWALLET_SET_ID=${walletSetId}\n`);
    console.log("WALLET_SET_ID added to .env");
  } else {
    console.log(`Using existing wallet set: ${walletSetId}`);
  }

  // 2. Pre-create wallets
  console.log(`\nPre-creating ${POOL_SIZE} SCA wallets on ARC-TESTNET...`);
  const walletResp = await client.createWallets({
    walletSetId,
    blockchains: ["ARC-TESTNET"],
    count: POOL_SIZE,
    accountType: "SCA",
    // No metadata — leaves wallets unassigned
  });

  const wallets = walletResp.data?.wallets ?? [];
  console.log(`Created ${wallets.length} wallets`);

  // 3. Build pool entries
  const pool: PoolEntry[] = wallets.map((w) => ({
    walletId: w.id!,
    address: w.address!,
    assigned: false,
    refId: null,
    assignedAt: null,
  }));

  // 4. Save pool file
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(POOL_FILE, JSON.stringify(pool, null, 2), "utf8");
  console.log(`Pool saved to ${POOL_FILE}`);
  console.log(`\nFirst 3 addresses:`);
  pool.slice(0, 3).forEach((w) => console.log(`  ${w.address} (${w.walletId.slice(0, 8)}...)`));

  console.log("\nDone! Wallet pool ready.");
  console.log("Next: deploy agent with new endpoints, then use POST /wallet/assign to assign wallets.");
}

main().catch((err) => {
  console.error("Setup failed:", err.message || err);
  process.exit(1);
});
