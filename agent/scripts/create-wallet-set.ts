// One-off: create a new wallet set under the new entity secret
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.join(__dirname, "..", ".env") });

async function main() {
  const client = initiateDeveloperControlledWalletsClient({
    apiKey: process.env.CIRCLE_API_KEY!,
    entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
  });

  const res = await client.createWalletSet({ name: "Argus User Pool v2" });
  const walletSet = res.data?.walletSet;
  console.log("WALLET_SET_ID=" + walletSet?.id);
  console.log("Full response:", JSON.stringify(res.data, null, 2));
}

main().catch((err) => {
  console.error("Error:", err.message || err);
  process.exit(1);
});
