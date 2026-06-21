import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.join(__dirname, "..", ".env") });

async function main() {
  const c = initiateDeveloperControlledWalletsClient({
    apiKey: process.env.CIRCLE_API_KEY!,
    entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
  });

  const r: any = await c.listWallets({ walletSetId: process.env.WALLET_SET_ID! });
  console.log("Total count:", r.data?.total);
  console.log("Page size:", r.data?.wallets?.length);
  console.log("Has next page:", !!r.data?.nextPageToken);
  console.log("First 3:", r.data?.wallets?.slice(0,3).map((w:any)=>w.address));
  
  // If there's a next page, fetch it
  let allWallets = [...(r.data?.wallets ?? [])];
  let pageToken = r.data?.nextPageToken;
  while (pageToken) {
    const next: any = await c.listWallets({ walletSetId: process.env.WALLET_SET_ID!, pageToken });
    allWallets.push(...(next.data?.wallets ?? []));
    pageToken = next.data?.nextPageToken;
  }
  
  console.log(`Total after pagination: ${allWallets.length}`);

  // Only include unassigned wallets (no name, no refId)
  const unassigned = allWallets.filter((w: any) => !w.name && !w.refId);

  const poolFile = path.join(process.cwd(), "data", "wallet_pool.json");
  const pool = unassigned.map((w: any) => ({
    walletId: w.id,
    address: w.address,
    assigned: false,
    refId: null,
    assignedAt: null,
  }));

  fs.writeFileSync(poolFile, JSON.stringify(pool, null, 2));
  console.log(`Pool synced: ${pool.length} unassigned wallets`);
  pool.slice(0, 3).forEach((w: any) => console.log(" ", w.address));
}

main().catch((err) => { console.error(err.message); process.exit(1); });
