/**
 * Funding Wallet — auto-sends test USDC to new users on wallet connect.
 * 
 * Architecture:
 *   Arc Faucet → Funding Wallet → User's Wallet → Gateway x402 → Treasury Wallet
 * 
 * The Funding Wallet is a gas tank that onboards users with free test USDC.
 * Refill it periodically from the Arc testnet faucet.
 */

import { createWalletClient, http, parseUnits, formatUnits, getContract } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

// ── Config ──────────────────────────────────────────────────────────────────
const ARC_TESTNET_CHAIN_ID = 5042002;
const ARC_RPC = process.env.ARC_RPC_URL || 'https://rpc.testnet.arc-node.thecanteenapp.com';

// Arc testnet USDC contract
const USDC_ADDRESS = '0x07865c6E87B9A5e213Ae308bA4F8a9AaDF7E2B0C';

// ERC-20 ABI (minimal — balanceOf + transfer + decimals)
const ERC20_ABI = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ name: 'balance', type: 'uint256' }] },
  { name: 'transfer', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: 'success', type: 'bool' }] },
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint8' }] },
] as const;

// ── Funding Wallet ──────────────────────────────────────────────────────────
const FUNDING_KEY = process.env.FUNDING_WALLET_PRIVATE_KEY || '';
const FUNDING_AMOUNT = '5'; // $5 test USDC per new user
const MIN_BALANCE_THRESHOLD = '1'; // Only fund if user has < $1 USDC

const chain = {
  id: ARC_TESTNET_CHAIN_ID,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
  rpcUrls: { default: { http: [ARC_RPC] } },
} as const;

/**
 * Get USDC balance for an address
 */
export async function getUSDCBalance(address: `0x${string}`): Promise<string> {
  try {
    const publicClient = createWalletClient({
      chain,
      transport: http(ARC_RPC),
    });

    // Use raw eth_call for balanceOf
    const data = `0x70a08231000000000000000000000000${address.slice(2).padStart(64, '0')}`;
    const result = await publicClient.request({
      method: 'eth_call' as any,
      // @ts-ignore
      params: [{ to: USDC_ADDRESS, data }, 'latest'],
    });

    const balance = BigInt(result as string);
    return formatUnits(balance, 6);
  } catch (e: any) {
    console.warn('[Funding] balanceOf failed:', e.message);
    return '0';
  }
}

/**
 * Send test USDC to a user if their balance is below threshold.
 * Returns { funded: true, txHash } if sent, { funded: false, reason } if skipped.
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
  console.log(`[Funding] User ${userAddress.slice(0, 8)}... balance: $${userBalance} USDC`);

  if (parseFloat(userBalance) >= parseFloat(MIN_BALANCE_THRESHOLD)) {
    return { funded: false, reason: `User already has $${userBalance} USDC (threshold: $${MIN_BALANCE_THRESHOLD})` };
  }

  // ── Check funding wallet has enough to send ──────────────────────────────
  const funderBalance = await getUSDCBalance(fundingAddress);
  if (parseFloat(funderBalance) < parseFloat(FUNDING_AMOUNT)) {
    return { funded: false, reason: `Funding wallet depleted (has $${funderBalance}, needs $${FUNDING_AMOUNT}). Refill from faucet.` };
  }

  // ── Send USDC ────────────────────────────────────────────────────────────
  try {
    const walletClient = createWalletClient({
      account: fundingAccount,
      chain,
      transport: http(ARC_RPC),
    });

    const amount = parseUnits(FUNDING_AMOUNT, 6);

    const txHash = await walletClient.sendTransaction({
      to: USDC_ADDRESS,
      data: `0xa9059cbb${userAddress.slice(2).padStart(64, '0')}${amount.toString(16).padStart(64, '0')}`,
      value: 0n,
    });

    console.log(`[Funding] Sent $${FUNDING_AMOUNT} test USDC to ${userAddress.slice(0, 8)}... — ${txHash}`);
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
