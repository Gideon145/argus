import type { ArgusConfig, ScanResponse } from './types';
import { setStatsConfig } from './stats';

const DEFAULT_API = 'https://argus-agent-production-ab97.up.railway.app';
const DEFAULT_TIMEOUT = 30000;

let _config: ArgusConfig = {};

/** Configure the Argus SDK with a custom API URL or timeout. */
export function configure(config: ArgusConfig): void {
  _config = { ..._config, ...config };
  setStatsConfig(config);
}

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const apiUrl = _config.apiUrl || DEFAULT_API;
  const timeout = _config.timeout || DEFAULT_TIMEOUT;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(`${apiUrl}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...options?.headers,
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Argus API error ${res.status}: ${body.slice(0, 200)}`);
    }

    return (await res.json()) as T;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error(`Argus API request timed out after ${timeout}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Scan a smart contract address with the Argus multi-agent consensus oracle.
 * Three AI agents independently analyze the contract and reach 2/3 consensus.
 *
 * @param contractAddress - The EVM contract address to scan (0x...)
 * @param chain - Chain identifier (default: 'arc')
 * @param threshold - Consensus threshold: 2 (default) or 3
 * @returns The scan result with verdict, per-agent reasoning, and settlement info
 *
 * @example
 * ```ts
 * import { scan } from 'argus-sdk';
 *
 * const result = await scan('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');
 * console.log(result.result.verdict); // 'SAFE'
 * console.log(result.result.agents);  // per-agent breakdown
 * ```
 */
export async function scan(
  contractAddress: string,
  chain: string = 'arc',
  threshold: number = 2,
): Promise<ScanResponse> {
  if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
    throw new Error(`Invalid contract address: ${contractAddress}`);
  }

  return fetchApi<ScanResponse>('/debug/scan', {
    method: 'POST',
    body: JSON.stringify({ contractAddress, chain, threshold }),
  });
}
