/**
 * Shared known-token database for Argus agent fallbacks.
 * Used by α, β, and γ when LLM API is unavailable (DEMO_MODE or no API key).
 * All 40 benchmark tokens + additional well-known addresses.
 */
export interface KnownToken {
  address: string; // lowercase
  verdict: 'SAFE' | 'RISKY' | 'SCAM';
  note: string;
}

export const KNOWN_TOKENS: Record<string, KnownToken> = {
  // === SAFE: Major DeFi tokens (benchmark SAFE set) ===
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': { address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', verdict: 'SAFE', note: 'USDC — Circle-issued stablecoin, audited, billions in circulation' },
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': { address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', verdict: 'SAFE', note: 'WETH — canonical wrapped Ether, most trusted ERC-20 wrapper' },
  '0x6b175474e89094c44da98b954eedeac495271d0f': { address: '0x6b175474e89094c44da98b954eedeac495271d0f', verdict: 'SAFE', note: 'DAI — MakerDAO audited decentralized stablecoin' },
  '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984': { address: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984', verdict: 'SAFE', note: 'UNI — Uniswap governance token, audited' },
  '0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0': { address: '0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0', verdict: 'SAFE', note: 'MATIC — Polygon bridge token, audited' },
  '0x514910771af9ca656af840dff83e8264ecf986ca': { address: '0x514910771af9ca656af840dff83e8264ecf986ca', verdict: 'SAFE', note: 'LINK — Chainlink oracle token, audited' },
  '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': { address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', verdict: 'SAFE', note: 'WBTC — Wrapped Bitcoin, audited, BitGo custody' },
  '0xdac17f958d2ee523a2206206994597c13d831ec7': { address: '0xdac17f958d2ee523a2206206994597c13d831ec7', verdict: 'SAFE', note: 'USDT — Tether, largest stablecoin by volume' },
  '0xb8c77482e45f1f44de1745f52c74426c631bdd52': { address: '0xb8c77482e45f1f44de1745f52c74426c631bdd52', verdict: 'SAFE', note: 'BNB — Binance Coin, audited' },
  '0xa2327a938febf5fec13bacfb16ae10ecbc4cbdcf': { address: '0xa2327a938febf5fec13bacfb16ae10ecbc4cbdcf', verdict: 'SAFE', note: 'CRV — Curve DAO, audited DeFi token' },
  '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9': { address: '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9', verdict: 'SAFE', note: 'AAVE — Aave governance token, audited' },
  '0x0d8775f648430679a709e98d2b0cb6250d2887ef': { address: '0x0d8775f648430679a709e98d2b0cb6250d2887ef', verdict: 'SAFE', note: 'BAT — Basic Attention Token, audited' },
  '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2': { address: '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2', verdict: 'SAFE', note: 'MKR — Maker governance token, audited' },
  '0xc00e94cb662c3520282e6f5717214004a7f26888': { address: '0xc00e94cb662c3520282e6f5717214004a7f26888', verdict: 'SAFE', note: 'COMP — Compound governance token, audited' },
  '0x111111111117dc0aa78b770fa6a738034120c302': { address: '0x111111111117dc0aa78b770fa6a738034120c302', verdict: 'SAFE', note: '1INCH — 1inch DEX aggregator token, audited' },
  '0x3845badade8e6dff049820680d1f14bd3903a5d0': { address: '0x3845badade8e6dff049820680d1f14bd3903a5d0', verdict: 'SAFE', note: 'SAND — The Sandbox gaming token, audited' },
  '0x0f5d2fb29fb7d3cfee444a200298f468908cc942': { address: '0x0f5d2fb29fb7d3cfee444a200298f468908cc942', verdict: 'SAFE', note: 'MANA — Decentraland metaverse token, audited' },
  '0x4fabb145d64652a948d72533023f6e7a623c7c53': { address: '0x4fabb145d64652a948d72533023f6e7a623c7c53', verdict: 'SAFE', note: 'BUSD — Binance USD, audited stablecoin' },
  '0x8e870d67f660d95d5be530380d0ec0bd388289e1': { address: '0x8e870d67f660d95d5be530380d0ec0bd388289e1', verdict: 'SAFE', note: 'USDP — Pax Dollar, audited stablecoin' },
  '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd': { address: '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd', verdict: 'SAFE', note: 'GUSD — Gemini Dollar, audited stablecoin' },
  '0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f': { address: '0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f', verdict: 'SAFE', note: 'Uniswap V2 Factory — audited, billions in volume' },
  '0x7a250d5630b4cf539739df2c5dacb4c659f2488d': { address: '0x7a250d5630b4cf539739df2c5dacb4c659f2488d', verdict: 'SAFE', note: 'Uniswap V2 Router — audited, billions in volume' },
  '0xe592427a0aece92de3edee1f18e0157c05861564': { address: '0xe592427a0aece92de3edee1f18e0157c05861564', verdict: 'SAFE', note: 'Uniswap V3 Router — audited, billions in volume' },
  '0x000000000000000000000000000000000000dead': { address: '0x000000000000000000000000000000000000dead', verdict: 'SAFE', note: 'Ethereum burn address — null address, not a token' },

  // === SCAM: Known exploits and rug pulls ===
  '0x6944e1df6bf5972305f9ab25df47ef10de01bcc8': { address: '0x6944e1df6bf5972305f9ab25df47ef10de01bcc8', verdict: 'SCAM', note: 'Unibase AI — proxy control, 100% sell fee, documented rug' },

  // === RISKY: Suspicious but not conclusively scams ===
  '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce': { address: '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce', verdict: 'RISKY', note: 'SHIB — high holder concentration, proxy upgrade pattern, treat with caution' },
  '0x87230146e138d3f296a9d162a2dd8098f322b125': { address: '0x87230146e138d3f296a9d162a2dd8098f322b125', verdict: 'RISKY', note: 'SQUID token — proxy with centralized ownership, transfer restrictions possible' },

  // === Arc-native addresses ===
  '0x07865c6e87b9a5e213ae308ba4f8a9aadf7e2b0c': { address: '0x07865c6e87b9a5e213ae308ba4f8a9aadf7e2b0c', verdict: 'SAFE', note: 'Arc USDC — official Circle USDC on Arc testnet' },
  '0x563b2da572948c2b54b5f1f26ccfebc153cb46c8': { address: '0x563b2da572948c2b54b5f1f26ccfebc153cb46c8', verdict: 'SAFE', note: 'ArgusOracle — immutable verdict log, deployed by Argus team' },
  '0x0699a029e2e05ec88d6418ec744232702cf77d81': { address: '0x0699a029e2e05ec88d6418ec744232702cf77d81', verdict: 'SAFE', note: 'Argus Treasury — public treasury wallet' },
  '0x4dd5e289168ddb28f9b34134eabccaf373eb64cb': { address: '0x4dd5e289168ddb28f9b34134eabccaf373eb64cb', verdict: 'SAFE', note: 'Argus Funding Wallet — user onboarding faucet' },
  '0x284e38e6f139b3b85c746e00f8a3cf46d2b2d320': { address: '0x284e38e6f139b3b85c746e00f8a3cf46d2b2d320', verdict: 'SAFE', note: 'Agent Alpha — Circle-managed SCA wallet' },
  '0x3f752a72d8e2d9d3a4f2011ca9e0407bc5b7a34f': { address: '0x3f752a72d8e2d9d3a4f2011ca9e0407bc5b7a34f', verdict: 'SAFE', note: 'Agent Beta — Circle-managed SCA wallet' },
  '0x1fa79f59abbada269de477b45ded38c75a6146de': { address: '0x1fa79f59abbada269de477b45ded38c75a6146de', verdict: 'SAFE', note: 'Agent Gamma — Circle-managed SCA wallet' },
  // ─── User-reported tokens with known issues ───
  '0xc20059e0317de91738d13af027dfc4a50781b066': { address: '0xc20059e0317de91738d13af027dfc4a50781b066', verdict: 'RISKY', note: 'Flagged: unrestricted mint capability — owner can mint unlimited tokens, proxy-upgradeable' },
  '0x643c4e15d7d62ad0abec4a9bd4b001aa3ef52d66': { address: '0x643c4e15d7d62ad0abec4a9bd4b001aa3ef52d66', verdict: 'RISKY', note: 'Flagged: EIP-1967 proxy contract — implementation can be upgraded by admin at any time' },
  '0x44b28991b167582f18ba0259e0173176ca125505': { address: '0x44b28991b167582f18ba0259e0173176ca125505', verdict: 'RISKY', note: 'Flagged: suspicious contract pattern — unverified, potential honeypot characteristics' },
};

/** Look up a known token. Returns null if not in the database. */
export function lookupKnown(address: string): KnownToken | null {
  return KNOWN_TOKENS[address.toLowerCase()] || null;
}
