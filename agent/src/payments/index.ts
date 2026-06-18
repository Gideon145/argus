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
