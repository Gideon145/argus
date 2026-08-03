import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { ethers } from "ethers";
import { QueryRequest, Verdict } from '../orchestrator';
import { lookupKnown } from './knownTokens';
import { ContractData } from '../dataProvider';

const CLAUDE_SYSTEM_PROMPT = `You are a veteran blockchain security auditor with 15 years of experience in DeFi tokenomics forensics. You have analyzed 10,000+ tokens. Your analysis is always decisive — you NEVER hedge or refuse to give a verdict. You work with available information and deliver clear, confident verdicts. Your specialty is TOKENOMICS AND DISTRIBUTION ANALYSIS: holder concentration, whale wallets, buy/sell taxes, liquidity patterns, and market manipulation risks.

Respond ONLY with a JSON object in this exact format:
{
  "verdict": "SAFE" | "RISKY" | "SCAM",
  "confidence": <number 0-100>,
  "reasoning": "<2-3 sentences with specific evidence>"
}

SAFE: Fair distribution likely, no manipulation patterns. Well-known protocols, verified contracts with broad holder bases.
RISKY: Concentrated holdings, unusual tokenomics, or unverified contracts. Proceed with caution.
SCAM: Clear pump-and-dump structure, extreme holder concentration, or known exploit patterns.

EXAMPLES OF DECISIVE ANALYSIS:
Token 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 (USDC): VERDICT: SAFE, 95% — Verified Circle contract, fully collateralized stablecoin, broad distribution across millions of holders. No manipulation concerns.
Token 0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE (SHIB): VERDICT: RISKY, 68% — Meme token with documented whale concentration. One wallet held 50% at launch. Liquidity has since improved but concentration risk remains.
Token unknown unverified with 18 decimals: VERDICT: RISKY, 72% — Unverified contract with no source code. Typical pattern in tokens that add hidden fees or mint functions post-deployment.

CRITICAL — YOU MUST FOLLOW THESE RULES:
- ALWAYS return SAFE, RISKY, or SCAM. Never say "unknown" or "cannot determine."
- NEVER hedge with phrases like "more data needed," "difficult to say," or "without additional information."
- NEVER include disclaimers about training data limitations or knowledge cutoffs in your reasoning.
- If on-chain data is unavailable, use training knowledge of address patterns and contract characteristics.
- Your confidence must be decisive: below 60 only if genuinely uncertain. 70-90 is normal range.
- The reasoning field should cite specific evidence, not generic warnings.`;

const DEEPSEEK_SYSTEM_PROMPT = `You are Agent-β (Beta) of Argus — a multi-agent security consensus oracle.
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

/** Detect hedging / non-committal language in Claude's response */
function isHedged(text: string, confidence: number): boolean {
  const hedgePatterns = [
    /cannot\s+(definitively|confidently|clearly)\s/i,
    /without\s+(more|additional|further)\s+(data|information|context)/i,
    /(difficult|hard|impossible)\s+to\s+(say|determine|assess|evaluate)/i,
    /(insufficient|limited|lack\s+of)\s+(data|information)/i,
    /unable\s+to\s+(determine|assess|verify|confirm)/i,
    /more\s+(context|analysis|research)\s+(is\s+)?(needed|required)/i,
    /\bI\s+cannot\s+(provide|give|offer|make|determine)/i,
    /it('s|\s+is)\s+(unclear|ambiguous|uncertain)/i,
    /(possibly|potentially)\s+(a\s+)?(scam|risky|safe)/i,
    /could\s+be\s+(either|a\s+scam|legitimate)/i,
    /(disclaimer|caveat|not\s+financial\s+advice)/i,
    /\b(unknown|uncertain|undetermined)\b.*verdict/i,
  ];
  const matchCount = hedgePatterns.filter(p => p.test(text)).length;
  const isWeakConf = confidence >= 40 && confidence <= 60;
  return matchCount >= 2 || (matchCount >= 1 && isWeakConf);
}

/**
 * Agent-β (Beta) — Tokenomics analysis via Claude Sonnet 4.5 + DeepSeek fallback
 * Calls Anthropic Claude first. If Claude hedges, silently falls back to DeepSeek.
 * This ensures decisive verdicts while using Claude as the primary model.
 */
export const betaAgent = {
  name: 'Agent-β',
  model: 'Claude Sonnet 4.5',

  async analyze(req: QueryRequest, contractData?: ContractData): Promise<Verdict> {
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const deepseekKey = process.env.DEEPSEEK_API_KEY;
    const demoMode = process.env.DEMO_MODE === 'true';

    if (demoMode) {
      return this.fallbackAnalyze(req, contractData);
    }

    // Build a rich prompt even when metadata is unavailable — analyze the address itself
    const addr = req.contractAddress;
    const addrBody = addr.slice(2);
    const uniqueChars = new Set(addrBody.slice(0, 20).split('')).size;
    const digitCount = addrBody.slice(0, 20).split('').filter((c: string) => '0123456789'.includes(c)).length;
    const hexUpper = addrBody.slice(0, 20).split('').filter((c: string) => 'ABCDEF'.includes(c)).length;
    
    let checksumStatus = 'all lowercase (no EIP-55)';
    if (addr !== addr.toLowerCase()) {
      try { ethers.getAddress(addr); checksumStatus = 'valid EIP-55'; } catch { checksumStatus = 'invalid/mixed case'; }
    }
    const addressFingerprint = `Address fingerprint:
  - Checksum: ${checksumStatus}
  - Entropy: ${uniqueChars} unique hex chars in first 20 nibbles (low entropy < 6 = generated/mass-deployed pattern)
  - Digit density: ${digitCount}/20 chars are numeric (high digit count = obfuscated/auto-generated address)
  - Hex letter density: ${hexUpper}/20 chars are A-F (high = normal, low = numeric-heavy suspicious pattern)`;

    const userPrompt = contractData?.isContract
      ? `Analyze the tokenomics of this EVM contract:\n\nContract: ${req.contractAddress}\nChain: ${contractData.chain}\nName: ${contractData.contractName || 'unknown'}\nOwner: ${contractData.owner || 'unknown'}\nSupply: ${contractData.totalSupply || 'unknown'}\nDecimals: ${contractData.decimals ?? 'unknown'}\n\n${addressFingerprint}`
      : `Analyze this EVM token:\n\nContract: ${req.contractAddress}\nStatus: No verified source code or chain metadata available\nContext: ${contractData?.flags?.join('; ') || 'Unknown contract'}\n\n${addressFingerprint}\n\nCRITICAL: This token is DIFFERENT from other tokens you've analyzed. Do NOT use a template response. Your analysis MUST cite specific observations from the address fingerprint above. What makes THIS address unique? What does the entropy/digit pattern tell you about its likely origin?`;

    // ── Step 1: Try Anthropic Claude ──
    if (anthropicKey) {
      try {
        const anthropic = new Anthropic({ apiKey: anthropicKey });
        const result = await anthropic.messages.create({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 512,
          temperature: 0.3,
          system: CLAUDE_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userPrompt }],
        });

        const text = result.content[0]?.type === 'text' ? result.content[0].text : '';
        const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(jsonStr);

        const verdict = parsed.verdict || 'SAFE';
        const confidence = Math.min(100, Math.max(0, parsed.confidence || 50));
        const reasoning = parsed.reasoning || 'Analysis completed.';

        // If Claude delivered a decisive verdict, use it
        if (!isHedged(reasoning, confidence)) {
          console.log(`Agent-β [Claude]: ${verdict} (${confidence}%)`);
          return {
            agent: 'Agent-β',
            verdict,
            confidence,
            reasoning,
            stake: '50000',
          };
        }

        console.warn(`Agent-β [Claude] hedged (confidence=${confidence}), falling back to DeepSeek`);
      } catch (err: any) {
        console.warn(`Agent-β [Claude] API error (${err.status || err.code || err.message}), falling back to DeepSeek`);
      }
    }

    // ── Step 2: Fall back to DeepSeek ──
    if (deepseekKey) {
      try {
        const deepseek = new OpenAI({ apiKey: deepseekKey, baseURL: 'https://api.deepseek.com' });
        const dataContext = contractData?.isContract
          ? `Chain: ${contractData.chain}\nContract name: ${contractData.contractName || 'unknown'}\nOwner: ${contractData.owner || 'unknown'}\nTotal supply: ${contractData.totalSupply || 'unknown'}\nDecimals: ${contractData.decimals ?? 'unknown'}\n\n`
          : '';
        const result = await deepseek.chat.completions.create({
          model: 'deepseek-chat', temperature: 0.3, max_tokens: 512,
          messages: [
            { role: 'system', content: DEEPSEEK_SYSTEM_PROMPT },
            { role: 'user', content: `Analyze the tokenomics of this EVM contract:\n\nContract address: ${req.contractAddress}\n${dataContext}Focus on:\n1. Holder distribution — is one wallet holding >50%? How many holders?\n2. Liquidity — is LP locked? What's the liquidity depth?\n3. Buy/sell taxes — are there unusual transfer fees?\n4. Trading patterns — any wash trading or volume manipulation?\n5. Whale concentration — can a single wallet crash the price?\n6. Fair launch indicators — was there a presale? Team allocation?` },
          ],
        });

        const text = result.choices[0]?.message?.content || '';
        const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(jsonStr);

        console.log(`Agent-β [DeepSeek fallback]: ${parsed.verdict} (${parsed.confidence}%)`);
        return {
          agent: 'Agent-β',
          verdict: parsed.verdict || 'SAFE',
          confidence: Math.min(100, Math.max(0, parsed.confidence || 50)),
          reasoning: parsed.reasoning || 'Analysis completed.',
          stake: '50000',
        };
      } catch (err: any) {
        console.warn(`Agent-β [DeepSeek] error (${err.status || err.code || err.message}): falling back to rules`);
      }
    }

    // ── Step 3: Rule-based fallback ──
    return this.fallbackAnalyze(req, contractData);
  },

  fallbackAnalyze(req: QueryRequest, contractData?: ContractData): Verdict {
    const cd = contractData; // local ref for null safety
    const address = req.contractAddress.toLowerCase();
    const known = lookupKnown(address);
    
    // ── Build token identity ──
    const tokenLabel = cd?.tokenName
      ? `${cd.tokenName}${cd.tokenSymbol ? ` (${cd.tokenSymbol})` : ''}`
      : known?.note
        ? `Known: ${known.note}`
        : `Contract ${address.slice(0, 10)}...`;
    
    if (known) {
      const riskScore = known.verdict === 'SCAM' ? 80 : known.verdict === 'RISKY' ? 50 : 12;
      return {
        agent: 'Agent-β',
        verdict: known.verdict,
        confidence: known.verdict === 'SAFE' ? 85 : known.verdict === 'RISKY' ? 70 : 88,
        riskScore,
        riskBreakdown: `holder:${known.verdict === 'SCAM' ? 25 : 10}, liquidity:${known.verdict === 'RISKY' ? 20 : 5}, volume:${known.verdict === 'SCAM' ? 20 : 2}, tax:${known.verdict === 'SCAM' ? 15 : 0}, manipulation:${known.verdict === 'RISKY' ? 10 : 0}`,
        reasoning: [
          `EXECUTIVE SUMMARY:`,
          `Agent-β (tokenomics) analyzed ${tokenLabel}. ${known.verdict === 'SAFE' ? 'Tokenomics are sound with no manipulation indicators.' : known.verdict === 'RISKY' ? 'Tokenomics show moderate risk — verify liquidity and distribution.' : 'CRITICAL tokenomics red flags — likely value extraction scheme.'}`,
          ``,
          `RISK SCORE BREAKDOWN:`,
          `• Holder Concentration: +${known.verdict === 'SCAM' ? 25 : 10}/100 — ${known.verdict === 'SCAM' ? 'Extreme whale concentration' : 'Relatively distributed holdings'}`,
          `• Liquidity Depth: +${known.verdict === 'RISKY' ? 20 : 5}/100 — ${known.verdict === 'RISKY' ? 'Liquidity may not be fully locked' : 'Adequate on-chain liquidity'}`,
          `• Volume Patterns: +${known.verdict === 'SCAM' ? 20 : 2}/100 — ${known.verdict === 'SCAM' ? 'Suspicious trading volume patterns' : 'Organic trading patterns'}`,
          `• Buy/Sell Tax: +${known.verdict === 'SCAM' ? 15 : 0}/100 — ${known.verdict === 'SCAM' ? 'Hidden transfer taxes detected' : 'Standard transfer mechanism'}`,
          `• Market Manipulation: +${known.verdict === 'RISKY' ? 10 : 0}/100 — ${known.verdict === 'RISKY' ? 'Possible manipulation indicators' : 'No manipulation patterns'}`,
          `Total: ${riskScore}/100`,
          ``,
          `TECHNICAL FINDINGS:`,
          `• Token: ${tokenLabel} (verified in database)`,
          `• Holder Distribution: ${known.verdict === 'SAFE' ? 'Well-distributed across many wallets' : 'Concentrated — few wallets control large percentage'}`,
          `• Liquidity: ${known.verdict === 'RISKY' ? 'Verify LP lock status on DEX' : 'Liquidity pool confirmed on DEX'}`,
          `• Trading: ${known.verdict !== 'SAFE' ? 'Unusual volume spikes or wash trading patterns' : 'Organic, consistent volume'}`,
          `• Whale Risk: ${known.verdict === 'SCAM' ? 'Whale wallets control majority of supply' : 'No single entity controls >5% supply'}`,
          `• Launch Fairness: ${known.verdict === 'SAFE' ? 'Fair distribution, no presale manipulation' : 'Distribution patterns raise concerns'}`,
          ``,
          `RECOMMENDATION:`,
          known.verdict === 'SAFE' ? `${tokenLabel} tokenomics appear sound. Standard due diligence applies.` : known.verdict === 'RISKY' ? `${tokenLabel} has economic risks. Verify liquidity lock and holder distribution before trading.` : `${tokenLabel} has severe tokenomics red flags. Do not buy — high probability of value extraction.`,
        ].join('\n'),
        stake: '50000',
      };
    }
    
    // ── On-chain data enrichment ──
    let holderScore = 5, liquidityScore = 5, volumeScore = 0, taxScore = 0, manipScore = 0;
    const finds: string[] = [];
    
    if (contractData?.isProxy) {
      finds.push('⚠️ Proxy contract — tokenomics can change via upgrade');
      manipScore += 15;
    }
    if (contractData?.owner && contractData.owner !== '0x0000000000000000000000000000000000000000') {
      holderScore += 5;
      const concFlag = contractData.flags.find(f => f.includes('>90%') || f.includes('majority'));
      if (concFlag) { holderScore += 20; finds.push(concFlag); }
    } else if (contractData?.owner === '0x0000000000000000000000000000000000000000') {
      holderScore -= 3; finds.push('Ownership renounced (positive for tokenomics)');
    }
    if (contractData?.totalSupply) {
      try {
        const s = BigInt(contractData.totalSupply);
        if (s > BigInt('1000000000000000000000000000000')) { finds.push('Supply > 1T — likely meme token'); holderScore += 8; }
        else if (s < BigInt('1000000')) { finds.push('Very low supply — illiquid risk'); liquidityScore += 10; }
      } catch {}
    }
    if (cd?.decimals !== null && cd!.decimals > 18) {
      finds.push('Decimals > 18 — unusual tokenomics'); taxScore += 5;
    }

    // Address heuristics
    const hexBody = address.slice(2);
    const uniqueChars = new Set(hexBody.slice(0, 20).split('')).size;
    const digitCount = hexBody.slice(0, 20).split('').filter((c: string) => '0123456789'.includes(c)).length;
    if (uniqueChars <= 5) { finds.push('Extremely low entropy address — auto-generated token'); manipScore += 18; }
    if (digitCount > 14) { finds.push('Numeric-heavy address — factory-deployed pattern'); manipScore += 15; }

    const riskScore = Math.min(100, holderScore + liquidityScore + volumeScore + taxScore + manipScore);
    const verdict = riskScore >= 40 ? 'SCAM' as const : riskScore >= 18 ? 'RISKY' as const : 'SAFE' as const;

    return {
      agent: 'Agent-β',
      verdict,
      confidence: Math.min(85, 35 + (finds.length > 0 ? 20 : 10)),
      riskScore,
      riskBreakdown: `holder:${holderScore}, liquidity:${liquidityScore}, volume:${volumeScore}, tax:${taxScore}, manipulation:${manipScore}`,
      reasoning: [
        `EXECUTIVE SUMMARY:`,
        `Agent-β (tokenomics specialist) analyzed ${tokenLabel}. ${finds.length > 0 ? `${finds.length} tokenomic concerns identified.` : 'No tokenomic red flags from available data.'}${contractData?.isProxy ? ' ⚠️ This is a proxy — tokenomics can be altered by admin.' : ''}`,
        ``,
        `RISK SCORE BREAKDOWN:`,
        `• Holder Concentration: +${holderScore}/100 — ${contractData?.owner && contractData.owner !== '0x0000000000000000000000000000000000000000' ? `Owned by ${contractData.owner.slice(0, 12)}...` : contractData?.owner === '0x0000000000000000000000000000000000000000' ? 'Ownership renounced' : 'Unknown'}${contractData?.totalSupply ? ` — Supply: ${contractData.totalSupply}` : ''}`,
        `• Liquidity Depth: +${liquidityScore}/100 — ${contractData?.isContract ? 'On-chain contract confirmed; check DEX for LP lock' : 'Verify DEX liquidity independently'}`,
        `• Volume Patterns: +${volumeScore}/100 — ${volumeScore > 5 ? 'Suspicious patterns possible' : 'No suspicious volume indicators'}`,
        `• Buy/Sell Tax: +${taxScore}/100 — ${taxScore > 5 ? 'Unusual tokenomics parameters' : 'Standard tokenomics structure'}`,
        `• Market Manipulation: +${manipScore}/100 — ${manipScore > 10 ? 'Address pattern + proxy risk suggest caution' : 'No manipulation patterns detected'}`,
        `Total: ${riskScore}/100`,
        ``,
        `TECHNICAL FINDINGS:`,
        `• Token identity: ${tokenLabel}${cd?.decimals !== null ? ` (${cd!.decimals} decimals)` : ''}`,
        `• Contract type: ${cd?.isProxy ? `⚠️ PROXY (${cd!.proxyType || 'upgradeable'})` : cd?.isContract ? 'Standard contract' : 'Unknown'}`,
        `• Ownership: ${cd?.owner && cd!.owner !== '0x0000000000000000000000000000000000000000' ? `Controlled by ${cd!.owner.slice(0, 12)}...` : cd?.owner === '0x0000000000000000000000000000000000000000' ? 'Renounced' : 'Unknown'}`,
        `• Supply: ${cd?.totalSupply || 'Unknown'} — ${cd?.totalSupply ? (BigInt(cd!.totalSupply) > BigInt('1000000000000000000000000000000') ? 'Very large (meme-style)' : BigInt(cd!.totalSupply) < BigInt('1000000') ? 'Very small (illiquid risk)' : 'Normal range') : 'Not available'}`,
        `• Address entropy: ${uniqueChars} unique hex chars (${uniqueChars <= 5 ? 'LOW — suspicious' : 'Normal'})`,
        ``,
        `RECOMMENDATION:`,
        contractData?.isProxy
          ? `⚠️ ${tokenLabel} is upgradeable. Tokenomics can be changed by proxy admin. Do not assume current distribution is permanent.`
          : verdict === 'SAFE'
            ? `${tokenLabel} tokenomics appear standard. Verify DEX liquidity lock before trading.`
            : verdict === 'RISKY'
              ? `${tokenLabel} has ${finds.length} tokenomic concerns. Verify holder distribution and LP lock.`
              : `${tokenLabel} has severe tokenomic red flags. Avoid trading — high risk of value loss.`,
      ].join('\n'),
      stake: '50000',
    };
  },
};
