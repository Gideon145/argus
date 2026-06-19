/**
 * Persistent file-based store for scan counts and history.
 * Survives Railway redeploys (ephemeral FS persists within same deploy).
 */
import fs from 'fs';
import path from 'path';

// Use Railway volume if available, otherwise local data dir
const DATA_DIR = process.env.RAILWAY_VOLUME_PATH 
  ? path.join(process.env.RAILWAY_VOLUME_PATH, 'argus-data')
  : path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');

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
}

function read(): StoreData {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch {}
  return { queries: 0, consensusReached: 0, history: [] };
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
    return {
      queries: d.queries,
      consensusReached: d.consensusReached,
      onChainRecords: d.consensusReached,
      avgConfidence: d.queries > 0 ? Math.round((d.consensusReached / d.queries) * 100) : 0,
      status: 'live' as const,
    };
  },

  getHistory(): ScanRecord[] {
    return read().history.slice(0, 20);
  },

  recordScan(record: ScanRecord, consensusReached: boolean): void {
    const d = read();
    d.queries++;
    if (consensusReached) d.consensusReached++;
    d.history.unshift(record);
    if (d.history.length > 50) d.history = d.history.slice(0, 50);
    write(d);
  },
};
