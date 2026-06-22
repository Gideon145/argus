/**
 * On-chain ELO reputation via ArgusOracle.sol
 * Writes agent ELO deltas to Arc testnet after each consensus verdict.
 * Makes reputation immutable and verifiable on ArcScan.
 */
import { createWalletClient, http, getContract } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const ORACLE_ADDRESS = (process.env.ARGUS_ORACLE_ADDRESS || '0x563b2DA572948C2b54B5f1f26CcFebC153Cb46C8') as `0x${string}`;

const ORACLE_ABI = [
  {
    type: 'function',
    name: 'updateElo',
    inputs: [
      { name: 'agentId', type: 'string' },
      { name: 'eloDelta', type: 'int256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getElo',
    inputs: [{ name: 'agentId', type: 'string' }],
    outputs: [{ name: '', type: 'int256' }],
    stateMutability: 'view',
  },
] as const;

// Use separate signer keys per agent to avoid nonce collisions
const AGENT_SIGNER_KEYS: Record<string, string> = {
  'Agent-α': process.env.AGENT_ALPHA_PRIVATE_KEY || '',
  'Agent-β': process.env.AGENT_BETA_PRIVATE_KEY || '',
  'Agent-γ': process.env.AGENT_GAMMA_PRIVATE_KEY || '',
};

const rpc = process.env.ARC_RPC_URL || 'https://rpc.testnet.arc-node.thecanteenapp.com';

export async function writeEloToChain(agentId: string, eloDelta: number): Promise<string | null> {
  try {
    const signerKey = AGENT_SIGNER_KEYS[agentId] || process.env.FUNDING_WALLET_PRIVATE_KEY;
    if (!signerKey) throw new Error(`No key for ${agentId}`);

    const account = privateKeyToAccount(signerKey as `0x${string}`);
    const client = createWalletClient({
      account,
      chain: {
        id: 5042002,
        name: 'Arc Testnet',
        nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
        rpcUrls: { default: { http: [rpc] } },
      },
      transport: http(rpc),
    });

    const txHash = await client.writeContract({
      address: ORACLE_ADDRESS,
      abi: ORACLE_ABI,
      functionName: 'updateElo',
      args: [agentId, BigInt(eloDelta)],
    });

    console.log(`[ChainELO] ${agentId}: ${eloDelta > 0 ? '+' : ''}${eloDelta} ELO on-chain (tx: ${txHash.slice(0, 10)}...)`);
    return txHash;
  } catch (err: any) {
    console.warn(`[ChainELO] Failed ${agentId}: ${err.message?.slice(0, 80)}`);
    return null;
  }
}

export async function getEloFromChain(agentId: string): Promise<number> {
  try {
    const client = createWalletClient({
      chain: {
        id: 5042002,
        name: 'Arc Testnet',
        nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
        rpcUrls: { default: { http: [rpc] } },
      },
      transport: http(rpc),
    });

    const elo = await client.readContract({
      address: ORACLE_ADDRESS,
      abi: ORACLE_ABI,
      functionName: 'getElo',
      args: [agentId],
    });

    return Number(elo);
  } catch {
    return 1500;
  }
}
