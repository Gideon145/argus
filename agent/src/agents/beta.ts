import Anthropic from "@anthropic-ai/sdk";
import { QueryRequest, Verdict } from '../orchestrator';
import { lookupKnown } from './knownTokens';
import { ContractData } from '../dataProvider';

const SYSTEM_PROMPT = `You are Agent-β (Beta) of Argus — a multi-agent security consensus oracle.
Your specialty: ON-CHAIN DATA ANALYSIS AND TOKENOMICS.

You receive contract metadata. Analyze it and return a verdict. Be decisive.
If metadata is empty/unknown, that IS the signal — unverified unknown contracts are RISKY.

Respond ONLY with JSON:
{
  "verdict": "SAFE" | "RISKY" | "SCAM",
  "confidence": <number 0-100>,
  "reasoning": "<2-3 sentences>"
}

Rules:
- Verified contract + known name + reasonable supply + renounced/zero owner → SAFE
- Unverified OR unknown name → RISKY. State: "Unverified contract, no source available on Etherscan."
- Supply 0 or >1T or decimals > 18 → SCAM
- If EVERY metadata field is empty/unknown → RISKY. "Contract data unavailable — this is an unverified or non-existent contract."
- NEVER say "no metadata provided" — the absence of data IS the signal.
- ALWAYS give a verdict. Never hedge. Never abstain.`;

/**
 * Agent-β (Beta) — Tokenomics analysis via Claude Sonnet 4.5
 */
export const betaAgent = {
  name: 'Agent-β',
  model: 'Claude Sonnet 4.5',

  async analyze(req: QueryRequest, contractData?: ContractData): Promise<Verdict> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || process.env.DEMO_MODE === 'true') {
      return this.fallbackAnalyze(req, contractData);
    }

    try {
      const anthropic = new Anthropic({ apiKey });
      const dataContext = contractData?.isContract
        ? `Chain: ${contractData.chain}\nContract name: ${contractData.contractName || 'unknown'}\nOwner: ${contractData.owner || 'unknown'}\nTotal supply: ${contractData.totalSupply || 'unknown'}\nDecimals: ${contractData.decimals ?? 'unknown'}\n\n`
        : '';
      const result = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 512,
        temperature: 0.3,
        system: SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: `Address: ${req.contractAddress}\n\n${dataContext}Give a confident verdict based on the metadata above.` },
        ],
      });

      const text = result.content[0]?.type === 'text' ? result.content[0].text : '';
      const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(jsonStr);

      return {
        agent: 'Agent-β',
        verdict: parsed.verdict || 'SAFE',
        confidence: Math.min(100, Math.max(0, parsed.confidence || 50)),
        reasoning: parsed.reasoning || 'Analysis completed.',
        stake: '50000',
      };
    } catch (err: any) {
      console.warn(`Agent-β error (${err.status || err.code || err.message}): falling back to rules`);
      return this.fallbackAnalyze(req);
    }
  },

  fallbackAnalyze(req: QueryRequest, contractData?: ContractData): Verdict {
    const address = req.contractAddress.toLowerCase();
    const known = lookupKnown(address);
    if (known) {
      return { agent: 'Agent-β', verdict: known.verdict, confidence: known.verdict === 'SAFE' ? 85 : 88, reasoning: `Recognized token: ${known.note}.`, stake: '50000' };
    }
    if (contractData?.isContract) {
      const f: string[] = [];
      let r = 0;
      const isLegit = contractData.hasSource && contractData.contractName && contractData.contractName.length > 0;
      if (isLegit) { f.push(`Verified: ${contractData.contractName}`); r -= 12; }
      if (contractData.owner && contractData.owner !== '0x0000000000000000000000000000000000000000') {
        if (!isLegit) { f.push(`Unverified owner: ${contractData.owner.slice(0,8)}...`); r += 8; }
        else { f.push(`Owner: ${contractData.owner.slice(0,8)}...`); }
      } else if (contractData.owner === '0x0000000000000000000000000000000000000000') { f.push('Renounced'); r -= 3; }
      if (contractData.totalSupply) { try { const s = BigInt(contractData.totalSupply); if (s > BigInt('1000000000000000000000000000000')) { f.push('Supply > 1T'); r += 10; } else if (s < BigInt('1000000')) { f.push('Low supply'); r += 5; } } catch {} }
      if (contractData.decimals !== null && contractData.decimals > 18) { f.push('Decimals > 18'); r += 8; }
      const v = r >= 20 ? 'SCAM' as const : r >= 8 ? 'RISKY' as const : 'SAFE' as const;
      const detail = contractData.contractName ? `Token: ${contractData.contractName}, ` : '';
      return { agent: 'Agent-β', verdict: v, confidence: Math.min(80, 45 + r), reasoning: `[β] ${detail}Supply=${contractData.totalSupply?.slice(0,12) || '?'}, Decimals=${contractData.decimals ?? '?'}. ${f.join('; ') || 'Tokenomics appear normal'}.`, stake: '50000' };
    }
    const flags: string[] = [];
    let riskScore = 0;
    const hexBody = address.slice(2);
    const uniqueChars = new Set(hexBody.slice(0, 20).split('')).size;
    if (uniqueChars <= 5) { flags.push('Extremely low entropy'); riskScore += 25; }
    const digitCount = hexBody.slice(0, 20).split('').filter((c: string) => '0123456789'.includes(c)).length;
    if (digitCount > 14) { flags.push('Numeric-heavy pattern'); riskScore += 20; }
    const verdict = riskScore >= 35 ? 'SCAM' as const : riskScore >= 18 ? 'RISKY' as const : 'SAFE' as const;
    return { agent: 'Agent-β', verdict, confidence: Math.min(80, 35 + (flags.length > 0 ? 15 : 10)), reasoning: flags.length > 0 ? `${flags.join('; ')}.` : 'No tokenomic red flags from address analysis.', stake: '50000' };
  },
};
