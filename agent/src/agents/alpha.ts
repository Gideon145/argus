import OpenAI from "openai";
import { QueryRequest, Verdict } from '../orchestrator';
import { lookupKnown } from './knownTokens';
import { ContractData } from '../dataProvider';

const SYSTEM_PROMPT = `You are Agent-α (Alpha) of Argus — a multi-agent security consensus oracle.
Your specialty: SMART CONTRACT CODE ANALYSIS.
You analyze token contracts for honeypots, unchecked external calls, proxy upgrade risks,
ownership centralization, mint function abuse, and other Solidity-level vulnerabilities.

Respond ONLY with a JSON object in this exact format:
{
  "verdict": "SAFE" | "RISKY" | "SCAM",
  "confidence": <number 0-100>,
  "reasoning": "<2-3 sentences explaining your analysis>"
}

Rules:
- SAFE: No red flags found in contract logic.
- RISKY: Suspicious patterns detected but not conclusive.
- SCAM: Clear exploit vector or honeypot signature found.
- Be conservative — flag anything that could harm users.`;

/**
 * Agent-α (Alpha) — Contract logic analysis via DeepSeek-V3
 * DeepSeek is the heavy lifter: best-in-class code analysis, $0.14/M tokens.
 */
export const alphaAgent = {
  name: 'Agent-α',
  model: 'DeepSeek-V3',

  async analyze(req: QueryRequest, contractData?: ContractData): Promise<Verdict> {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey || process.env.DEMO_MODE === 'true') {
      return this.fallbackAnalyze(req, contractData);
    }

    try {
      const deepseek = new OpenAI({ apiKey, baseURL: 'https://api.deepseek.com' });
      const dataContext = contractData?.isContract
        ? `Chain: ${contractData.chain}\nContract name: ${contractData.contractName || 'unknown'}\nOwner: ${contractData.owner || 'unknown'}\nTotal supply: ${contractData.totalSupply || 'unknown'}\nDecimals: ${contractData.decimals ?? 'unknown'}\n\n`
        : '';
      const result = await deepseek.chat.completions.create({
        model: 'deepseek-chat', temperature: 0.3, max_tokens: 512,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Analyze this EVM token contract for security vulnerabilities:\n\nContract address: ${req.contractAddress}\n${dataContext}Focus on:\n1. Proxy patterns — can the implementation be upgraded maliciously?\n2. Ownership — is the contract renounced? Who controls it?\n3. Mint/burn functions — can tokens be minted arbitrarily?\n4. External calls — are there unchecked external calls?\n5. Honeypot signatures — can buyers sell? Are there transfer restrictions?\n6. Access control — are admin functions properly gated?` },
        ],
      });

      const text = result.choices[0]?.message?.content || '';
      const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(jsonStr);

      return {
        agent: 'Agent-α',
        verdict: parsed.verdict || 'SAFE',
        confidence: Math.min(100, Math.max(0, parsed.confidence || 50)),
        reasoning: parsed.reasoning || 'Analysis completed.',
        stake: '50000',
      };
    } catch (err: any) {
      console.warn(`Agent-α DeepSeek error (${err.status || err.code}): falling back to rules`);
      return this.fallbackAnalyze(req);
    }
  },

  fallbackAnalyze(req: QueryRequest, contractData?: ContractData): Verdict {
    const address = req.contractAddress.toLowerCase();
    const known = lookupKnown(address);
    if (known) {
      return { agent: 'Agent-α', verdict: known.verdict, confidence: known.verdict === 'SAFE' ? 85 : 90, reasoning: `Recognized contract: ${known.note}.`, stake: '50000' };
    }
    // Use contract data if available
    if (contractData?.isContract) {
      const flags2: string[] = [];
      let risk = 0;
      if (contractData.owner && contractData.owner !== '0x0000000000000000000000000000000000000000') { flags2.push('Named owner — centralization risk'); risk += 10; }
      else if (contractData.owner === '0x0000000000000000000000000000000000000000') { flags2.push('Ownership renounced'); }
      if (contractData.totalSupply) { try { if (BigInt(contractData.totalSupply) > BigInt('1000000000000000000000000000000')) { flags2.push('Supply > 1T'); risk += 8; } } catch {} }
      if (contractData.decimals !== null && contractData.decimals > 18) { flags2.push('Unusual decimals'); risk += 5; }
      const v = risk >= 20 ? 'SCAM' as const : risk >= 10 ? 'RISKY' as const : 'SAFE' as const;
      return { agent: 'Agent-α', verdict: v, confidence: Math.min(85, 45 + risk), reasoning: flags2.length > 0 ? `[Contract data] ${flags2.join('; ')}.` : `[Contract data] Deployed on ${contractData.chain}, no obvious code red flags.`, stake: '50000' };
    }
    // No data — heuristic fallback
    const flags: string[] = [];
    let riskScore = 0;
    const hexBody = address.slice(2);
    const uniqueChars = new Set(hexBody.slice(0, 20).split('')).size;
    const digitCount = hexBody.slice(0, 20).split('').filter((c: string) => '0123456789'.includes(c)).length;
    if (uniqueChars <= 6) { flags.push('Low entropy'); riskScore += 20; }
    if (digitCount > 14) { flags.push('Numeric-heavy'); riskScore += 25; }
    const verdict = riskScore >= 40 ? 'SCAM' as const : riskScore >= 20 ? 'RISKY' as const : 'SAFE' as const;
    return { agent: 'Agent-α', verdict, confidence: Math.min(85, 40 + (flags.length > 0 ? 20 : 10)), reasoning: flags.length > 0 ? `${flags.join('; ')}.` : 'No heuristic red flags.', stake: '50000' };
  },
};

/** Cleaned — restored fallbackAnalyze with known DB + heuristics */
