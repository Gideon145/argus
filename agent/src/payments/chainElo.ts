/**
 * On-chain ELO reputation via ArgusOracle.sol
 * Writes agent ELO deltas to Arc testnet after each consensus verdict.
 * Makes reputation immutable and verifiable on ArcScan.
 */
import { createWalletClient, http, getContract, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const ORACLE_ADDRESS = (process.env.ARGUS_ORACLE_ADDRESS || '0x563b2DA572948C2b54B5f1f26CcFebC153Cb46C8') as `0x${string}`;

const ORACLE_ABI = parseAbi([
  'function updateElo(string agentId, int256 eloDelta) external',
  'function getElo(string agentId) external view returns (int256)',
  'event ReputationUpdated(string indexed agentId, int256 eloDelta, int256 newElo)',
]);

function getSigner() {
  const key = process.env.FUNDING_WALLET_PRIVATE_KEY || process.env.AGENT_ALPHA_PRIVATE_KEY;
  if (!key) throw new Error('No signer key configured for on-chain ELO');

  const rpc = process.env.ARC_RPC_URL || 'https://rpc.testnet.arc-node.thecanteenapp.com';
  const chain = {
    id: 5042002,
    name: 'Arc Testnet',
    nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
    rpcUrls: { default: { http: [rpc] } },
  } as const;

  const account = privateKeyToAccount(key as `0x${string}`);
  const client = createWalletClient({ chain, transport: http(rpc) });
  return { client, account };
}

export async function writeEloToChain(agentId: string, eloDelta: number): Promise<string | null> {
  try {
    const { client, account } = getSigner();

    const txHash = await client.writeContract({
      address: ORACLE_ADDRESS,
      abi: ORACLE_ABI,
      functionName: 'updateElo',
      args: [agentId, BigInt(eloDelta)],
      account,
      chain: {
        id: 5042002,
        name: 'Arc Testnet',
        nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
        rpcUrls: { default: { http: [process.env.ARC_RPC_URL || 'https://rpc.testnet.arc-node.thecanteenapp.com'] } },
      } as any,
    });

    console.log(`[ChainELO] ${agentId}: ${eloDelta > 0 ? '+' : ''}${eloDelta} ELO written on-chain (tx: ${txHash.slice(0, 10)}...)`);
    return txHash;
  } catch (err: any) {
    console.warn(`[ChainELO] Failed to write ${agentId} ELO: ${err.message?.slice(0, 80)}`);
    return null;
  }
}

export async function getEloFromChain(agentId: string): Promise<number> {
  try {
    const rpc = process.env.ARC_RPC_URL || 'https://rpc.testnet.arc-node.thecanteenapp.com';
    const { client } = getSigner();

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
