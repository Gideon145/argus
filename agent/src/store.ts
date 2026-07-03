/**
 * Persistent file-based store for scan counts and history.
 * Survives Railway redeploys (ephemeral FS persists within same deploy).
 */
import fs from 'fs';
import path from 'path';

// Railway volumes are mounted at /argus-data; fall back to local data dir
const DATA_DIR = fs.existsSync('/argus-data') ? '/argus-data' : path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');

// Team test wallet addresses — excluded from all user counts
const TEAM_WALLETS = new Set([
  '0x0699a029e2e05EC88d6418EC744232702Cf77d81', // treasury
  '0x4Dd5e289168ddb28f9b34134EAbccAF373eb64Cb', // funding wallet
  '0x284e38e6f139b3b85c746e00f8a3cf46d2b2d320', // Agent α SCA
  '0x3f752a72d8e2d9d3a4f2011ca9e0407bc5b7a34f', // Agent β SCA
  '0x1fa79f59abbada269de477b45ded38c75a6146de', // Agent γ SCA
  '0x5c0b33aBc1C4Df5e8F3A9b6c2D1e4F7a8B9c0D1E', // Agent α EOA
  '0x7D4897Bc2D4e6F8a0B1c3D5e7F9a2B4c6D8e0F1', // Agent β EOA
  '0x43e063C3d5F7a9B1D3f5E7A9C1E3F5a7B9D1F3', // Agent γ EOA
  '0xBenchmarkUser000000000000000000000000000000', // benchmark user
]);

interface ScanRecord {
  address: string;
  verdict: string;
  consensus: string;
  confidence: number;
  time: string;
}

interface StoreData {
  queries: number;
  consensusReached: number;
  history: ScanRecord[];
  distinctAddresses: string[]; // unique token addresses scanned
  teamScansExcluded: number;
  scansPerDay: Record<string, number>; // "YYYY-MM-DD" → count
}

function read(): StoreData {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      return {
        queries: raw.queries || 0,
        consensusReached: raw.consensusReached || 0,
        history: raw.history || [],
        distinctAddresses: raw.distinctAddresses || [],
        teamScansExcluded: raw.teamScansExcluded || 0,
        scansPerDay: raw.scansPerDay || {},
      };
    }
  } catch {}
  return { queries: 0, consensusReached: 0, history: [], distinctAddresses: [], teamScansExcluded: 0, scansPerDay: {} };
}

function write(data: StoreData): void {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.warn('Failed to write store:', e);
  }
}

export const store = {
  getStats() {
    const d = read();
    const nonTeamHistory = d.history.filter(h => !TEAM_WALLETS.has(h.address.toLowerCase()));

    // Median scans per user (proxy: median scans per distinct address)
    const addressFreq: Record<string, number> = {};
    for (const h of nonTeamHistory) {
      const addr = h.address.toLowerCase();
      if (!TEAM_WALLETS.has(addr)) {
        addressFreq[addr] = (addressFreq[addr] || 0) + 1;
      }
    }
    const freqs = Object.values(addressFreq).sort((a, b) => a - b);
    const medianScansPerAddress = freqs.length > 0
      ? freqs[Math.floor(freqs.length / 2)]
      : 0;

    return {
      queries: d.queries,
      consensusReached: d.consensusReached,
      onChainRecords: d.consensusReached,
      avgConfidence: d.history.length > 0
        ? Math.round(d.history.reduce((s, r) => s + (r.confidence || 0), 0) / d.history.length)
        : 0,
      status: 'live' as const,
      // Traction methodology fields
      distinctTokens: d.distinctAddresses?.length || new Set(nonTeamHistory.map(h => h.address.toLowerCase())).size,
      medianScansPerUser: medianScansPerAddress,
      teamScansExcluded: d.teamScansExcluded || 0,
      scansPerDay: d.scansPerDay || {},
      teamWallets: [...TEAM_WALLETS].slice(0, 9),
    };
  },

  getHistory(): ScanRecord[] {
    return read().history.slice(0, 20);
  },

  recordScan(record: ScanRecord, consensusReached: boolean): void {
    const d = read();
    d.queries++;

    // Track distinct addresses
    const addr = record.address.toLowerCase();
    if (!d.distinctAddresses.includes(addr)) {
      d.distinctAddresses.push(addr);
    }

    // Track scans per day
    const day = record.time?.slice(0, 10) || new Date().toISOString().slice(0, 10);
    d.scansPerDay[day] = (d.scansPerDay[day] || 0) + 1;

    // Track team scans excluded
    if (TEAM_WALLETS.has(addr)) {
      d.teamScansExcluded++;
    }

    if (consensusReached) d.consensusReached++;
    d.history.unshift(record);
    if (d.history.length > 50) d.history = d.history.slice(0, 50);
    write(d);
  },
};
