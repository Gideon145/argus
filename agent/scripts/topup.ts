import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const POOL_FILE = path.join(process.cwd(), "data", "wallet_pool.json");

async function main() {
  const c = initiateDeveloperControlledWalletsClient({
    apiKey: process.env.CIRCLE_API_KEY!,
    entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
  });

  const count = parseInt(process.argv[2] || "30");
  console.log(`Creating ${count} wallets...`);

  const r = await c.createWallets({
    walletSetId: process.env.WALLET_SET_ID!,
    blockchains: ["ARC-TESTNET"],
    count,
    accountType: "SCA",
  });

  const newWallets = r.data?.wallets ?? [];
  console.log(`Created ${newWallets.length} wallets`);

  // Load existing pool
  let pool: any[] = [];
  try {
    if (fs.existsSync(POOL_FILE)) {
      pool = JSON.parse(fs.readFileSync(POOL_FILE, "utf8"));
    }
  } catch {}

  // Append new wallets
  for (const w of newWallets) {
    pool.push({
      walletId: w.id!,
      address: w.address!,
      assigned: false,
      refId: null,
      assignedAt: null,
    });
  }

  // Save
  const dir = path.dirname(POOL_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(POOL_FILE, JSON.stringify(pool, null, 2), "utf8");

  const available = pool.filter((w: any) => !w.assigned).length;
  console.log(`Pool now: ${pool.length} total, ${available} available`);
}

main().catch((err) => { console.error(err.message); process.exit(1); });
