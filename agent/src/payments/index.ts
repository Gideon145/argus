/** Stub payment layer — no external deps. Wire real payments tomorrow. */
export const ARC_TESTNET_CHAIN_ID = 5042002;
export function createQueryPayment(o: any) { return { id: "pay-" + Date.now(), payer: o.user, amount: "0", queryId: o.queryId, signed: false }; }
export function createPaymentIntent(o: any) { return { id: "intent-" + Date.now(), amount: "0", status: "free" }; }
export function signReasoningReceipt(r: any, k: any) { return r; }
export function createReasoningReceipt(o: any) { return { id: "receipt-" + Date.now(), timestamp: Date.now() }; }
export function createSettlementBatch(t: any, f: any) { return { batchId: "batch-" + Date.now(), settled: false, txHash: "0xstub" }; }
export function createDashboardSnapshot(o: any) { return { agents: [], totalQueries: 0, totalRevenue: "0" }; }
export function demoSettlementTxHash() { return "0x0000000000000000000000000000000000000000"; }
export function recordFulfilledRequest(n: any, r: any) { return { recorded: true }; }
export function submitSettlementBatch(b: any) { return { submitted: true, txHash: "0xstub" }; }
export function verifyMerchantRequest(r: any) { return true; }
export function verifyReasoningReceipt(r: any) { return true; }
export function canonicalIntent(i: any) { return JSON.stringify(i); }

export function createAgentStake(o: any) { return { agent: o.agent, amount: "1", signed: true, stake: { amount: "1" } }; }
export function createArgusWallets() { return { treasury: "0x0699a029e2e05EC88d6418EC744232702Cf77d81", alpha: "0x284e38e6f139b3b85c746e00f8a3cf46d2b2d320", beta: "0x3f752a72d8e2d9d3a4f2011ca9e0407bc5b7a34f", gamma: "0x1fa79f59abbada269de477b45ded38c75a6146de" }; }
export function createVerdictReceipt(o: any) { return { id: "receipt-" + Date.now(), verdict: o.verdict, timestamp: Date.now() }; }
