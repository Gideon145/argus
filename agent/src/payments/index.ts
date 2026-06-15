/**
 * Argus Payment Layer — adapted from arc-agent-pay (rick-best)
 * Canteen-endorsed payment intent toolkit for AI agents on Arc.
 * 
 * Provides: payment intents, signed receipts, settlement batches,
 * nonce replay protection, merchant verification.
 */

import { privateKeyToAccount } from "viem/accounts";
import {
  ARC_TESTNET_CHAIN_ID,
  canonicalIntent,
  createPaymentIntent,
  createReasoningReceipt,
  createSettlementBatch,
  createDashboardSnapshot,
  demoSettlementTxHash,
  recordFulfilledRequest,
  signReasoningReceipt,
  submitSettlementBatch,
  verifyMerchantRequest,
  verifyReasoningReceipt,
} from "../../../arc-agent-pay-reference/src/index.js";

import type {
  PaymentIntent,
  SignedPaymentIntent,
  ReasoningReceipt,
  SignedReasoningReceipt,
  SettlementBatch,
  FulfilledRequest,
} from "../../../arc-agent-pay-reference/src/types.js";

export {
  ARC_TESTNET_CHAIN_ID,
  canonicalIntent,
  createPaymentIntent,
  createReasoningReceipt,
  createSettlementBatch,
  createDashboardSnapshot,
  demoSettlementTxHash,
  recordFulfilledRequest,
  signReasoningReceipt,
  submitSettlementBatch,
  verifyMerchantRequest,
  verifyReasoningReceipt,
};

export type {
  PaymentIntent,
  SignedPaymentIntent,
  ReasoningReceipt,
  SignedReasoningReceipt,
  SettlementBatch,
  FulfilledRequest,
};

/**
 * Argus wallet setup: create 3 agent signers + 1 treasury merchant
 */
export function createArgusWallets() {
  return {
    alpha: privateKeyToAccount(process.env.AGENT_ALPHA_PRIVATE_KEY as `0x${string}`),
    beta: privateKeyToAccount(process.env.AGENT_BETA_PRIVATE_KEY as `0x${string}`),
    gamma: privateKeyToAccount(process.env.AGENT_GAMMA_PRIVATE_KEY as `0x${string}`),
    treasury: process.env.TREASURY_ADDRESS as `0x${string}`,
  };
}

/** Nonce store for replay protection */
export function createNonceStore(): Set<string> {
  return new Set<string>();
}

/**
 * Create a query payment intent — user pays $0.01 USDC
 */
export function createQueryPayment(opts: {
  user: `0x${string}`;
  queryId: string;
}) {
  return createPaymentIntent({
    chainId: ARC_TESTNET_CHAIN_ID,
    merchant: process.env.TREASURY_ADDRESS as `0x${string}`,
    payer: opts.user,
    serviceId: "argus-security-scan",
    amountMicrousd: "10000", // $0.01 USDC
    nonce: opts.queryId,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 min
    metadata: {
      product: "Argus",
      queryId: opts.queryId,
    },
  });
}

/**
 * Create an agent stake payment — agent stakes $0.05 USDC on verdict
 */
export function createAgentStake(opts: {
  agentId: string;
  verdict: string;
  queryId: string;
}) {
  const agentKey = 
    opts.agentId === 'Agent-α' ? process.env.AGENT_ALPHA_PRIVATE_KEY :
    opts.agentId === 'Agent-β' ? process.env.AGENT_BETA_PRIVATE_KEY :
    process.env.AGENT_GAMMA_PRIVATE_KEY;

  const agent = privateKeyToAccount(agentKey as `0x${string}`);

  return createPaymentIntent({
    chainId: ARC_TESTNET_CHAIN_ID,
    merchant: process.env.TREASURY_ADDRESS as `0x${string}`,
    payer: agent.address,
    serviceId: "argus-agent-stake",
    amountMicrousd: "50000", // $0.05 USDC
    nonce: `${opts.queryId}-${opts.agentId}`,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    metadata: {
      product: "Argus Stake",
      agentId: opts.agentId,
      verdict: opts.verdict,
      queryId: opts.queryId,
    },
  });
}

/**
 * Create a signed reasoning receipt for an agent's verdict
 */
export async function createVerdictReceipt(opts: {
  agentId: string;
  verdict: string;
  confidence: number;
  reasoning: string;
  queryId: string;
}) {
  const agentKey =
    opts.agentId === 'Agent-α' ? process.env.AGENT_ALPHA_PRIVATE_KEY :
    opts.agentId === 'Agent-β' ? process.env.AGENT_BETA_PRIVATE_KEY :
    process.env.AGENT_GAMMA_PRIVATE_KEY;

  const agent = privateKeyToAccount(agentKey as `0x${string}`);

  const artifact = {
    agentId: opts.agentId,
    verdict: opts.verdict,
    confidence: opts.confidence,
    reasoning: opts.reasoning,
    queryId: opts.queryId,
    timestamp: new Date().toISOString(),
  };

  const receipt = createReasoningReceipt({
    artifactId: `${opts.queryId}-${opts.agentId}`,
    artifact,
    signer: agent.address,
    chainId: ARC_TESTNET_CHAIN_ID,
    metadata: {
      product: "Argus Verdict",
      receiptType: "agent-verdict",
      queryId: opts.queryId,
      agentId: opts.agentId,
    },
  });

  return signReasoningReceipt(agent, receipt);
}
