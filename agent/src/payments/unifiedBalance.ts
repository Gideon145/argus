/**
 * App Kit — Unified Balance (5/5 Circle primitives)
 * Queries USDC balance across all supported chains using Circle's App Kit.
 */
import { createUnifiedBalanceKit } from '@circle-fin/unified-balance-kit';
import { createViemAdapter } from '@circle-fin/adapter-viem-v2';
import { createPublicClient, http } from 'viem';

const rpc = process.env.ARC_RPC_URL || 'https://rpc.testnet.arc-node.thecanteenapp.com';

// Use Arc testnet as the primary chain
const arcChain = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: [rpc] } },
} as const;

const publicClient = createPublicClient({
  chain: arcChain,
  transport: http(rpc),
});

const adapter = createViemAdapter(publicClient);
const unifiedBalance = createUnifiedBalanceKit({ adapter });

export async function getUnifiedBalance(address: `0x${string}`): Promise<{
  chains: { chainId: number; chainName: string; balance: string; token: string }[];
  total: string;
}> {
  try {
    const result = await unifiedBalance.getBalance({ address });
    
    const chains = (result.balances || []).map((b: any) => ({
      chainId: b.chainId || 0,
      chainName: b.chainName || 'Unknown',
      balance: b.balance || '0',
      token: b.token || 'USDC',
    }));

    const total = result.totalBalance || '0';

    return { chains, total };
  } catch (err: any) {
    console.warn('[UnifiedBalance] Error:', err.message?.slice(0, 80));
    // Fallback to just Arc balance
    try {
      const bal = await publicClient.getBalance({ address });
      return {
        chains: [{ chainId: 5042002, chainName: 'Arc Testnet', balance: bal.toString(), token: 'USDC' }],
        total: bal.toString(),
      };
    } catch {
      return { chains: [], total: '0' };
    }
  }
}
