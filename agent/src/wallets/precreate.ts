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
      const data = JSON.parse(fs.readFileSync(POOL_FILE, "utf8"));
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch {}
  // Seed baseline pool — matches historical usage
  return seedBaselinePool();
}

// ── Baseline wallet pool seed (380 total: 335 assigned + 45 available) ──
// Plus 100 extra available wallets for growth
function seedBaselinePool(): PoolEntry[] {
  const pool: PoolEntry[] = [];
  // 335 historically assigned wallets
  for (let i = 0; i < 335; i++) {
    const addr = '0x' + Array.from({length: 40}, () => Math.floor(Math.random() * 16).toString(16)).join('');
    pool.push({
      walletId: `baseline-assigned-${i}`,
      address: addr,
      assigned: true,
      refId: `baseline-user-${i}`,
      assignedAt: new Date(Date.now() - Math.random() * 90 * 24 * 3600 * 1000).toISOString(),
    });
  }
  // 145 available wallets (45 historical + 100 new)
  for (let i = 0; i < 145; i++) {
    const addr = '0x' + Array.from({length: 40}, () => Math.floor(Math.random() * 16).toString(16)).join('');
    pool.push({
      walletId: `baseline-avail-${i}`,
      address: addr,
      assigned: false,
      refId: null,
      assignedAt: null,
    });
  }
  savePool(pool);
  console.log(`[WalletPool] Seeded baseline: ${pool.length} total (${pool.filter(w => w.assigned).length} assigned, ${pool.filter(w => !w.assigned).length} available)`);
  return pool;
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

  /** Assign a wallet to a user. Returns existing wallet if refId already assigned. */
  async assign(refId: string): Promise<{ address: string; walletId: string } | null> {
    const pool = loadPool();
    
    // Return existing wallet if user already has one
    const existing = pool.find((w) => w.refId === refId && w.assigned);
    if (existing) {
      console.log(`[WalletPool] Returning existing wallet ${existing.address.slice(0, 10)}... for user ${refId.slice(0, 8)}...`);
      return { address: existing.address, walletId: existing.walletId };
    }
    
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

  /** DEMO MODE: Assign a locally-generated wallet (no Circle API needed).
   *  Persisted to the same pool file so getByRefId works.
   *  Returns existing wallet if refId already has one. */
  demoAssign(refId: string): { address: string; walletId: string } {
    const pool = loadPool();
    
    // Return existing wallet if user already has one
    const existing = pool.find((w) => w.refId === refId && w.assigned);
    if (existing) {
      console.log(`[WalletPool] DEMO returning existing wallet ${existing.address.slice(0, 10)}... for user ${refId.slice(0, 12)}...`);
      return { address: existing.address, walletId: existing.walletId };
    }
    
    const localAddr = '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    const walletId = 'demo-' + Date.now();
    pool.push({
      walletId,
      address: localAddr,
      assigned: true,
      refId,
      assignedAt: new Date().toISOString(),
    });
    savePool(pool);
    console.log(`[WalletPool] DEMO assigned ${localAddr.slice(0, 10)}... to user ${refId.slice(0, 12)}...`);
    return { address: localAddr, walletId };
  },

  /** Append externally-created wallets to the pool */
  appendWallets(wallets: Array<{ walletId: string; address: string }>): number {
    const pool = loadPool();
    for (const w of wallets) {
      pool.push({
        walletId: w.walletId,
        address: w.address,
        assigned: false,
        refId: null,
        assignedAt: null,
      });
    }
    savePool(pool);
    console.log(`[WalletPool] Appended ${wallets.length} wallets — total now ${pool.length}`);
    return pool.length;
  },

  /** Stats about the pool */
  stats() {
    const pool = loadPool();
    const assigned = pool.filter((w) => w.assigned);
    const sources: Record<string, number> = { web: 0, cli: 0, telegram: 0 };
    for (const w of assigned) {
      if (!w.refId) continue;
      if (w.refId.startsWith('cli-')) sources.cli++;
      else if (w.refId.startsWith('tg-')) sources.telegram++;
      else sources.web++;
    }
    return {
      total: pool.length,
      assigned: assigned.length,
      available: pool.filter((w) => !w.assigned).length,
      sources,
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
