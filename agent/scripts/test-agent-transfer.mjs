/**
 * Test the DCW transfer path used for dissent settlement.
 * Run via: railway run node agent/scripts/test-agent-transfer.mjs
 */
import { initiateDeveloperControlledWalletsClient, generateEntitySecretCiphertext } from '@circle-fin/developer-controlled-wallets';
import { createWalletClient, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { randomUUID } from 'crypto';

const RPC = process.env.ARC_RPC_URL || 'https://rpc.testnet.arc-node.thecanteenapp.com';

const AGENTS = {
  alpha: { id: 'c4aefed1-389e-54ea-b6bb-38badf181a89', address: '0x07c8a0ceccf7af4f260bdcb02c464753887a8de7' },
  beta: { id: '679a208b-9852-50b4-b6dd-8bef0e2cb9b0', address: '0x63d813f592957f12982c69e54a1dcb022982a556' },
  gamma: { id: 'fa4b5c94-b12c-5801-bb7f-7aaff5cb3b70', address: '0x9083c68bf42f5ddf6c93bd45166ffcf9d4563baf' },
};

async function main() {
  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
  const fundKey = process.env.FUNDING_WALLET_PRIVATE_KEY;
  if (!apiKey || !entitySecret || !fundKey) {
    throw new Error('Missing env');
  }
  const client = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });

  // 1. Top up gamma with what the funding wallet can afford (target 10)
  console.log('[test] topping up gamma with 10 USDC...');
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
  try {
    const h = await wc.sendTransaction({ to: AGENTS.gamma.address, value: parseEther('10') });
    console.log('[test] gamma funded:', h);
  } catch (e) {
    console.error('[test] gamma funding failed:', e?.shortMessage || e?.message || e);
  }

  // 2. DCW transfer alpha -> beta 0.0005 USDC
  console.log('[test] DCW transfer alpha -> beta 0.0005...');
  const cipher = await generateEntitySecretCiphertext({ apiKey, entitySecret });
  console.log('[test] ciphertext generated:', cipher.slice(0, 24) + '...');
  const raw = client.params.client.Transactions;
  try {
    const tx = await raw.createDeveloperTransactionTransfer({
      idempotencyKey: randomUUID(),
      walletId: AGENTS.alpha.id,
      tokenId: process.env.CIRCLE_USDC_TOKEN_ID || '15dc2b5d-0994-58b0-bf8c-3a0501148ee8',
      destinationAddress: AGENTS.beta.address,
      amounts: ['0.0005'],
      feeLevel: 'LOW',
      entitySecretCiphertext: cipher,
    });
    console.log('[test] transfer response:', JSON.stringify(tx.data, null, 2));
    console.log('[test] DONE');
  } catch (e) {
    const body = e?.response?.data;
    console.error('[test] transfer 400 body:', JSON.stringify(body, null, 2));
    throw e;
  }
}

main().catch((e) => {
  console.error('[test] FAILED:', e?.message || e);
  process.exit(1);
});
