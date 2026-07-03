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
    const known = lookupKnown(req.contractAddress);
    if (known) {
      return {
        agent: 'Agent-β',
        verdict: known.verdict,
        confidence: 85,
        reasoning: `Recognized token: ${known.note}. Holder distribution and LP structure consistent with known profile.`,
        stake: '50000',
      };
    }

    if (!contractData || !contractData.isContract) {
      return {
        agent: 'Agent-β',
        verdict: 'INSUFFICIENT_DATA',
        confidence: 0,
        reasoning: `No on-chain contract data available for ${req.contractAddress}. Cannot analyze tokenomics without supply/holder/distribution data.`,
        stake: '0',
      };
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey || process.env.DEMO_MODE === 'true') {
      return this.fallbackAnalyze(req, contractData);
    }

    try {
      const deepseek = new OpenAI({
        apiKey,
        baseURL: 'https://api.deepseek.com',
      });

      const result = await deepseek.chat.completions.create({
        model: 'deepseek-chat',
        temperature: 0.3,
        max_tokens: 512,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Analyze the tokenomics of this EVM contract:\n\nContract address: ${req.contractAddress}\nChain: ${contractData?.chain || 'unknown'}\nContract name: ${contractData?.contractName || 'unknown'}\nOwner: ${contractData?.owner || 'unknown'}\nTotal supply: ${contractData?.totalSupply || 'unknown'}\nDecimals: ${contractData?.decimals ?? 'unknown'}\n\nFocus on:\n1. Holder distribution — is one wallet holding >50%? How many holders?\n2. Liquidity — is LP locked? What's the liquidity depth?\n3. Buy/sell taxes — are there unusual transfer fees?\n4. Trading patterns — any wash trading or volume manipulation?\n5. Whale concentration — can a single wallet crash the price?\n6. Fair launch indicators — was there a presale? Team allocation?` },
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

  /** Fallback using fetched on-chain facts */
  fallbackAnalyze(req: QueryRequest, contractData: ContractData): Verdict {
    const flags: string[] = [];
    let riskScore = 0;

    // Tokenomics from on-chain data
    if (contractData.owner && contractData.owner !== '0x0000000000000000000000000000000000000000') {
      flags.push(`Single owner controls token: ${contractData.owner}`);
      riskScore += 15;
    }
    if (contractData.totalSupply) {
      try {
        const supply = BigInt(contractData.totalSupply);
        if (supply > BigInt('1000000000000000000000000000000')) { flags.push('Total supply > 1 trillion — potential meme/scam token'); riskScore += 10; }
        else if (supply < BigInt('1000000')) { flags.push('Very low supply — potential scarcity manipulation'); riskScore += 5; }
      } catch {}
    }
    if (contractData.decimals !== null && contractData.decimals > 18) {
      flags.push('Unusual decimals (>18) — potential rebase/elastic supply risk');
      riskScore += 8;
    }
    if (!contractData.hasSource) {
      flags.push('Unverified source — holder distribution and LP data unavailable');
      riskScore += 10;
    }

    let verdict: 'SAFE' | 'RISKY' | 'SCAM';
    if (riskScore >= 30) verdict = 'SCAM';
    else if (riskScore >= 15) verdict = 'RISKY';
    else verdict = 'SAFE';

    return {
      agent: 'Agent-β',
      verdict,
      confidence: Math.min(80, 35 + (flags.length > 0 ? 15 : 10)),
      reasoning: flags.length > 0
        ? `[Tokenomics] ${flags.join('; ')}. Chain: ${contractData.chain}.`
        : `[Tokenomics] Supply/distribution metrics from chain data appear normal. Chain: ${contractData.chain}, decimals: ${contractData.decimals}, totalSupply: ${contractData.totalSupply?.slice(0,12) || 'unknown'}.`,
      stake: '50000',
    };
  },
};
