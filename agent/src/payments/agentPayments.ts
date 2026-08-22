/**
 * Agent-to-Agent Nanopayments (RFB 3)
 * After each consensus, winning agents split a micro-reward pool.
 * Losing agents pay a tiny stake through their Circle SCA wallets,
 * settled on-chain in native USDC on Arc testnet.
 */
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import {
  initiateDeveloperControlledWalletsClient,
  generateEntitySecretCiphertext,
} from '@circle-fin/developer-controlled-wallets';

const DATA_DIR = process.env.DATA_DIR || '/argus-data';
const PAYMENTS_FILE = path.join(DATA_DIR, 'agent_payments.json');

// Native USDC on Arc testnet (Circle token id, isNative)
const ARC_USDC_TOKEN_ID =
  process.env.CIRCLE_USDC_TOKEN_ID || '15dc2b5d-0994-58b0-bf8c-3a0501148ee8';

// Agent SCA wallets — Circle-managed, each holds a flat 20 USDC stake
const AGENT_WALLETS: Record<string, { id: string; address: string }> = {
  'Agent-α': {
    id: process.env.AGENT_ALPHA_WALLET_ID || 'c4aefed1-389e-54ea-b6bb-38badf181a89',
    address:
      process.env.AGENT_ALPHA_WALLET_ADDRESS || '0x07c8a0ceccf7af4f260bdcb02c464753887a8de7',
  },
  'Agent-β': {
    id: process.env.AGENT_BETA_WALLET_ID || '679a208b-9852-50b4-b6dd-8bef0e2cb9b0',
    address:
      process.env.AGENT_BETA_WALLET_ADDRESS || '0x63d813f592957f12982c69e54a1dcb022982a556',
  },
  'Agent-γ': {
    id: process.env.AGENT_GAMMA_WALLET_ID || 'fa4b5c94-b12c-5801-bb7f-7aaff5cb3b70',
    address:
      process.env.AGENT_GAMMA_WALLET_ADDRESS || '0x9083c68bf42f5ddf6c93bd45166ffcf9d4563baf',
  },
};

// Base micro-stake: 0.0005 USDC, scaled by agent confidence
// confidence=100 → 0.001 USDC | confidence=50 → 0.0005 USDC
const BASE_STAKE = 0.0005;

interface PaymentRecord {
  from: string;
  to: string;
  amount: string;
  txHash: string;
  timestamp: string;
  reason: string;
}

// Load persisted payment log — keep only real on-chain settlements
function loadPayments(): PaymentRecord[] {
  try {
    if (fs.existsSync(PAYMENTS_FILE)) {
      const data = JSON.parse(fs.readFileSync(PAYMENTS_FILE, 'utf8'));
      if (Array.isArray(data)) {
        return data.filter(
          (p: any) => typeof p.txHash === 'string' && p.txHash.startsWith('0x')
        );
      }
    }
  } catch (e) { /* ignore */ }
  return [];
}

function savePayments(log: PaymentRecord[]) {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(PAYMENTS_FILE, JSON.stringify(log.slice(-100), null, 2), 'utf8');
  } catch (e) { /* ignore */ }
}

const paymentLog: PaymentRecord[] = loadPayments();

// Lazy Circle client (entity secret ciphertext is single-use, generated per transfer)
let circleClient: any = null;

function getCircle() {
  if (!circleClient) {
    const apiKey = process.env.CIRCLE_API_KEY;
    const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
    if (!apiKey || !entitySecret) return null;
    circleClient = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });
  }
  return circleClient;
}

async function freshCiphertext(): Promise<string | null> {
  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
  if (!apiKey || !entitySecret) return null;
  try {
    return await generateEntitySecretCiphertext({ apiKey, entitySecret });
  } catch (e: any) {
    console.warn('[AgentPay] ciphertext generation failed:', e?.message?.slice(0, 80) || e);
    return null;
  }
}

export async function settleAgentPayments(
  winningAgents: string[],
  losingAgents: string[],
  queryId: string,
  agentConfidences?: Record<string, number>
): Promise<PaymentRecord[]> {
  const records: PaymentRecord[] = [];

  if (losingAgents.length === 0 || winningAgents.length === 0) return records;

  const c = getCircle();
  const walletsReady =
    !!AGENT_WALLETS['Agent-α'].id &&
    !!AGENT_WALLETS['Agent-β'].id &&
    !!AGENT_WALLETS['Agent-γ'].id;

  if (!c || !walletsReady) {
    // No Circle rail configured — log only, no on-chain settlement
    for (const loser of losingAgents) {
      for (const winner of winningAgents) {
        const record: PaymentRecord = {
          from: loser,
          to: winner,
          amount: '0.0005',
          txHash: `local-${queryId}-${loser.slice(-4)}-${winner.slice(-4)}`,
          timestamp: new Date().toISOString(),
          reason: `Dissent recorded on ${queryId}`,
        };
        paymentLog.push(record);
        records.push(record);
      }
    }
    savePayments(paymentLog);
    return records;
  }

  for (const loser of losingAgents) {
    const loserWallet = AGENT_WALLETS[loser];
    if (!loserWallet?.id) continue;

    // Confidence-weighted: stake = BASE_STAKE * (2 * confidenceRatio)
    const loserConf = (agentConfidences?.[loser] ?? 75) / 100;
    const scaledStake = BASE_STAKE * 2 * loserConf;
    const sharePerWinner = +(scaledStake / winningAgents.length).toFixed(6);

    for (const winner of winningAgents) {
      const winnerWallet = AGENT_WALLETS[winner];
      if (!winnerWallet?.address) continue;
      try {
        const ct = await freshCiphertext();
        if (!ct) throw new Error('ciphertext unavailable');
        const tx = await c.params.client.Transactions.createDeveloperTransactionTransfer({
          idempotencyKey: randomUUID(),
          walletId: loserWallet.id,
          tokenId: ARC_USDC_TOKEN_ID,
          destinationAddress: winnerWallet.address,
          amounts: [String(sharePerWinner)],
          feeLevel: 'LOW',
          entitySecretCiphertext: ct,
        });
        const txId = tx.data?.data?.id;
        let txHash = '';
        for (let i = 0; i < 10 && txId; i++) {
          await new Promise((r) => setTimeout(r, 3000));
          try {
            const detail = await c.params.client.Transactions.getTransaction(txId);
            const t = detail.data?.data?.transaction;
            if (t?.state === 'COMPLETE') {
              txHash = t.txHash || '';
              break;
            }
            if (t?.state === 'FAILED') break;
          } catch {
            break;
          }
        }
        const record: PaymentRecord = {
          from: loser,
          to: winner,
          amount: String(sharePerWinner),
          txHash: txHash || txId,
          timestamp: new Date().toISOString(),
          reason: `${loser} paid ${winner} for consensus disagreement on ${queryId}`,
        };
        paymentLog.push(record);
        records.push(record);
        console.log(
          `[AgentPay] ${loser} → ${winner}: ${sharePerWinner} USDC (tx: ${(txHash || txId).slice(0, 10)}...)`
        );
      } catch (e: any) {
        console.warn(
          `[AgentPay] Failed ${loser}→${winner}: ${e?.response?.data?.message || e?.message?.slice(0, 80) || e}`
        );
      }
    }
  }

  // Keep only last 100 records
  if (paymentLog.length > 100) paymentLog.splice(0, paymentLog.length - 100);
  savePayments(paymentLog);

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
