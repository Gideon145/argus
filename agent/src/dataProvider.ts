/**
 * Cross-Chain Data Provider for Argus Agents
 * 
 * Fetches contract metadata from Arc testnet, Ethereum mainnet (Etherscan API),
 * and public mainnet RPC. Returns normalized ContractData for agent analysis.
 * 
 * Rate-limited: 250ms between calls, one retry on failure.
 */
import axios from 'axios';
import { ethers } from 'ethers';

export interface ContractData {
  chain: string;              // 'arc-testnet' | 'ethereum-mainnet' | 'unknown'
  hasSource: boolean;
  sourceCode: string | null;
  contractName: string | null;
  owner: string | null;
  totalSupply: string | null;
  decimals: number | null;
  isContract: boolean;       // confirmed deployed bytecode exists
  flags: string[];           // human-readable flags from analysis
}

const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || '';
const ETHERSCAN_BASE = 'https://api.etherscan.io/api';
const MAINNET_RPC = process.env.MAINNET_RPC_URL || 'https://ethereum-rpc.publicnode.com';

let lastCallTime = 0;
async function rateLimit(): Promise<void> {
  const elapsed = Date.now() - lastCallTime;
  if (elapsed < 250) await new Promise(r => setTimeout(r, 250 - elapsed));
  lastCallTime = Date.now();
}

async function fetchWithRetry(url: string, params: Record<string, string>): Promise<any> {
  await rateLimit();
  try {
    const res = await axios.get(url, { params, timeout: 5000 });
    return res.data;
  } catch {
    // One retry after 500ms
    await new Promise(r => setTimeout(r, 500));
    const res = await axios.get(url, { params, timeout: 5000 });
    return res.data;
  }
}

/** Fetch source code + contract name from Etherscan */
async function fetchEtherscanSource(address: string): Promise<{ sourceCode: string; contractName: string } | null> {
  if (!ETHERSCAN_API_KEY) return null;
  try {
    const data = await fetchWithRetry(ETHERSCAN_BASE, {
      module: 'contract',
      action: 'getsourcecode',
      address,
      apikey: ETHERSCAN_API_KEY,
    });
    if (data.status === '1' && data.result?.[0]) {
      const r = data.result[0];
      return {
        sourceCode: r.SourceCode || '',
        contractName: r.ContractName || '',
      };
    }
  } catch { /* fail silently */ }
  return null;
}

/** Fetch on-chain facts from mainnet RPC (fast-fail if unreachable) */
async function fetchMainnetFacts(address: string): Promise<{
  isContract: boolean;
  owner: string | null;
  totalSupply: string | null;
  decimals: number | null;
}> {
  try {
    const provider = new ethers.JsonRpcProvider(MAINNET_RPC, undefined, { staticNetwork: true });
    // Short timeout — if RPC is unreachable, fail fast
    const code = await Promise.race([
      provider.getCode(address),
      new Promise<null>((_, reject) => setTimeout(() => reject(new Error('RPC timeout')), 3000)),
    ]);
    const isContract = code !== null && code !== '0x';

    if (!isContract) {
      return { isContract: false, owner: null, totalSupply: null, decimals: null };
    }

    const erc20 = new ethers.Contract(
      address,
      ['function totalSupply() view returns (uint256)', 'function decimals() view returns (uint8)', 'function owner() view returns (address)'],
      provider
    );

    let totalSupply: string | null = null;
    let decimals: number | null = null;
    let owner: string | null = null;

    try { totalSupply = (await erc20.totalSupply()).toString(); } catch {}
    try { decimals = Number(await erc20.decimals()); } catch {}
    try { owner = (await erc20.owner()).toLowerCase(); } catch {}

    return { isContract, owner, totalSupply, decimals };
  } catch {
    return { isContract: false, owner: null, totalSupply: null, decimals: null };
  }
}

/** Fetch from Arc testnet RPC */
async function fetchArcFacts(address: string): Promise<{ exists: boolean }> {
  try {
    const arcRpc = process.env.ARC_RPC_URL || 'https://rpc.testnet.arc-node.thecanteenapp.com';
    const provider = new ethers.JsonRpcProvider(arcRpc);
    const code = await provider.getCode(address);
    return { exists: code !== '0x' };
  } catch {
    return { exists: false };
  }
}

/**
 * Main entry point: fetch contract data from best available source.
 * Tries Arc testnet first, then Ethereum mainnet via Etherscan + RPC.
 */
export async function fetchContractData(address: string): Promise<ContractData> {
  const result: ContractData = {
    chain: 'unknown',
    hasSource: false,
    sourceCode: null,
    contractName: null,
    owner: null,
    totalSupply: null,
    decimals: null,
    isContract: false,
    flags: [],
  };

  // Try Arc testnet first — if found, return immediately
  const arc = await fetchArcFacts(address);
  if (arc.exists) {
    result.chain = 'arc-testnet';
    result.isContract = true;
    result.flags.push('Contract deployed on Arc testnet');
    return result;
  }

  // Contract not on Arc — try Ethereum mainnet sources in parallel
  const [source, facts] = await Promise.all([
    fetchEtherscanSource(address).catch(() => null),
    fetchMainnetFacts(address).catch(() => ({ isContract: false, owner: null, totalSupply: null, decimals: null })),
  ]);

  if (facts.isContract) {
    result.chain = 'ethereum-mainnet';
    result.isContract = true;
    result.owner = facts.owner;
    result.totalSupply = facts.totalSupply;
    result.decimals = facts.decimals;
  }

  if (source) {
    result.hasSource = true;
    result.sourceCode = source.sourceCode;
    result.contractName = source.contractName;
    if (result.contractName) result.flags.push(`Contract name: ${result.contractName}`);
  }

  if (result.owner) {
    result.flags.push(`Owner: ${result.owner}`);
  }
  if (result.totalSupply) {
    result.flags.push(`Total supply: ${result.totalSupply}`);
  }
  if (result.decimals !== null) {
    result.flags.push(`Decimals: ${result.decimals}`);
  }
  if (!result.isContract) {
    result.flags.push('No deployed bytecode found on Arc or Ethereum mainnet');
  }

  return result;
}
