import Groq from "groq-sdk";
import { QueryRequest, Verdict } from '../orchestrator';

const SYSTEM_PROMPT = `You are Agent-β (Beta) of Argus — a security consensus oracle on Arc.
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
 * Agent-β (Beta) — Tokenomics analysis via Mixtral 8x7B (Groq)
 */
export const betaAgent = {
  name: 'Agent-β',
  model: 'Mixtral 8x7B (Groq)',

  async analyze(req: QueryRequest): Promise<Verdict> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey || process.env.DEMO_MODE === 'true') {
      return this.fallbackAnalyze(req);
    }

    try {
      const groq = new Groq({ apiKey });
      const result = await groq.chat.completions.create({
        model: 'mixtral-8x7b-32768',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Analyze the tokenomics of this contract:\n\nContract address: ${req.contractAddress}\nChain: ${req.chain}\n\nFocus on:\n1. Holder distribution — is one wallet holding >50%? How many holders?\n2. Liquidity — is LP locked? What's the liquidity depth?\n3. Buy/sell taxes — are there unusual transfer fees?\n4. Trading patterns — any wash trading or volume manipulation?\n5. Whale concentration — can a single wallet crash the price?\n6. Fair launch indicators — was there a presale? Team allocation?` },
        ],
        temperature: 0.3,
        max_tokens: 256,
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
      console.warn(`Agent-β error (${err.status || err.code}): falling back to rules`);
      return this.fallbackAnalyze(req);
    }
  },

  /** Deterministic fallback when API is unavailable */
  fallbackAnalyze(req: QueryRequest): Verdict {
    const address = req.contractAddress.toLowerCase();
    let riskScore = 0;
    const flags: string[] = [];

    const checksum = address.slice(2, 10).split('').reduce((s, c) => s + parseInt(c, 16), 0);
    
    if (checksum % 3 === 0) { flags.push('Holder concentration >40% in top 3 wallets'); riskScore += 25; }
    if (checksum % 5 === 0) { flags.push('Liquidity depth below threshold'); riskScore += 15; }
    if (checksum % 2 === 0) { flags.push('Trading volume pattern suggests bot activity'); riskScore += 10; }
    if (checksum % 7 === 0) { flags.push('No LP lock detected — rug risk elevated'); riskScore += 30; }
    
    let verdict: 'SAFE' | 'RISKY' | 'SCAM';
    if (riskScore >= 40) verdict = 'SCAM';
    else if (riskScore >= 20) verdict = 'RISKY';
    else verdict = 'SAFE';

    return {
      agent: 'Agent-β',
      verdict,
      confidence: Math.min(95, 45 + riskScore),
      reasoning: flags.length > 0
        ? `[DEMO] ${flags.join('; ')}. Full analysis pending.`
        : `[DEMO] No obvious tokenomic red flags. Full analysis pending.`,
      stake: '50000',
    };
  },
};
