import { createWalletClient, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import dotenv from 'dotenv';
import path from 'node:path';
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const rpc = process.env.ARC_RPC_URL || 'https://rpc.testnet.arc-node.thecanteenapp.com';
const chain = { id: 5042002, name: 'Arc Testnet', nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 }, rpcUrls: { default: { http: [rpc] } } } as const;

async function main() {
  const client = createWalletClient({ chain, transport: http(rpc) });
  const funder = privateKeyToAccount(process.env.FUNDING_WALLET_PRIVATE_KEY as `0x${string}`);

  const agentKeys = [
    process.env.AGENT_ALPHA_PRIVATE_KEY,
    process.env.AGENT_BETA_PRIVATE_KEY,
    process.env.AGENT_GAMMA_PRIVATE_KEY,
  ];

  for (const key of agentKeys) {
    if (!key) continue;
    const acct = privateKeyToAccount(key as `0x${string}`);
    const tx = await client.sendTransaction({ account: funder, to: acct.address, value: parseEther('1') });
    console.log(`Funded ${acct.address.slice(0, 10)}... $1 USDC | tx: ${tx.slice(0, 10)}...`);
  }
  console.log('Done — all 3 agent EOAs funded');
}

main().catch(e => { console.error(e.message); process.exit(1); });
