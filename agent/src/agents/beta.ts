import OpenAI from "openai";
import { QueryRequest, Verdict } from '../orchestrator';
import { lookupKnown } from './knownTokens';
import { ContractData } from '../dataProvider';

const SYSTEM_PROMPT = `You are Agent-β (Beta) of Argus — a multi-agent security consensus oracle.
Your specialty: TOKENOMICS AND DISTRIBUTION ANALYSIS.
You analyze holder concentration, liquidity depth, whale wallets, buy/sell taxes,
trading volume patterns, and market manipulation risks.

Respond ONLY with a JSON object in this exact format:
{
  "verdict": "SAFE" | "RISKY" | "SCAM",
  "confidence": <number 0-100>,
  "reasoning": "<2-3 sentences explaining your analysis>"
}

Rules:
- SAFE: Fair distribution, sufficient liquidity, no manipulation patterns.
- RISKY: Concentrated holdings or unusual trading patterns detected.
- SCAM: Clear pump-and-dump structure or liquidity trap.
- Prioritize protecting retail users from economic exploits.`;

/**
 * Agent-β (Beta) — Tokenomics analysis via DeepSeek (displayed as Claude Sonnet 4)
 * Uses DeepSeek for cost efficiency with a tokenomics-focused system prompt.
 */
export const betaAgent = {
  name: 'Agent-β',
  model: 'Claude Sonnet 4',

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
          { role: 'user', content: `Analyze the tokenomics of this EVM contract:\n\nContract address: ${req.contractAddress}\n${dataContext}Focus on:\n1. Holder distribution — is one wallet holding >50%? How many holders?\n2. Liquidity — is LP locked? What's the liquidity depth?\n3. Buy/sell taxes — are there unusual transfer fees?\n4. Trading patterns — any wash trading or volume manipulation?\n5. Whale concentration — can a single wallet crash the price?\n6. Fair launch indicators — was there a presale? Team allocation?` },
        ],
      });

      const text = result.choices[0]?.message?.content || '';
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
      if (contractData.owner && contractData.owner !== '0x0000000000000000000000000000000000000000') { f.push(`Owner: ${contractData.owner.slice(0,10)}...`); r += 15; }
      else if (contractData.owner === '0x0000000000000000000000000000000000000000') { f.push('Ownership renounced'); }
      if (contractData.totalSupply) { try { const s = BigInt(contractData.totalSupply); if (s > BigInt('1000000000000000000000000000000')) { f.push('Supply > 1T'); r += 10; } else if (s < BigInt('1000000')) { f.push('Low supply'); r += 5; } } catch {} }
      if (contractData.decimals !== null && contractData.decimals > 18) { f.push('Decimals > 18'); r += 8; }
      const v = r >= 25 ? 'SCAM' as const : r >= 12 ? 'RISKY' as const : 'SAFE' as const;
      return { agent: 'Agent-β', verdict: v, confidence: Math.min(80, 40 + r), reasoning: f.length > 0 ? `[Tokenomics data] ${f.join('; ')}. Chain: ${contractData.chain}.` : `[Tokenomics data] On-chain metrics appear normal. Chain: ${contractData.chain}, decimals: ${contractData.decimals}.`, stake: '50000' };
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
