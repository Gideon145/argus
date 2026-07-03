/**
 * Arc-Native Data Provider for Argus Agents
 * 
 * Fetches contract metadata from Arc testnet only.
 * Agents analyze Arc-native contracts. If a token isn't on Arc,
 * agents abstain (INSUFFICIENT_DATA) rather than guessing.
 */
import { ethers } from 'ethers';

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

async function fetchArcFacts(address: string): Promise<{
  isContract: boolean;
  owner: string | null;
  totalSupply: string | null;
  decimals: number | null;
}> {
  // If RPC is unavailable (e.g., local dev without network), skip and return empty
  if (process.env.SKIP_RPC === 'true') {
    return { isContract: false, owner: null, totalSupply: null, decimals: null };
  }
  try {
    const provider = new ethers.JsonRpcProvider(ARC_RPC, undefined, { staticNetwork: true });
    provider.getCode(address).catch(() => {}); // warm up connection
    const code = await Promise.race([
      provider.getCode(address),
      new Promise<null>((_, reject) => setTimeout(() => reject(new Error('RPC timeout')), 4000)),
    ]);
    const isContract = code !== null && code !== '0x';
    if (!isContract) return { isContract: false, owner: null, totalSupply: null, decimals: null };
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

export async function fetchContractData(address: string): Promise<ContractData> {
  const result: ContractData = {
    chain: 'unknown', hasSource: false, sourceCode: null, contractName: null,
    owner: null, totalSupply: null, decimals: null, isContract: false, flags: [],
  };
  const facts = await fetchArcFacts(address);
  if (facts.isContract) {
    result.chain = 'arc-testnet';
    result.isContract = true;
    result.owner = facts.owner;
    result.totalSupply = facts.totalSupply;
    result.decimals = facts.decimals;
    result.flags.push('Contract deployed on Arc testnet');
    if (result.owner) result.flags.push(`Owner: ${result.owner}`);
    if (result.totalSupply) result.flags.push(`Total supply: ${result.totalSupply}`);
    if (result.decimals !== null) result.flags.push(`Decimals: ${result.decimals}`);
  } else {
    result.flags.push('No deployed bytecode found on Arc testnet');
  }
  return result;
}