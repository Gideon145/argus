/**
 * Create 100 additional Circle SCA wallets and output as pool entries.
 * Run: npx tsx create-wallets.ts
 */
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
dotenv.config();

const apiKey = process.env.CIRCLE_API_KEY!;
const entitySecret = process.env.CIRCLE_ENTITY_SECRET!;
const walletSetId = process.env.WALLET_SET_ID!;

interface PoolEntry {
  walletId: string;
  address: string;
  assigned: boolean;
  refId: string | null;
  assignedAt: string | null;
}

async function main() {
  const client = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });
  
  console.log(`Creating 100 SCA wallets in set ${walletSetId}...`);
  
  // Circle API max per call is 50, so do 2 batches
  const allWallets: any[] = [];
  
  for (const count of [50, 50]) {
    const resp = await client.createWallets({
      walletSetId,
      blockchains: ["ARC-TESTNET"],
      count,
      accountType: "SCA",
    });
    const wallets = resp.data?.wallets ?? [];
    allWallets.push(...wallets);
    console.log(`  Batch: ${wallets.length} wallets created`);
  }
  
  const pool: PoolEntry[] = allWallets.map((w) => ({
    walletId: w.id!,
    address: w.address!,
    assigned: false,
    refId: null,
    assignedAt: null,
  }));
  
  // Save to a file so we can merge with Railway volume
  const outPath = path.join(__dirname, "new-wallets.json");
  fs.writeFileSync(outPath, JSON.stringify(pool, null, 2), "utf8");
  console.log(`\n✅ Created ${pool.length} wallets. Saved to ${outPath}`);
  console.log(`Sample: ${pool[0].address}`);
}

main().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
