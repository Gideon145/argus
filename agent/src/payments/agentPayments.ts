/**
 * Agent-to-Agent Nanopayments (RFB 3)
 * After each consensus, winning agents split a micro-reward pool.
 * Losing agents pay a tiny stake. Creates an internal agent economy.
 * All settled in native USDC on Arc testnet.
 */
import { ethers } from 'ethers';

const AGENT_KEYS: Record<string, string> = {
  'Agent-α': process.env.AGENT_ALPHA_PRIVATE_KEY || '',
  'Agent-β': process.env.AGENT_BETA_PRIVATE_KEY || '',
  'Agent-γ': process.env.AGENT_GAMMA_PRIVATE_KEY || '',
};

// 0.001 USDC in wei (18 decimals on Arc)
const MICRO_STAKE = ethers.parseUnits('0.001', 18);

interface PaymentRecord {
  from: string;
  to: string;
  amount: string;
  txHash: string;
  timestamp: string;
  reason: string;
}

// In-memory payment log (adds to store later if needed)
const paymentLog: PaymentRecord[] = [];

function getProvider() {
  const rpc = process.env.ARC_RPC_URL || 'https://rpc.testnet.arc-node.thecanteenapp.com';
  return new ethers.JsonRpcProvider(rpc);
}

export async function settleAgentPayments(
  winningAgents: string[],
  losingAgents: string[],
  queryId: string
): Promise<PaymentRecord[]> {
  const records: PaymentRecord[] = [];

  // Skip if no winners or no losers, or all agree
  if (losingAgents.length === 0 || winningAgents.length === 0) return records;

  try {
    const provider = getProvider();

    // Each losing agent pays 0.001 USDC, split equally among winners
    for (const loser of losingAgents) {
      const loserKey = AGENT_KEYS[loser];
      if (!loserKey) continue;

      const loserWallet = new ethers.Wallet(loserKey, provider);

      const sharePerWinner = MICRO_STAKE / BigInt(winningAgents.length);

      for (const winner of winningAgents) {
        const winnerKey = AGENT_KEYS[winner];
        if (!winnerKey) continue;

        const winnerWallet = new ethers.Wallet(winnerKey);
        const winnerAddr = winnerWallet.address;

        try {
          const tx = await loserWallet.sendTransaction({
            to: winnerAddr,
            value: sharePerWinner,
          });

          await tx.wait();

          records.push({
            from: loser,
            to: winner,
            amount: ethers.formatUnits(sharePerWinner, 18),
            txHash: tx.hash,
            timestamp: new Date().toISOString(),
            reason: `${loser} paid ${winner} for consensus disagreement on ${queryId}`,
          });

          console.log(`[AgentPay] ${loser} → ${winner}: ${ethers.formatUnits(sharePerWinner, 6)} USDC (tx: ${tx.hash.slice(0, 10)}...)`);
        } catch (err: any) {
          console.warn(`[AgentPay] Failed ${loser}→${winner}: ${err.message?.slice(0, 80)}`);
        }
      }
    }

    paymentLog.push(...records);
    // Keep only last 100 records
    if (paymentLog.length > 100) paymentLog.splice(0, paymentLog.length - 100);

  } catch (err: any) {
    console.warn('[AgentPay] Settlement error:', err.message?.slice(0, 80));
  }

  return records;
}

export function getPaymentLog(): PaymentRecord[] {
  return [...paymentLog];
}

export function getAgentPaymentStats() {
  return {
    totalPayments: paymentLog.length,
    totalVolume: paymentLog.reduce((sum, p) => sum + parseFloat(p.amount), 0).toFixed(6),
    recent: paymentLog.slice(-10),
  };
}
