/**
 * Funding Wallet — auto-sends test USDC to new users on wallet connect.
 * 
 * Architecture:
 *   Arc Faucet → Funding Wallet → User's Wallet → Gateway x402 → Treasury Wallet
 * 
 * The Funding Wallet is a gas tank that onboards users with free test USDC.
 * Refill it periodically from the Arc testnet faucet (faucet.circle.com).
 * 
 * IMPORTANT: Arc uses USDC as the NATIVE gas token (18 decimals).
 * Use eth_getBalance and native transfers, NOT ERC-20 contract calls.
 */

import { createWalletClient, http, parseEther, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

// ── Config ──────────────────────────────────────────────────────────────────
const ARC_TESTNET_CHAIN_ID = 5042002;
const ARC_RPC = process.env.ARC_RPC_URL || 'https://rpc.testnet.arc-node.thecanteenapp.com';

const FUNDING_KEY = process.env.FUNDING_WALLET_PRIVATE_KEY || '';
const FUNDING_AMOUNT = '5'; // $5 test USDC per new user (native, 18 decimals)
const MIN_BALANCE_THRESHOLD = '1'; // Only fund if user has < $1 USDC

const chain = {
  id: ARC_TESTNET_CHAIN_ID,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: [ARC_RPC] } },
} as const;

/**
 * Get native USDC balance for an address (Arc native gas token = USDC, 18 decimals)
 */
export async function getUSDCBalance(address: `0x${string}`): Promise<string> {
  try {
    const client = createWalletClient({ chain, transport: http(ARC_RPC) });
    const hexBalance = await client.request({ method: 'eth_getBalance', params: [address, 'latest'] }) as string;
    return formatEther(BigInt(hexBalance)); // 18 decimals
  } catch (e: any) {
    console.warn('[Funding] getBalance failed:', e.message);
    return '0';
  }
}

/**
 * Send test USDC to a user if their balance is below threshold.
 * Uses native transfer (Arc USDC = native gas token, no ERC-20 contract).
 */
export async function fundUserIfNeeded(
  userAddress: `0x${string}`
): Promise<{ funded: boolean; txHash?: string; reason?: string }> {
  // ── Validate funding wallet ──────────────────────────────────────────────
  if (!FUNDING_KEY || FUNDING_KEY === '0x') {
    return { funded: false, reason: 'Funding wallet not configured (set FUNDING_WALLET_PRIVATE_KEY)' };
  }

  const fundingAccount = privateKeyToAccount(FUNDING_KEY as `0x${string}`);
  const fundingAddress = fundingAccount.address;

  // ── Check user's current USDC balance ────────────────────────────────────
  const userBalance = await getUSDCBalance(userAddress);
  console.log(`[Funding] User ${userAddress.slice(0, 8)}... balance: $${parseFloat(userBalance).toFixed(2)} USDC`);

  if (parseFloat(userBalance) >= parseFloat(MIN_BALANCE_THRESHOLD)) {
    return { funded: false, reason: `User already has $${parseFloat(userBalance).toFixed(2)} USDC (threshold: $${MIN_BALANCE_THRESHOLD})` };
  }

  // ── Check funding wallet has enough to send ──────────────────────────────
  const funderBalance = await getUSDCBalance(fundingAddress);
  if (parseFloat(funderBalance) < parseFloat(FUNDING_AMOUNT)) {
    return { funded: false, reason: `Funding wallet depleted (has $${parseFloat(funderBalance).toFixed(2)}, needs $${FUNDING_AMOUNT}). Refill from faucet.circle.com` };
  }

  // ── Send native USDC ─────────────────────────────────────────────────────
  try {
    const walletClient = createWalletClient({
      account: fundingAccount,
      chain,
      transport: http(ARC_RPC),
    });

    const txHash = await walletClient.sendTransaction({
      to: userAddress,
      value: parseEther(FUNDING_AMOUNT), // native USDC, 18 decimals
    });

    console.log(`[Funding] Sent $${FUNDING_AMOUNT} USDC to ${userAddress.slice(0, 8)}... — ${txHash}`);
    return { funded: true, txHash };
  } catch (e: any) {
    console.error('[Funding] Transfer failed:', e.message);
    return { funded: false, reason: `Transfer failed: ${e.message}` };
  }
}

/**
 * Get funding wallet address (for display/admin)
 */
export function getFundingWalletAddress(): string {
  if (!FUNDING_KEY || FUNDING_KEY === '0x') return 'not-configured';
  try {
    return privateKeyToAccount(FUNDING_KEY as `0x${string}`).address;
  } catch {
    return 'invalid-key';
  }
}
