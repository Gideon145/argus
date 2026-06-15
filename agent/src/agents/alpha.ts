import { GoogleGenerativeAI } from "@google/generative-ai";
import { QueryRequest, Verdict } from '../orchestrator';

const SYSTEM_PROMPT = `You are Agent-α (Alpha) of Argus — a security consensus oracle on Arc.
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
 * Agent-α (Alpha) — Contract logic analysis via Gemini 2.0 Flash
 */
export const alphaAgent = {
  name: 'Agent-α',
  model: 'Gemini 2.0 Flash',

  async analyze(req: QueryRequest): Promise<Verdict> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash',
      systemInstruction: SYSTEM_PROMPT,
    });

    const prompt = `Analyze this token contract for security vulnerabilities:

Contract address: ${req.contractAddress}
Chain: ${req.chain}

Focus on:
1. Proxy patterns — can the implementation be upgraded maliciously?
2. Ownership — is the contract renounced? Who controls it?
3. Mint/burn functions — can tokens be minted arbitrarily?
4. External calls — are there unchecked external calls?
5. Honeypot signatures — can buyers sell? Are there transfer restrictions?
6. Access control — are admin functions properly gated?`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    // Strip markdown code fences if present
    const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    try {
      const parsed = JSON.parse(jsonStr);
      return {
        agent: 'Agent-α',
        verdict: parsed.verdict || 'SAFE',
        confidence: Math.min(100, Math.max(0, parsed.confidence || 50)),
        reasoning: parsed.reasoning || 'Analysis completed.',
        stake: '50000', // $0.05 USDC in microusd
      };
    } catch {
      // If parsing fails, return a conservative result
      return {
        agent: 'Agent-α',
        verdict: 'RISKY',
        confidence: 50,
        reasoning: 'Analysis completed but response parsing failed — conservative default applied.',
        stake: '50000',
      };
    }
  },
};
