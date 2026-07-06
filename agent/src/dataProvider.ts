/**
 * Data Provider for Argus Agents
 * Fetches contract metadata from Arc testnet + Etherscan mainnet.
 * Rate-limited per Etherscan free tier (5 calls/sec, we use 250ms spacing + retry).
 */
import { ethers } from 'ethers';
import axios from 'axios';

export interface ContractData {
  chain: string;
  hasSource: boolean;
  sourceCode: string | null;
  contractName: string | null;
  owner: string | null;
  totalSupply: string | null;
  decimals: number | null;
  isContract: boolean;
  flags: string[];
}

const ARC_RPC = process.env.ARC_RPC_URL || 'https://rpc.testnet.arc-node.thecanteenapp.com';
const ETHERSCAN_KEY = process.env.ETHERSCAN_API_KEY || '';
const ETHERSCAN_URL = 'https://api.etherscan.io/v2/api';

let lastCall = 0;
async function rateLimit() { const e = Date.now() - lastCall; if (e < 250) await new Promise(r => setTimeout(r, 250 - e)); lastCall = Date.now(); }

async function fetchEtherscan(address: string): Promise<{ contractName: string; sourceCode: string; owner: string } | null> {
  if (!ETHERSCAN_KEY) return null;
  await rateLimit();
  const params = { chainid: '1', module: 'contract', action: 'getsourcecode', address, apikey: ETHERSCAN_KEY };
  try {
    const { data } = await axios.get(ETHERSCAN_URL, { params, timeout: 8000 });
    if (data?.status === '1' && data.result?.[0]) {
      const r = data.result[0];
      if (r.Proxy === '1' && r.Implementation) { await rateLimit(); try { const { data: d2 } = await axios.get(ETHERSCAN_URL, { params: { chainid: '1', module: 'contract', action: 'getsourcecode', address: r.Implementation, apikey: ETHERSCAN_KEY }, timeout: 8000 }); if (d2?.status === '1' && d2.result?.[0]?.ContractName) return { contractName: d2.result[0].ContractName, sourceCode: d2.result[0].SourceCode || '', owner: r.Implementation }; } catch {} }
      if (r.ContractName) return { contractName: r.ContractName, sourceCode: r.SourceCode || '', owner: '' };
    }
  } catch { try { await new Promise(r2 => setTimeout(r2, 500)); const { data } = await axios.get(ETHERSCAN_URL, { params, timeout: 8000 }); if (data?.status === '1' && data.result?.[0]?.ContractName) return { contractName: data.result[0].ContractName, sourceCode: data.result[0].SourceCode || '', owner: '' }; } catch {} }
  return null;
}

export async function fetchContractData(address: string): Promise<ContractData> {
  const result: ContractData = { chain: 'unknown', hasSource: false, sourceCode: null, contractName: null, owner: null, totalSupply: null, decimals: null, isContract: false, flags: [] };

  // Try Arc RPC (fast skip if unavailable)
  if (process.env.SKIP_RPC !== 'true') {
    try {
      const p = new ethers.JsonRpcProvider(ARC_RPC, undefined, { staticNetwork: true });
      const code = await Promise.race([p.getCode(address), new Promise<null>((_, r) => setTimeout(() => r(null), 4000))]);
      if (code && code !== '0x') {
        result.chain = 'arc-testnet'; result.isContract = true;
        result.flags.push('Arc testnet: contract deployed');
        return result;
      }
    } catch {}
  }

  // Try Etherscan mainnet
  const src = await fetchEtherscan(address);
  if (src) {
    result.chain = 'ethereum-mainnet'; result.isContract = true; result.hasSource = true;
    result.contractName = src.contractName; result.sourceCode = src.sourceCode;
    result.flags.push(`Etherscan verified: ${src.contractName}`);
    // Also try to get on-chain facts from the verified source
    try {
      const p2 = new ethers.JsonRpcProvider('https://ethereum-rpc.publicnode.com', undefined, { staticNetwork: true });
      const erc20 = new ethers.Contract(address, ['function totalSupply() view returns (uint256)', 'function decimals() view returns (uint8)', 'function owner() view returns (address)', 'function balanceOf(address) view returns (uint256)'], p2);
      const [ts, dec, own] = await Promise.allSettled([erc20.totalSupply(), erc20.decimals(), erc20.owner()]);
      if (ts.status === 'fulfilled') result.totalSupply = ts.value.toString();
      if (dec.status === 'fulfilled') result.decimals = Number(dec.value);
      if (own.status === 'fulfilled') result.owner = own.value.toLowerCase();
      if (result.owner) result.flags.push(`Owner: ${result.owner.slice(0, 10)}...`);
      if (result.totalSupply) result.flags.push(`Supply: ${result.totalSupply}`);
      if (result.decimals !== null) result.flags.push(`Decimals: ${result.decimals}`);

      // v0.15 groundwork: query owner's token balance for holder concentration signal
      if (result.owner && result.totalSupply && ts.status === 'fulfilled') {
        try {
          const ownerBalance = await erc20.balanceOf(result.owner);
          const totalSupply = BigInt(result.totalSupply);
          if (totalSupply > 0n) {
            const ownerPct = Number((ownerBalance * 10000n) / totalSupply) / 100;
            result.flags.push(`Owner holds ${ownerPct}% of supply`);
            if (ownerPct > 50) result.flags.push('⚠️ Owner holds majority supply');
            if (ownerPct > 90) result.flags.push('🚨 Owner holds >90% supply — extreme concentration');
          }
        } catch { /* balanceOf failed — non-ERC20 contract, skip */ }
      }
    } catch {}
  }

  if (!result.isContract) result.flags.push('No contract data found on Arc or Etherscan');
  return result;
}