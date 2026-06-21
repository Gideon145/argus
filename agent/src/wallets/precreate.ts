/**
 * User wallet pool — pre-created Circle SCA wallets, assigned on demand.
 * Users get a wallet instantly, no MetaMask needed.
 */
import { initiateDeveloperControlledWalletsClient } from "@circle-fin/developer-controlled-wallets";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config();

const DATA_DIR = fs.existsSync("/argus-data") ? "/argus-data" : path.join(process.cwd(), "data");
const POOL_FILE = path.join(DATA_DIR, "wallet_pool.json");

interface PoolEntry {
  walletId: string;
  address: string;
  assigned: boolean;
  refId: string | null;
  assignedAt: string | null;
}

let client: ReturnType<typeof initiateDeveloperControlledWalletsClient> | null = null;

function getClient() {
  if (!client) {
    const apiKey = process.env.CIRCLE_API_KEY;
    const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
    if (!apiKey || !entitySecret) {
      throw new Error("CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET required for wallet pool");
    }
    client = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });
  }
  return client;
}

function loadPool(): PoolEntry[] {
  try {
    if (fs.existsSync(POOL_FILE)) {
      return JSON.parse(fs.readFileSync(POOL_FILE, "utf8"));
    }
  } catch {}
  return [];
}

function savePool(pool: PoolEntry[]): void {
  const dir = path.dirname(POOL_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(POOL_FILE, JSON.stringify(pool, null, 2), "utf8");
}

export const walletPool = {
  /** Auto-initialize pool on startup if empty */
  async initIfEmpty(): Promise<void> {
    const pool = loadPool();
    if (pool.length > 0) {
      console.log(`[WalletPool] Loaded ${pool.length} wallets (${pool.filter(w => !w.assigned).length} available)`);
      return;
    }

    const walletSetId = process.env.WALLET_SET_ID;
    if (!walletSetId) {
      console.warn("[WalletPool] WALLET_SET_ID not set — skipping auto-init");
      return;
    }

    console.log("[WalletPool] Empty pool — auto-creating 20 wallets...");
    try {
      const c = getClient();
      const resp = await c.createWallets({
        walletSetId,
        blockchains: ["ARC-TESTNET"],
        count: 20,
        accountType: "SCA",
      });

      const wallets = resp.data?.wallets ?? [];
      const newPool: PoolEntry[] = wallets.map((w) => ({
        walletId: w.id!,
        address: w.address!,
        assigned: false,
        refId: null,
        assignedAt: null,
      }));
      savePool(newPool);
      console.log(`[WalletPool] Auto-created ${newPool.length} wallets`);
    } catch (err: any) {
      console.error("[WalletPool] Auto-init failed:", err.message);
    }
  },

  /** Assign an unassigned wallet to a user. Returns the wallet address. */
  async assign(refId: string): Promise<{ address: string; walletId: string } | null> {
    const pool = loadPool();
    const entry = pool.find((w) => !w.assigned);
    if (!entry) return null; // No wallets left

    // Assign via Circle API
    const c = getClient();
    await c.updateWallet({
      id: entry.walletId,
      name: `User ${refId.slice(0, 8)}`,
      refId,
    });

    // Mark assigned locally
    entry.assigned = true;
    entry.refId = refId;
    entry.assignedAt = new Date().toISOString();
    savePool(pool);

    console.log(`[WalletPool] Assigned ${entry.address.slice(0, 10)}... to user ${refId.slice(0, 8)}...`);
    return { address: entry.address, walletId: entry.walletId };
  },

  /** Get user's wallet by refId */
  getByRefId(refId: string): PoolEntry | null {
    const pool = loadPool();
    return pool.find((w) => w.refId === refId) ?? null;
  },

  /** Get wallet by address */
  getByAddress(address: string): PoolEntry | null {
    const pool = loadPool();
    return pool.find((w) => w.address.toLowerCase() === address.toLowerCase()) ?? null;
  },

  /** How many wallets are still available */
  available(): number {
    const pool = loadPool();
    return pool.filter((w) => !w.assigned).length;
  },

  /** Stats about the pool */
  stats() {
    const pool = loadPool();
    return {
      total: pool.length,
      assigned: pool.filter((w) => w.assigned).length,
      available: pool.filter((w) => !w.assigned).length,
    };
  },

  /** Top up the pool with more wallets */
  async topUp(count: number = 10): Promise<number> {
    const walletSetId = process.env.WALLET_SET_ID;
    if (!walletSetId) throw new Error("WALLET_SET_ID not configured");

    const c = getClient();
    const resp = await c.createWallets({
      walletSetId,
      blockchains: ["ARC-TESTNET"],
      count,
      accountType: "SCA",
    });

    const newWallets = resp.data?.wallets ?? [];
    const pool = loadPool();

    for (const w of newWallets) {
      pool.push({
        walletId: w.id!,
        address: w.address!,
        assigned: false,
        refId: null,
        assignedAt: null,
      });
    }

    savePool(pool);
    console.log(`[WalletPool] Topped up ${newWallets.length} wallets`);
    return newWallets.length;
  },
};
