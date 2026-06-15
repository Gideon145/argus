import { GoogleGenerativeAI } from "@google/generative-ai";
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
 * Agent-β (Beta) — Tokenomics analysis via Gemini 2.0 Flash
 */
export const betaAgent = {
  name: 'Agent-β',
  model: 'Gemini 2.0 Flash',

  async analyze(req: QueryRequest): Promise<Verdict> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: SYSTEM_PROMPT,
    });

    const prompt = `Analyze the tokenomics of this contract:

Contract address: ${req.contractAddress}
Chain: ${req.chain}

Focus on:
1. Holder distribution — is one wallet holding >50%? How many holders?
2. Liquidity — is LP locked? What's the liquidity depth?
3. Buy/sell taxes — are there unusual transfer fees?
4. Trading patterns — any wash trading or volume manipulation?
5. Whale concentration — can a single wallet crash the price?
6. Fair launch indicators — was there a presale? Team allocation?`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    try {
      const parsed = JSON.parse(jsonStr);
      return {
        agent: 'Agent-β',
        verdict: parsed.verdict || 'SAFE',
        confidence: Math.min(100, Math.max(0, parsed.confidence || 50)),
        reasoning: parsed.reasoning || 'Analysis completed.',
        stake: '50000',
      };
    } catch {
      return {
        agent: 'Agent-β',
        verdict: 'RISKY',
        confidence: 50,
        reasoning: 'Analysis completed but response parsing failed — conservative default applied.',
        stake: '50000',
      };
    }
  },
};
