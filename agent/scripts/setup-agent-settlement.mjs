/**
 * One-time setup: create three agent SCAs in the Circle wallet set,
 * fund each with 20 USDC from the funding wallet, and run a live
 * test of the DCW transfer path used for dissent settlement.
 * Run via: railway run node agent/scripts/setup-agent-settlement.mjs
 */
import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import { createWalletClient, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { randomUUID } from 'crypto';

const RPC = process.env.ARC_RPC_URL || 'https://rpc.testnet.arc-node.thecanteenapp.com';

async function main() {
  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
  const set = process.env.WALLET_SET_ID;
  const fundKey = process.env.FUNDING_WALLET_PRIVATE_KEY;
  if (!apiKey || !entitySecret || !set || !fundKey) {
    throw new Error('Missing env: CIRCLE_API_KEY / CIRCLE_ENTITY_SECRET / WALLET_SET_ID / FUNDING_WALLET_PRIVATE_KEY');
  }
  const client = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });

  // 1. Create three SCA agent wallets
  console.log('[setup] creating 3 agent SCAs...');
  const created = await client.createWallets({
    idempotencyKey: randomUUID(),
    walletSetId: set,
    blockchains: ['ARC-TESTNET'],
    count: 3,
    accountType: 'SCA',
  });
  const wallets = created.data.wallets;
  const [alpha, beta, gamma] = wallets;
  console.log('[setup] alpha:', alpha.id, alpha.address);
  console.log('[setup] beta :', beta.id, beta.address);
  console.log('[setup] gamma:', gamma.id, gamma.address);

  // 2. Fund each with 20 USDC from the funding EOA (native gas token on Arc)
  const funder = privateKeyToAccount(fundKey);
  const wc = createWalletClient({
    account: funder,
    chain: {
      id: 5042002,
      name: 'Arc Testnet',
      nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
      rpcUrls: { default: { http: [RPC] } },
    },
    transport: http(RPC),
  });

  for (const [name, w] of [['alpha', alpha], ['beta', beta], ['gamma', gamma]]) {
    console.log(`[setup] funding ${name} with 20 USDC...`);
    const h = await wc.sendTransaction({ to: w.address, value: parseEther('20') });
    console.log(`[setup] ${name} funded: ${h}`);
  }

  // 3. Test DCW transfer: alpha -> beta, 0.0005 USDC (native)
  console.log('[setup] test transfer alpha -> beta 0.0005 USDC...');
  const tx = await client.createDeveloperTransactionTransfer({
    idempotencyKey: randomUUID(),
    walletId: alpha.id,
    tokenId: process.env.CIRCLE_USDC_TOKEN_ID || '5797fbd6-3795-519d-84ca-ec4c5f80c3b1',
    destinationAddress: beta.address,
    amounts: ['0.0005'],
    feeLevel: 'LOW',
  });
  console.log('[setup] transfer response:', JSON.stringify(tx.data, null, 2));
  console.log('[setup] DONE');
}

main().catch((e) => {
  console.error('[setup] FAILED:', e?.message || e);
  process.exit(1);
});
