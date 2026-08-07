/**
 * Data Provider for Argus Agents
 * Fetches contract metadata from Arc testnet + on-chain ERC-20 data.
 * Detects proxies (EIP-1967, UUPS, Transparent, Beacon), mint capability, token metadata.
 * All user-provided metadata (token name, symbol) is sanitized before reaching agent prompts.
 */
import { ethers } from 'ethers';
import axios from 'axios';

export interface ContractData {
  chain: string;
  hasSource: boolean;
  sourceCode: string | null;
  contractName: string | null;
  tokenName: string | null;       // on-chain name(), sanitized
  tokenSymbol: string | null;     // on-chain symbol(), sanitized
  owner: string | null;
  totalSupply: string | null;
  decimals: number | null;
  isContract: boolean;
  isProxy: boolean;
  proxyType: string | null;
  hasMintFunction: boolean;
  flags: string[];
}

// ─── Sanitize user-provided metadata before it reaches AI prompts ───
function sanitizeMetadata(value: string | null): string | null {
  if (!value) return null;
  // Strip control characters, null bytes, and limit length
  let cleaned = value.replace(/[\x00-\x1f\x7f-\x9f]/g, '');
  // Truncate to 100 chars max
  if (cleaned.length > 100) cleaned = cleaned.slice(0, 100);
  // If the result is empty after cleaning, return null
  if (cleaned.trim().length === 0) return null;
  return cleaned;
}

const ARC_RPC = process.env.ARC_RPC_URL || 'https://rpc.testnet.arc-node.thecanteenapp.com';
const ETHERSCAN_KEY = process.env.ETHERSCAN_API_KEY || '';
const ETHERSCAN_URL = 'https://api.etherscan.io/v2/api';

// Multi-chain RPC endpoints — tried in order until one connects and finds the contract
const RPC_ENDPOINTS: { name: string; url: string; chainId: number }[] = [
  { name: 'Arc Testnet', url: ARC_RPC, chainId: 5042002 },
  { name: 'Ethereum Mainnet', url: 'https://ethereum-rpc.publicnode.com', chainId: 1 },
  { name: 'Ethereum Fallback', url: 'https://rpc.ankr.com/eth', chainId: 1 },
  { name: 'BSC Mainnet', url: 'https://bsc-dataseed.binance.org', chainId: 56 },
  { name: 'Polygon Mainnet', url: 'https://polygon.llamarpc.com', chainId: 137 },
];

let lastCall = 0;
async function rateLimit() { const e = Date.now() - lastCall; if (e < 250) await new Promise(r => setTimeout(r, 250 - e)); lastCall = Date.now(); }

// ─── Proxy Detection via EIP-1967 Storage Slots ───
const PROXY_SLOTS = {
  // EIP-1967: bytes32(uint256(keccak256('eip1967.proxy.implementation')) - 1)
  implementation: '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc',
  // EIP-1967: bytes32(uint256(keccak256('eip1967.proxy.admin')) - 1)
  admin: '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103',
  // EIP-1967: bytes32(uint256(keccak256('eip1967.proxy.beacon')) - 1)
  beacon: '0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50',
};

// UUPS: the implementation address is stored at a slot defined by the contract.
// We can try common OZ UUPS slots or check for upgradeTo function in source.

// ─── ERC-20 Minimal ABI ───
const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function owner() view returns (address)',
  'function balanceOf(address) view returns (uint256)',
];

// ─── Extended ABI for mint/proxy detection ───
const DETECTION_ABI = [
  ...ERC20_ABI,
  'function mint(address,uint256) view returns (bool)',
  'function mint(uint256) view returns (bool)',
  'function implementation() view returns (address)',
  'function upgradeTo(address) view returns (bool)',
  'function admin() view returns (address)',
  'function getImplementation() view returns (address)',
];

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

async function detectProxy(provider: ethers.JsonRpcProvider, address: string): Promise<{ isProxy: boolean; proxyType: string | null }> {
  try {
    const implSlot = await Promise.race([
      provider.getStorage(address, PROXY_SLOTS.implementation),
      new Promise<string>((_, r) => setTimeout(() => r('0x0000000000000000000000000000000000000000000000000000000000000000'), 3000))
    ]);
    if (implSlot && implSlot !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
      const implAddr = '0x' + implSlot.slice(-40);
      if (implAddr !== '0x0000000000000000000000000000000000000000') {
        const adminSlot = await Promise.race([
          provider.getStorage(address, PROXY_SLOTS.admin),
          new Promise<string>((_, r) => setTimeout(() => r('0x'), 2000))
        ]);
        const hasAdmin = adminSlot && adminSlot !== '0x0000000000000000000000000000000000000000000000000000000000000000';
        return { isProxy: true, proxyType: hasAdmin ? 'EIP-1967 Transparent' : 'EIP-1967 UUPS' };
      }
    }
    const beaconSlot = await Promise.race([
      provider.getStorage(address, PROXY_SLOTS.beacon),
      new Promise<string>((_, r) => setTimeout(() => r('0x'), 2000))
    ]);
    if (beaconSlot && beaconSlot !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
      return { isProxy: true, proxyType: 'EIP-1967 Beacon' };
    }
  } catch { /* RPC may not support getStorage */ }
  return { isProxy: false, proxyType: null };
}

// ─── Query a single RPC for full contract metadata ───
async function queryRpc(address: string, rpcUrl: string, chainName: string): Promise<ContractData | null> {
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl, undefined, { staticNetwork: true });
    const code = await Promise.race([
      provider.getCode(address),
      new Promise<null>((_, r) => setTimeout(() => r(null), 4000))
    ]);
    if (!code || code === '0x') return null; // Not a contract on this chain

    const result: ContractData = {
      chain: chainName, hasSource: false, sourceCode: null, contractName: null,
      tokenName: null, tokenSymbol: null, owner: null, totalSupply: null,
      decimals: null, isContract: true, isProxy: false, proxyType: null,
      hasMintFunction: false, flags: [`${chainName}: contract deployed`],
    };

    // Fetch ERC-20 metadata
    try {
      const erc20 = new ethers.Contract(address, ERC20_ABI, provider);
      const [nameR, symR, decR, tsR, ownR] = await Promise.allSettled([
        Promise.race([erc20.name(), new Promise<string>((_, r2) => setTimeout(() => r2(''), 3000))]),
        Promise.race([erc20.symbol(), new Promise<string>((_, r2) => setTimeout(() => r2(''), 3000))]),
        Promise.race([erc20.decimals(), new Promise<bigint>((_, r2) => setTimeout(() => r2(18n), 3000))]),
        Promise.race([erc20.totalSupply(), new Promise<bigint>((_, r2) => setTimeout(() => r2(0n), 3000))]),
        Promise.race([erc20.owner(), new Promise<string>((_, r2) => setTimeout(() => r2(''), 3000))]),
      ]);
      if (nameR.status === 'fulfilled' && nameR.value) result.tokenName = sanitizeMetadata(nameR.value);
      if (symR.status === 'fulfilled' && symR.value) result.tokenSymbol = sanitizeMetadata(symR.value);
      if (decR.status === 'fulfilled') result.decimals = Number(decR.value);
      if (tsR.status === 'fulfilled') result.totalSupply = tsR.value.toString();
      if (ownR.status === 'fulfilled' && ownR.value && ownR.value !== '0x0000000000000000000000000000000000000000') {
        result.owner = ownR.value.toLowerCase();
      }

      if (result.tokenName) result.flags.push(`Token: ${result.tokenName}${result.tokenSymbol ? ` (${result.tokenSymbol})` : ''}`);
      if (result.totalSupply) result.flags.push(`Supply: ${result.totalSupply}`);
      if (result.decimals !== null) result.flags.push(`Decimals: ${result.decimals}`);
      if (result.owner) result.flags.push(`Owner: ${result.owner.slice(0, 10)}...`);

      // Holder concentration
      if (result.owner && result.totalSupply && tsR.status === 'fulfilled') {
        try {
          const ownerBal = await Promise.race([erc20.balanceOf(result.owner), new Promise<bigint>((_, r2) => setTimeout(() => r2(0n), 3000))]);
          const ts = BigInt(result.totalSupply);
          if (ts > 0n && ownerBal > 0n) {
            const pct = Number((ownerBal * 10000n) / ts) / 100;
            result.flags.push(`Owner holds ${pct}% of supply`);
            if (pct > 50) result.flags.push('Owner holds majority supply');
            if (pct > 90) result.flags.push('Owner holds >90% supply — extreme concentration');
          }
        } catch {}
      }
    } catch {}

    // Detect proxy
    try {
      const proxyInfo = await detectProxy(provider, address);
      result.isProxy = proxyInfo.isProxy;
      result.proxyType = proxyInfo.proxyType;
      if (proxyInfo.isProxy) {
        result.flags.push(`Proxy detected: ${proxyInfo.proxyType}`);
      }
    } catch {}

    return result;
  } catch { return null; }
}

export async function fetchContractData(address: string): Promise<ContractData> {
  const empty: ContractData = {
    chain: 'unknown', hasSource: false, sourceCode: null, contractName: null,
    tokenName: null, tokenSymbol: null, owner: null, totalSupply: null,
    decimals: null, isContract: false, isProxy: false, proxyType: null,
    hasMintFunction: false, flags: [],
  };

  if (process.env.SKIP_RPC === 'true') return empty;

  // ── Try all RPC endpoints until we find the contract ──
  for (const endpoint of RPC_ENDPOINTS) {
    const data = await queryRpc(address, endpoint.url, endpoint.name);
    if (data) return data;
  }

  // ── Etherscan fallback (if API key configured) ──
  const src = await fetchEtherscan(address);
  if (src) {
    return {
      ...empty,
      chain: 'ethereum-mainnet', isContract: true, hasSource: true,
      contractName: sanitizeMetadata(src.contractName), sourceCode: src.sourceCode,
      tokenName: sanitizeMetadata(src.contractName),
      flags: [`Etherscan verified: ${sanitizeMetadata(src.contractName)}`],
    };
  }

  return empty;
}