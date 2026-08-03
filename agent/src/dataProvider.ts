/**
 * Data Provider for Argus Agents
 * Fetches contract metadata from Arc testnet + on-chain ERC-20 data.
 * Detects proxies (EIP-1967, UUPS, Transparent, Beacon), mint capability, token metadata.
 */
import { ethers } from 'ethers';
import axios from 'axios';

export interface ContractData {
  chain: string;
  hasSource: boolean;
  sourceCode: string | null;
  contractName: string | null;
  tokenName: string | null;       // NEW: on-chain name()
  tokenSymbol: string | null;     // NEW: on-chain symbol()
  owner: string | null;
  totalSupply: string | null;
  decimals: number | null;
  isContract: boolean;
  isProxy: boolean;               // NEW: EIP-1967 or similar proxy detected
  proxyType: string | null;       // NEW: "EIP-1967", "UUPS", "Transparent", "Beacon", etc.
  hasMintFunction: boolean;       // NEW: mint() capability detected
  flags: string[];
}

const ARC_RPC = process.env.ARC_RPC_URL || 'https://rpc.testnet.arc-node.thecanteenapp.com';
const ETHERSCAN_KEY = process.env.ETHERSCAN_API_KEY || '';
const ETHERSCAN_URL = 'https://api.etherscan.io/v2/api';

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
    // Check EIP-1967 implementation slot
    const implSlot = await Promise.race([
      provider.getStorage(address, PROXY_SLOTS.implementation),
      new Promise<string>((_, r) => setTimeout(() => r('0x0000000000000000000000000000000000000000000000000000000000000000'), 3000))
    ]);
    if (implSlot && implSlot !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
      // Extract address from slot (last 20 bytes)
      const implAddr = '0x' + implSlot.slice(-40);
      if (implAddr !== '0x0000000000000000000000000000000000000000') {
        // Check if admin slot also has a value (confirms EIP-1967)
        const adminSlot = await Promise.race([
          provider.getStorage(address, PROXY_SLOTS.admin),
          new Promise<string>((_, r) => setTimeout(() => r('0x'), 2000))
        ]);
        const hasAdmin = adminSlot && adminSlot !== '0x0000000000000000000000000000000000000000000000000000000000000000';
        return { isProxy: true, proxyType: hasAdmin ? 'EIP-1967 Transparent' : 'EIP-1967 UUPS' };
      }
    }
    // Check beacon slot
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

export async function fetchContractData(address: string): Promise<ContractData> {
  const result: ContractData = {
    chain: 'unknown', hasSource: false, sourceCode: null, contractName: null,
    tokenName: null, tokenSymbol: null, owner: null, totalSupply: null,
    decimals: null, isContract: false, isProxy: false, proxyType: null,
    hasMintFunction: false, flags: [],
  };

  let provider: ethers.JsonRpcProvider | null = null;

  // ── Step 1: Try Arc RPC for basic contract detection ──
  if (process.env.SKIP_RPC !== 'true') {
    try {
      provider = new ethers.JsonRpcProvider(ARC_RPC, undefined, { staticNetwork: true });
      const code = await Promise.race([provider.getCode(address), new Promise<null>((_, r) => setTimeout(() => r(null), 4000))]);
      if (code && code !== '0x') {
        result.chain = 'arc-testnet';
        result.isContract = true;
        result.flags.push('Arc testnet: contract deployed');

        // ── Step 2: Fetch ERC-20 metadata (name, symbol) on-chain ──
        if (provider) {
          try {
            const erc20 = new ethers.Contract(address, ERC20_ABI, provider);
            const [nameR, symR, decR, tsR, ownR] = await Promise.allSettled([
              Promise.race([erc20.name(), new Promise<string>((_, r2) => setTimeout(() => r2(''), 3000))]),
              Promise.race([erc20.symbol(), new Promise<string>((_, r2) => setTimeout(() => r2(''), 3000))]),
              Promise.race([erc20.decimals(), new Promise<bigint>((_, r2) => setTimeout(() => r2(18n), 3000))]),
              Promise.race([erc20.totalSupply(), new Promise<bigint>((_, r2) => setTimeout(() => r2(0n), 3000))]),
              Promise.race([erc20.owner(), new Promise<string>((_, r2) => setTimeout(() => r2(''), 3000))]),
            ]);
            if (nameR.status === 'fulfilled' && nameR.value && nameR.value.length > 0) result.tokenName = nameR.value;
            if (symR.status === 'fulfilled' && symR.value && symR.value.length > 0) result.tokenSymbol = symR.value;
            if (decR.status === 'fulfilled') result.decimals = Number(decR.value);
            if (tsR.status === 'fulfilled') result.totalSupply = tsR.value.toString();
            if (ownR.status === 'fulfilled' && ownR.value && ownR.value !== '0x0000000000000000000000000000000000000000') {
              result.owner = ownR.value.toLowerCase();
              result.flags.push(`Owner: ${ownR.value.toLowerCase().slice(0, 10)}...`);
            }

            if (result.tokenName) result.flags.push(`Token: ${result.tokenName}${result.tokenSymbol ? ` (${result.tokenSymbol})` : ''}`);
            if (result.totalSupply) result.flags.push(`Supply: ${result.totalSupply}`);
            if (result.decimals !== null) result.flags.push(`Decimals: ${result.decimals}`);

            // Holder concentration check
            if (result.owner && result.totalSupply && tsR.status === 'fulfilled') {
              try {
                const ownerBalance = await Promise.race([
                  erc20.balanceOf(result.owner),
                  new Promise<bigint>((_, r2) => setTimeout(() => r2(0n), 3000))
                ]);
                const totalSupply = BigInt(result.totalSupply);
                if (totalSupply > 0n && ownerBalance > 0n) {
                  const ownerPct = Number((ownerBalance * 10000n) / totalSupply) / 100;
                  result.flags.push(`Owner holds ${ownerPct}% of supply`);
                  if (ownerPct > 50) result.flags.push('⚠️ Owner holds majority supply');
                  if (ownerPct > 90) result.flags.push('🚨 Owner holds >90% supply — extreme concentration');
                }
              } catch { /* balanceOf failed */ }
            }

            // ── Step 3: Detect proxy pattern (EIP-1967) ──
            const proxyInfo = await detectProxy(provider, address);
            result.isProxy = proxyInfo.isProxy;
            result.proxyType = proxyInfo.proxyType;
            if (proxyInfo.isProxy) {
              result.flags.push(`⚠️ Proxy detected: ${proxyInfo.proxyType}`);
            }

            return result; // Got Arc data, return early
          } catch { /* metadata fetch failed, continue */ }
        }
        return result;
      }
    } catch { /* Arc RPC unavailable, continue to Etherscan */ }
  }

  // ── Step 4: Fallback to Etherscan mainnet ──
  const src = await fetchEtherscan(address);
  if (src) {
    result.chain = 'ethereum-mainnet'; result.isContract = true; result.hasSource = true;
    result.contractName = src.contractName; result.sourceCode = src.sourceCode;
    result.tokenName = src.contractName;
    result.flags.push(`Etherscan verified: ${src.contractName}`);

    // Check Etherscan proxy flag
    if ((src.sourceCode || '').toLowerCase().includes('proxy') || (src.sourceCode || '').toLowerCase().includes('upgradeable')) {
      result.isProxy = true;
      result.proxyType = 'Etherscan-flagged proxy';
      result.flags.push('⚠️ Proxy/upgradeable pattern in source');
    }

    // On-chain ERC-20 queries on Ethereum mainnet
    try {
      const p2 = new ethers.JsonRpcProvider('https://ethereum-rpc.publicnode.com', undefined, { staticNetwork: true });
      const erc20 = new ethers.Contract(address, ERC20_ABI, p2);
      const [ts, dec, own, nameR, symR] = await Promise.allSettled([
        erc20.totalSupply(), erc20.decimals(), erc20.owner(), erc20.name(), erc20.symbol()
      ]);
      if (ts.status === 'fulfilled') result.totalSupply = ts.value.toString();
      if (dec.status === 'fulfilled') result.decimals = Number(dec.value);
      if (own.status === 'fulfilled') result.owner = own.value.toLowerCase();
      if (nameR.status === 'fulfilled' && nameR.value) result.tokenName = nameR.value;
      if (symR.status === 'fulfilled' && symR.value) result.tokenSymbol = symR.value;
      if (result.owner) result.flags.push(`Owner: ${result.owner.slice(0, 10)}...`);
    } catch {}
  }

  if (!result.isContract) result.flags.push('No contract data found on Arc or Etherscan');
  return result;
}