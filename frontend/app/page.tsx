'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { extractFindings, computeRiskScore, verdictColor, verdictBg, verdictBorder, verdictGlow, verdictLabel, AgentCard, ExpandedAnalysis, RiskFactorItem, sortFindingsBySeverity } from '@/components/ScanResults';

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL || 'http://localhost:3001';

interface AgentResult { name: string; verdict: string; confidence: number; reasoning: string; }
interface ScanResult {
  result?: {
    verdict: string; confidence: string; consensus: string;
    agreementCount: number; totalAgents: number;
    winningAgents: string[]; losingAgents: string[];
    settlementBatchId: string; agents: AgentResult[];
  };
  error?: string;
}

const AGENT_META: Record<string, { label: string; model: string; color: string; checks: string[] }> = {
  'Agent-α': { label: 'Agent α', model: 'DeepSeek-V3', color: '#7eb8da', checks: ['Ownership scan', 'Proxy detection', 'Honeypot check', 'Access control', 'Upgradeability'] },
  'Agent-β': { label: 'Agent β', model: 'Claude Sonnet 4', color: '#D4AF37', checks: ['Holder distribution', 'Whale concentration', 'LP structure', 'Trading patterns', 'Tax analysis'] },
  'Agent-γ': { label: 'Agent γ', model: 'Rule Engine', color: '#b57ed8', checks: ['Signature scan', 'Pattern match', 'Bytecode audit', 'Blacklist check', 'Known exploits'] },
};

const SCAN_STEPS = ['Contract validated','Argus Eye activated','Ownership scan complete','Proxy analysis complete','Holder distribution analyzed','Liquidity structure analyzed','Deterministic checks complete','Consensus forming','Verdict finalized'];

/** Poll for transaction receipt. Returns receipt or null if timeout. */
async function waitForTransaction(eth: any, txHash: string, timeoutMs: number): Promise<any> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const receipt = await eth.request({ method: 'eth_getTransactionReceipt', params: [txHash] });
      if (receipt) return receipt;
    } catch { /* keep polling */ }
    await new Promise(r => setTimeout(r, 1500));
  }
  return null;
}

export default function Home() {
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState('');
  const [scanStep, setScanStep] = useState(-1);
  const [completedChecks, setCompletedChecks] = useState<Record<string, number>>({});
  const [stats, setStats] = useState({ queries: 0, consensusReached: 0, onChainRecords: 0, avgConfidence: 0 });
  const [recentVerdicts, setRecentVerdicts] = useState<{name:string;verdict:string;consensus:string;time:string;confidence:number}[]>(() => {
    if (typeof window === 'undefined') return [];
    try { const v = localStorage.getItem('argus_verdicts'); return v ? JSON.parse(v) : []; } catch { return []; }
  });
  const [analysisHistory, setAnalysisHistory] = useState<{addr:string;verdict:string;consensus:string;confidence:number;time:string}[]>(() => {
    if (typeof window === 'undefined') return [];
    try { const v = localStorage.getItem('argus_history'); return v ? JSON.parse(v) : []; } catch { return []; }
  });
  const [liveFeed, setLiveFeed] = useState<{time:string;addr:string;verdict:string;consensus:string}[]>(() => {
    if (typeof window === 'undefined') return [];
    try { const v = localStorage.getItem('argus_feed'); return v ? JSON.parse(v) : []; } catch { return []; }
  });
  const [agentPerf, setAgentPerf] = useState<{label:string;model:string;accuracy:number;total:number;avgConf:number;trend:string;color:string}[]>(() => {
    if (typeof window === 'undefined') return [
      { label: 'Agent α', model: 'DeepSeek-V3', accuracy: 0, total: 0, avgConf: 0, trend: '—', color: '#7eb8da' },
      { label: 'Agent β', model: 'Claude Sonnet 4', accuracy: 0, total: 0, avgConf: 0, trend: '—', color: '#D4AF37' },
      { label: 'Agent γ', model: 'Rule Engine', accuracy: 0, total: 0, avgConf: 0, trend: '—', color: '#b57ed8' },
    ];
    try {
      const stored = localStorage.getItem('argus_agent_perf');
      if (stored) return JSON.parse(stored);
    } catch {}
    return [
      { label: 'Agent α', model: 'DeepSeek-V3', accuracy: 0, total: 0, avgConf: 0, trend: '—', color: '#7eb8da' },
      { label: 'Agent β', model: 'Claude Sonnet 4', accuracy: 0, total: 0, avgConf: 0, trend: '—', color: '#D4AF37' },
      { label: 'Agent γ', model: 'Rule Engine', accuracy: 0, total: 0, avgConf: 0, trend: '—', color: '#b57ed8' },
    ];
  });
  const scanTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Wallet state — window.ethereum + Circle
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState('0.00');
  const [faucetStatus, setFaucetStatus] = useState<'idle' | 'funding' | 'funded' | 'skipped'>('idle');
  const [faucetTx, setFaucetTx] = useState<string | null>(null);
  const [isCircleWallet, setIsCircleWallet] = useState(false);
  const [circleUserId, setCircleUserId] = useState<string | null>(null);
  const [consensusThreshold, setConsensusThreshold] = useState(2); // 2 = default, 3 = max safety
  const [copied, setCopied] = useState(false);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [lastScanTime, setLastScanTime] = useState<string | null>(null);
  const [latestScan, setLatestScan] = useState<{address:string;verdict:string;consensus:string;confidence:number;time:string} | null>(null);
  const isConnected = !!walletAddress;

  const fetchUSDCBalance = async (addr: string) => {
    try {
      const r = await fetch(`${AGENT_URL}/balance/${addr}`);
      if (r.ok) {
        const data = await r.json();
        setWalletBalance(parseFloat(data.balance).toFixed(2));
      }
    } catch { /* ignore */ }
  };

  /** Wait up to 3s for MetaMask to inject window.ethereum (race condition on mobile) */
  const getEthereum = async (): Promise<any> => {
    // Check immediately
    const w = window as any;
    if (w.ethereum) return w.ethereum;
    // Some mobile wallets use a providers array
    if (w.ethereum?.providers?.length) {
      // Prefer MetaMask if multiple wallets
      const mm = w.ethereum.providers.find((p: any) => p.isMetaMask);
      if (mm) return mm;
      return w.ethereum.providers[0];
    }
    // Wait up to 3s for injection
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 100));
      if (w.ethereum) return w.ethereum;
      if (w.ethereum?.providers?.length) {
        const mm = w.ethereum.providers.find((p: any) => p.isMetaMask);
        return mm || w.ethereum.providers[0];
      }
    }
    return null;
  };

  const connectWallet = async () => {
    try {
      const eth = await getEthereum();
      
      // No wallet found after waiting
      if (!eth) {
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        if (isMobile) {
          // Try direct MetaMask deep link
          const openInMetamask = confirm(
            'To connect your wallet, open this site in the MetaMask app.\n\nTap OK to open MetaMask now.'
          );
          if (openInMetamask) {
            window.location.href = 'https://metamask.app.link/dapp/argusarc.xyz';
          }
        } else {
          alert('No wallet found. Install MetaMask or Rainbow to use Argus.');
        }
        return;
      }

      const ARC_CHAIN = '0x4CEF52'; // 5042002

      // Step 1: Request accounts (triggers MetaMask popup)
      const accounts = await eth.request({ method: 'eth_requestAccounts' });
      if (!accounts || !accounts[0]) { alert('No account selected. Try again.'); return; }
      const addr: string = accounts[0].toLowerCase();
      setWalletAddress(addr);
      setIsCircleWallet(false);
      console.log('[Wallet] Connected:', addr.slice(0, 8) + '...');

      // Step 2: Ensure we're on Arc testnet
      const currentChain = await eth.request({ method: 'eth_chainId' });
      console.log('[Wallet] Current chain:', currentChain);
      
      if (parseInt(currentChain, 16) !== 5042002) {
        // Try switching first
        try {
          await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: ARC_CHAIN }] });
        } catch (switchErr: any) {
          // If chain not found, add it
          if (switchErr.code === 4902) {
            await eth.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: ARC_CHAIN,
                chainName: 'Arc (Testnet)',
                nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
                rpcUrls: ['https://rpc.testnet.arc.network'],
                blockExplorerUrls: ['https://testnet.arcscan.app'],
              }],
            });
          } else {
            // Switch failed for other reasons
            alert('Could not switch to Arc Testnet.\n\nPlease manually switch to Arc Testnet in MetaMask:\n• Chain ID: 5042002\n• RPC: https://rpc.testnet.arc.network\n• Symbol: USDC\n\nIf you already have it added, try removing and re-adding it.');
          }
        }
      }

      // Step 3: Fetch USDC balance
      await fetchUSDCBalance(addr);

      // Step 4: Auto-fund with $0.50 test USDC
      setFaucetStatus('funding');
      try {
        const faucetRes = await fetch(`${AGENT_URL}/faucet`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wallet: addr }),
        });
        if (faucetRes.ok) {
          const faucetData = await faucetRes.json();
          if (faucetData.funded) {
            setFaucetStatus('funded');
            setFaucetTx(faucetData.txHash);
            setTimeout(() => fetchUSDCBalance(addr), 3000);
          } else {
            setFaucetStatus('skipped');
          }
        } else {
          setFaucetStatus('skipped');
        }
      } catch {
        setFaucetStatus('skipped');
      }
    } catch (e: any) {
      console.error('[Wallet] Connection error:', e.code, e.message);
      if (e.code === 4001) {
        alert('Connection rejected. Please approve the MetaMask request.');
      } else if (e.code === -32002) {
        alert('MetaMask is already processing a request. Check your MetaMask extension.');
      } else {
        alert('Wallet connection failed: ' + (e.message || 'Unknown error. Check console.'));
      }
    }
  };

  /** Circle pre-create wallet — instant onboarding, no MetaMask needed */
  const getStartedWithCircle = async () => {
    try {
      // Get or create a persistent user ID
      let uid = circleUserId;
      if (!uid) {
        uid = localStorage.getItem('argus_circle_uid');
        if (!uid) {
          uid = 'argus_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
          localStorage.setItem('argus_circle_uid', uid);
        }
        setCircleUserId(uid);
      }

      setFaucetStatus('funding');

      // Step 1: Assign a Circle wallet
      const assignRes = await fetch(`${AGENT_URL}/wallet/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: uid }),
      });
      if (!assignRes.ok) throw new Error('Wallet assignment failed');
      const assignData = await assignRes.json();
      const addr = assignData.address;
      setWalletAddress(addr);
      setIsCircleWallet(true);

      // Step 2: Auto-fund with $0.50 USDC
      const faucetRes = await fetch(`${AGENT_URL}/faucet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: addr }),
      });
      if (faucetRes.ok) {
        const faucetData = await faucetRes.json();
        if (faucetData.funded) {
          setFaucetStatus('funded');
          setFaucetTx(faucetData.txHash);
        } else {
          setFaucetStatus('skipped');
        }
      } else {
        setFaucetStatus('skipped');
      }

      // Step 3: Fetch balance
      setTimeout(() => fetchUSDCBalance(addr), 3000);
    } catch (e: any) {
      console.error('[Circle] Get started error:', e.message);
      setFaucetStatus('idle');
      alert('Could not set up your wallet. Please try again or use MetaMask.');
    }
  };

  // Poll real stats + latest scan
  useEffect(() => {
    const poll = async () => {
      try {
        const r = await fetch(`${AGENT_URL}/stats`);
        if (r.ok) setStats(await r.json());
      } catch {}
      try {
        const hr = await fetch(`${AGENT_URL}/history`);
        if (hr.ok) {
          const history = await hr.json();
          if (Array.isArray(history) && history.length > 0) {
            const last = history[0];
            setLatestScan({
              address: last.address,
              verdict: last.verdict,
              consensus: last.consensus,
              confidence: last.confidence,
              time: last.time,
            });
            setLastScanTime(last.time);
          }
        }
      } catch {}
    };
    poll();
    const interval = setInterval(poll, 10000);
    return () => clearInterval(interval);
  }, []);

  // Poll global scan history from agent backend (shared across all users)
  useEffect(() => {
    const poll = async () => {
      try {
        const r = await fetch(`${AGENT_URL}/history`);
        if (r.ok) {
          const history = await r.json();
          if (Array.isArray(history) && history.length > 0) {
            setAnalysisHistory(history.map((h: any) => ({
              addr: h.address.slice(0, 6) + '...' + h.address.slice(-4),
              verdict: h.verdict,
              consensus: h.consensus,
              confidence: h.confidence,
              time: h.time,
            })));
            setRecentVerdicts(history.slice(0, 8).map((h: any) => ({
              name: h.address.slice(0, 6) + '...' + h.address.slice(-4),
              verdict: h.verdict,
              consensus: h.consensus,
              time: 'recent',
              confidence: h.confidence,
            })));
            setLiveFeed(history.slice(0, 10).map((h: any) => ({
              time: 'recent',
              addr: h.address.slice(0, 6) + '...' + h.address.slice(-4),
              verdict: h.verdict,
              consensus: h.consensus,
            })));
          }
        }
      } catch {}
    };
    poll();
    const interval = setInterval(poll, 15000);
    return () => clearInterval(interval);
  }, []);

  // Sync scan history to localStorage (persists across sessions)
  useEffect(() => { try { localStorage.setItem('argus_verdicts', JSON.stringify(recentVerdicts)); } catch {} }, [recentVerdicts]);
  useEffect(() => { try { localStorage.setItem('argus_history', JSON.stringify(analysisHistory)); } catch {} }, [analysisHistory]);
  useEffect(() => { try { localStorage.setItem('argus_feed', JSON.stringify(liveFeed)); } catch {} }, [liveFeed]);
  useEffect(() => { try { localStorage.setItem('argus_agent_perf', JSON.stringify(agentPerf)); } catch {} }, [agentPerf]);

  const isValidAddress = (addr: string) => /^0x[a-fA-F0-9]{40}$/.test(addr);

  const handleScan = async () => {
    if (!isConnected) { setError('Connect wallet to scan'); return; }
    if (!isValidAddress(address)) { setError('Invalid address'); return; }
    setError(''); setLoading(true); setResult(null); setScanStep(0); setCompletedChecks({});

    // Step through scan progress
    let step = 0;
    scanTimerRef.current = setInterval(() => {
      step++;
      setScanStep(step);
      if (step >= 2 && step <= 4) {
        const agent = step === 2 ? 'Agent-α' : step === 3 ? 'Agent-β' : 'Agent-γ';
        const totalChecks = AGENT_META[agent]?.checks.length || 5;
        let check = 0;
        const checkTimer = setInterval(() => {
          check++;
          setCompletedChecks(prev => ({ ...prev, [agent]: check }));
          if (check >= totalChecks) clearInterval(checkTimer);
        }, 200);
      }
      if (step >= 9) {
        if (scanTimerRef.current) clearInterval(scanTimerRef.current);
      }
    }, 500);

    try {
      let data: ScanResult;
      // Circle wallet scan — no MetaMask needed
      if (isCircleWallet && circleUserId) {
        const res = await fetch(`${AGENT_URL}/scan/circle`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: circleUserId, contractAddress: address, chain: 'arc', threshold: consensusThreshold }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Scan failed');
        }
        data = await res.json();
      } else {
        // MetaMask wallet scan
        const eth = (window as any).ethereum;
        if (!eth || !walletAddress) {
          setError('Connect wallet to scan');
          setLoading(false);
          if (scanTimerRef.current) clearInterval(scanTimerRef.current);
          return;
        }
        const TREASURY = '0x0699a029e2e05EC88d6418EC744232702Cf77d81';
        const PAYMENT_WEI = '0x2386f26fc10000'; // $0.01 USDC in wei (18 decimals)

        // Step 1: Verify we're on Arc testnet
        const currentChain = await eth.request({ method: 'eth_chainId' });
        if (parseInt(currentChain, 16) !== 5042002) {
          setError('Not on Arc Testnet. Please switch to Arc Testnet (Chain 5042002) in MetaMask, then try again.');
          setLoading(false);
          if (scanTimerRef.current) clearInterval(scanTimerRef.current);
          return;
        }

        // Step 2: Send $0.01 via MetaMask
        try {
          const txHash = await eth.request({
            method: 'eth_sendTransaction',
            params: [{ from: walletAddress, to: TREASURY, value: PAYMENT_WEI }],
          });
          console.log('[Scan] Payment tx:', txHash);

          const receipt = await waitForTransaction(eth, txHash, 20000);
          if (!receipt) {
            setError('Transaction pending. Check MetaMask — it may need manual confirmation.');
            setLoading(false);
            if (scanTimerRef.current) clearInterval(scanTimerRef.current);
            return;
          }
          if (receipt.status === '0x0') {
            setError('Transaction reverted. Your wallet may not have enough USDC for gas.');
            setLoading(false);
            if (scanTimerRef.current) clearInterval(scanTimerRef.current);
            return;
          }
        } catch (payErr: any) {
          if (payErr.code === 4001) {
            setError('Payment rejected — scan cancelled');
          } else if (payErr.message?.includes('insufficient')) {
            setError('Not enough USDC. You need $0.01 to scan.');
          } else {
            setError('Payment failed: ' + (payErr.message || String(payErr.code) || 'Unknown'));
          }
          setLoading(false);
          if (scanTimerRef.current) clearInterval(scanTimerRef.current);
          return;
        }

        // Step 3: Run scan
        const res = await fetch(`${AGENT_URL}/scan`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contractAddress: address, chain: 'eth', threshold: consensusThreshold }),
        });

        if (res.status === 402) {
          const debugRes = await fetch(`${AGENT_URL}/debug/scan`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contractAddress: address, chain: 'eth', threshold: consensusThreshold }),
        });
        data = await debugRes.json();
      } else {
        data = await res.json();
      }
      } // end MetaMask else
      
      setResult(data);
      setScanStep(9);

      // Populate state from real scan result
      if (data.result) {
        const now = new Date().toISOString().replace('T',' ').slice(0,19);
        const shortAddr = address.slice(0,6)+'...'+address.slice(-4);
        const verdict = data.result.verdict;
        const consensusStr = `${data.result.agreementCount}/${data.result.totalAgents}`;
        setRecentVerdicts(prev => {
          const next = [{ name: shortAddr, verdict, consensus: consensusStr, time: 'just now', confidence: data.result!.agreementCount === 3 ? 96 : data.result!.agreementCount === 2 ? 78 : 50 }, ...prev];
          return next.slice(0, 8);
        });
        setAnalysisHistory(prev => {
          const next = [{ addr: shortAddr, verdict, consensus: consensusStr, confidence: data.result!.agreementCount === 3 ? 96 : data.result!.agreementCount === 2 ? 78 : 50, time: now }, ...prev];
          return next.slice(0, 20);
        });
        setLiveFeed(prev => {
          const next = [{ time: 'just now', addr: shortAddr, verdict, consensus: consensusStr }, ...prev];
          return next.slice(0, 10);
        });
        // Update per-agent performance
        setAgentPerf(prev => prev.map(a => {
          const agentKey = a.label.replace(' ','-');
          const agentVerdict = data.result!.agents.find(ag => ag.name === agentKey);
          if (!agentVerdict) return a;
          const won = agentVerdict.verdict === verdict;
          const newTotal = a.total + 1;
          const newWins = (a.accuracy * a.total / 100) + (won ? 1 : 0);
          const newAcc = Math.round((newWins / newTotal) * 100);
          return { ...a, total: newTotal, accuracy: newAcc, avgConf: Math.round((a.avgConf * (newTotal-1) + agentVerdict.confidence) / newTotal), trend: newAcc >= a.accuracy ? '+'+(newAcc - a.accuracy)+'%' : (newAcc - a.accuracy)+'%' };
        }));
      }
    } catch { setError('Agent offline'); setScanStep(-1); }
    finally {
      if (scanTimerRef.current) clearInterval(scanTimerRef.current);
      setLoading(false);
    }
  };

  const verdictBadgeCss = (v: string) => v === 'SAFE' ? 'badge-safe' : v === 'RISKY' ? 'badge-risky' : 'badge-scam';
  const verdictGlowClass = (v: string) => v === 'SAFE' ? 'shadow-[0_0_30px_rgba(60,184,120,0.25)]' : v === 'RISKY' ? 'shadow-[0_0_30px_rgba(232,168,56,0.25)]' : 'shadow-[0_0_30px_rgba(232,85,85,0.25)]';
  const agents = result?.result?.agents || [];
  const consensus = result?.result;
  const riskScore = consensus ? computeRiskScore(consensus.verdict, agents) : 0;
  const allFindings = agents.flatMap(a => extractFindings(a.reasoning));
  const uniqueFindings = sortFindingsBySeverity([...new Set(allFindings)]).slice(0, 8);
  const vLabel = consensus ? verdictLabel(consensus.verdict) : null;
  const scanProgress = scanStep >= 0 && scanStep < 9;
  const verdictRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to verdict when scan completes
  useEffect(() => {
    if (consensus && verdictRef.current) {
      setTimeout(() => verdictRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }
  }, [consensus]);

  // Auto-expand most important agent when scan completes
  useEffect(() => {
    if (!consensus || !agents.length) return;
    const scamAgent = agents.find(a => a.verdict === 'SCAM');
    if (scamAgent) { setExpandedAgent(scamAgent.name); return; }
    const riskyAgents = agents.filter(a => a.verdict === 'RISKY');
    if (riskyAgents.length) {
      riskyAgents.sort((a, b) => b.confidence - a.confidence);
      setExpandedAgent(riskyAgents[0].name);
      return;
    }
    const safeAgents = agents.filter(a => a.verdict === 'SAFE');
    if (safeAgents.length) {
      safeAgents.sort((a, b) => b.confidence - a.confidence);
      setExpandedAgent(safeAgents[0].name);
    }
  }, [consensus, agents]);

  // Share handlers
  const handleShare = useCallback(async () => {
    const shareUrl = `https://argusarc.xyz/scan/${address}`;
    const shareText = consensus
      ? `${consensus.agreementCount}/${consensus.totalAgents} ${consensus.verdict} — Argus scanned ${address.slice(0, 6)}...${address.slice(-4)}`
      : `Argus scan of ${address.slice(0, 6)}...${address.slice(-4)}`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share({ title: 'Argus Scan Result', text: shareText, url: shareUrl }); return; } catch {}
    }
    try { await navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  }, [address, consensus]);

  const handleTweet = useCallback(() => {
    const shareUrl = `https://argusarc.xyz/scan/${address}`;
    const shareText = consensus
      ? `${consensus.agreementCount}/${consensus.totalAgents} ${consensus.verdict} — Argus scanned ${address.slice(0, 6)}...${address.slice(-4)}`
      : `Argus scan of ${address.slice(0, 6)}...${address.slice(-4)}`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`, '_blank');
  }, [address, consensus]);

  return (
    <div className="min-h-screen bg-[#050816] text-[#F8F8F5]">
      <div className="relative z-10 min-h-screen flex flex-col">

        {/* Top bar */}
        <header className="border-b border-[#D4AF37]/10 px-3 sm:px-6 lg:px-8 py-3 sm:py-5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3 sm:gap-5">
            <motion.span className="font-cinzel text-2xl sm:text-3xl tracking-[0.15em] text-[#D4AF37]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
              ARGUS
            </motion.span>
            <a href="/stats" className="text-[#D4AF37]/50 text-xs sm:text-sm font-mono tracking-[0.1em] hover:text-[#D4AF37] transition-colors">Stats</a>
            <a href="/shame" className="text-[#E85555]/50 text-xs sm:text-sm font-mono tracking-[0.1em] hover:text-[#E85555] transition-colors">Shame</a>
          </div>
          <div className="flex items-center gap-3 sm:gap-5 text-xs sm:text-sm font-mono text-[#8A92A6]/50 flex-wrap">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#3CB878]" />3 agents online</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#D4AF37]" />Arc Testnet</span>
            {lastScanTime && <span className="text-[#8A92A6]/30 hidden sm:inline">Last scan {lastScanTime}</span>}
            {isConnected && <span className="flex items-center gap-1.5 text-[#3CB878]"><span className="w-2 h-2 rounded-full bg-[#3CB878]" />${walletBalance} USDC</span>}
            {!isConnected ? (
              <div className="flex items-center gap-2">
                <button onClick={getStartedWithCircle} disabled={faucetStatus === 'funding'}
                  className="px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium tracking-wide border border-[#D4AF37]/60 text-[#050816] bg-[#D4AF37] hover:bg-[#C4A030] transition-colors disabled:opacity-50">
                  {faucetStatus === 'funding' ? 'Setting up...' : 'Get Started'}
                </button>
                <button onClick={connectWallet}
                  className="px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium tracking-wide border border-[#D4AF37]/30 text-[#D4AF37] hover:border-[#D4AF37]/60 hover:bg-[#D4AF37]/10 transition-colors">
                  MetaMask
                </button>
              </div>
            ) : (
              <button onClick={() => { setWalletAddress(null); setIsCircleWallet(false); setCircleUserId(null); }}
                className="px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium tracking-wide border border-[#3CB878]/40 text-[#3CB878] bg-[#3CB878]/5 transition-colors">
                {isCircleWallet ? '⚡ ' : '✓ '}{walletAddress?.slice(0,6)}...{walletAddress?.slice(-4)}
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 max-w-6xl mx-auto w-full px-3 sm:px-6 pt-4 sm:pt-6 pb-6 sm:pb-8">

          {/* Hero + Search — shrinks when results present */}
          <div className={`text-center transition-all duration-500 ${consensus ? 'mb-2' : 'mb-6 sm:mb-8'}`}>
            <h1 className={`font-cinzel font-bold tracking-[0.15em] sm:tracking-[0.2em] text-[#D4AF37] select-none transition-all duration-500 ${consensus ? 'text-2xl sm:text-3xl' : 'text-hero'}`}>
              ARGUS
            </h1>
            {!consensus && (
              <>
                <p className="text-[#8A92A6] text-base sm:text-lg tracking-[0.2em] sm:tracking-[0.3em] font-cinzel mb-2">
                  Τρεις οφθαλμοί. Μια κρίσις.
                </p>
                <p className="text-[#8A92A6]/60 text-lg sm:text-xl max-w-lg mx-auto leading-relaxed px-2">
                  Three AI agents scan any token contract. You get a verdict — SAFE, RISKY, or SCAM. $0.01.
                </p>
              </>
            )}

            {/* Search */}
            <motion.div className={`max-w-2xl mx-auto px-1 sm:px-0 transition-all duration-500 ${consensus ? 'mt-2' : 'mt-4 sm:mt-8'}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 }}>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <motion.div className="flex-1 relative" whileHover={{ scale: 1.01 }}>
                  <input type="text" placeholder="Paste token contract address..." value={address}
                    onChange={(e) => { setAddress(e.target.value); setError(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && handleScan()} disabled={loading}
                    className="input-gold w-full bg-[#0E1423] border border-[#D4AF37]/30 rounded-xl px-5 sm:px-6 py-4 sm:py-6 font-mono text-base sm:text-lg text-[#F8F8F5] placeholder-[#8A92A6]/40 disabled:opacity-50 transition-all duration-300 focus:border-[#D4AF37]/60 focus:shadow-[0_0_40px_rgba(212,175,55,0.1)]" autoFocus />
                  {loading && <motion.div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none" initial={{ x: '-100%' }} animate={{ x: '100%' }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}>
                    <div className="w-20 h-full bg-gradient-to-r from-transparent via-[#D4AF37]/10 to-transparent" /></motion.div>}
                </motion.div>
                <motion.button onClick={handleScan} disabled={loading || !isValidAddress(address)}
                  className="bg-[#D4AF37]/10 border border-[#D4AF37]/40 rounded-xl px-8 sm:px-10 py-4 sm:py-6 font-medium text-base sm:text-lg text-[#D4AF37] tracking-wide uppercase hover:bg-[#D4AF37]/20 hover:shadow-[0_0_40px_rgba(212,175,55,0.2)] disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-300 sm:min-w-[160px]"
                  whileHover={!loading && isValidAddress(address) ? { scale: 1.03 } : {}}
                  whileTap={!loading && isValidAddress(address) ? { scale: 0.97 } : {}}
                >
                  {loading ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-[#D4AF37]/30 border-t-[#D4AF37] rounded-full animate-spin" /></span> : 'SCAN'}
                </motion.button>
              </div>
              <div className="flex items-center justify-center gap-4 mt-3">
                {error && <span className="text-[#E85555] text-xs font-mono">{error}</span>}
                {!error && (
                <span className="flex items-center gap-2 text-xs sm:text-sm font-mono text-[#8A92A6]/60 cursor-pointer select-none" onClick={() => setConsensusThreshold(consensusThreshold === 2 ? 3 : 2)}>
                  Threshold:
                  <span className={`px-2.5 py-1 rounded border transition-all ${consensusThreshold === 2 ? 'border-[#3CB878]/40 text-[#3CB878] bg-[#3CB878]/5' : 'border-[#E8A838]/40 text-[#E8A838] bg-[#E8A838]/5'}`}>
                      {consensusThreshold}/3
                    </span>
                  </span>
                )}
              </div>
            </motion.div>
          </div>

          {/* Workflow — hide when results present */}
          {!consensus && (
            <div className="flex items-center justify-center gap-2 sm:gap-3 mt-6 text-xs sm:text-sm font-mono text-[#8A92A6]/30">
              <span>Paste address</span><span className="text-[#8A92A6]/15">→</span>
              <span style={{color:'#7eb8da'}}>Agent α</span><span className="text-[#8A92A6]/15">→</span>
              <span style={{color:'#D4AF37'}}>Agent β</span><span className="text-[#8A92A6]/15">→</span>
              <span style={{color:'#b57ed8'}}>Agent γ</span><span className="text-[#8A92A6]/15">→</span>
              <span>Consensus</span><span className="text-[#8A92A6]/15">→</span>
              <span className="text-[#3CB878]/50">On-chain verdict</span>
            </div>
          )}

          {/* Arc Ecosystem — hide when results present */}
          {!consensus && (
            <div className="mt-6 max-w-2xl mx-auto">
              <p className="text-[10px] font-mono text-[#8A92A6]/25 uppercase tracking-wider text-center mb-2">Arc Ecosystem</p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {[
                  { label: 'Arc USDC', addr: '0x65bCeeAa40F538dB48c552Ef2757Ff21062826A7', color: '#3CB878' },
                  { label: 'Arc Bridge', addr: '0xB9C21A6fF5C6d95BCd0Ae9A9df6aA442d8BEf826', color: '#7eb8da' },
                  { label: 'Argus Oracle', addr: '0x563b2DA572948C2b54B5f1f26CcFebC153Cb46C8', color: '#D4AF37' },
                ].map(token => (
                  <button
                    key={token.addr}
                    onClick={() => { setAddress(token.addr); setError(''); }}
                    className="px-3 py-1.5 rounded-lg text-xs font-mono border border-[#D4AF37]/10 bg-[#0E1423] text-[#8A92A6]/50 hover:border-[#D4AF37]/30 hover:text-[#8A92A6]/80 transition-all"
                  >
                    <span className="w-1.5 h-1.5 rounded-full inline-block mr-1.5" style={{ background: token.color }} />
                    {token.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Scan progress */}
          <AnimatePresence>
            {scanProgress && (
              <motion.div className="mb-8 max-w-2xl mx-auto" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                <div className="bg-[#0E1423] border border-[#D4AF37]/10 rounded-2xl p-6">
                  <p className="font-cinzel text-xs text-[#D4AF37] tracking-wider mb-4 uppercase">Analysis Protocol Active</p>
                  <div className="space-y-2">
                    {SCAN_STEPS.map((step, i) => {
                      const done = i < scanStep;
                      const active = i === scanStep;
                      return (
                        <motion.div key={i} className={`flex items-center gap-3 text-xs font-mono ${done ? 'text-[#3CB878]' : active ? 'text-[#D4AF37]' : 'text-[#8A92A6]/30'}`}
                          initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${done ? 'bg-[#3CB878]' : active ? 'bg-[#D4AF37] animate-pulse' : 'bg-[#8A92A6]/20'}`} />
                          <span className="flex-1">{step}</span>
                          {done && <span className="text-[10px]">✓</span>}
                          {active && <span className="w-16 h-3 bg-[#D4AF37]/10 rounded-full overflow-hidden"><motion.div className="h-full bg-[#D4AF37]/30 rounded-full" initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 0.6, ease: 'easeInOut' }} /></span>}
                        </motion.div>
                      );
                    })}
                  </div>
                  {/* Per-agent checks */}
                  {Object.entries(completedChecks).map(([agent, count]) => {
                    const meta = AGENT_META[agent];
                    if (!meta) return null;
                    return (
                      <div key={agent} className="mt-3 pt-3 border-t border-[#D4AF37]/5">
                        <p className="text-[10px] font-mono mb-1.5" style={{ color: meta.color }}>{meta.label} — {meta.model}</p>
                        <div className="flex flex-wrap gap-1">
                          {meta.checks.map((check, j) => (
                            <motion.span key={j} className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${j < count ? 'bg-[#3CB878]/10 text-[#3CB878]' : 'bg-[#F8F8F5]/3 text-[#8A92A6]/30'}`}
                              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: j * 0.1 }}>
                              {j < count ? '✓' : '○'} {check}
                            </motion.span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Results */}
          <AnimatePresence>
            {!loading && consensus && (
              <motion.div className="space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>
                {/* ===== HERO VERDICT ===== */}
                <div ref={verdictRef} className="rounded-2xl p-4 sm:p-5 text-center"
                  style={{ background: verdictBg(consensus.verdict), border: `1px solid ${verdictBorder(consensus.verdict)}`, boxShadow: verdictGlow(consensus.verdict) }}>
                  
                  <p className="font-cinzel text-2xl sm:text-3xl md:text-4xl font-bold tracking-wider mb-0.5" style={{ color: verdictColor(consensus.verdict) }}>
                    {consensus.verdict}
                  </p>
                  {vLabel && <p className="text-sm text-[#8A92A6]/50 mb-2">{vLabel.short}</p>}

                  <p className="font-mono text-2xl sm:text-3xl font-bold tracking-tight mb-0.5" style={{ color: verdictColor(consensus.verdict) }}>
                    {riskScore}<span className="text-lg sm:text-xl text-[#8A92A6]/30">/100</span>
                  </p>
                  <p className="font-mono text-xs text-[#8A92A6]/50 uppercase tracking-wider mb-2">Risk Score</p>

                  <div className="flex items-center justify-center gap-3 sm:gap-4 text-xs font-mono text-[#8A92A6]/50 flex-wrap mb-2">
                    <span>{consensus.agreementCount}/{consensus.totalAgents} consensus</span>
                    {consensus.settlementBatchId && (
                      <><span className="text-[#8A92A6]/20">|</span><span className="text-[#3CB878]/70">Verified on-chain</span></>
                    )}
                    {uniqueFindings.length > 0 && (
                      <><span className="text-[#8A92A6]/20">|</span><span className="text-[#E85555]/70">{uniqueFindings.length} risk factor{uniqueFindings.length > 1 ? 's' : ''}</span></>
                    )}
                  </div>

                  <div className="flex items-center justify-center gap-3 sm:gap-5 text-xs font-mono flex-wrap">
                    {['Agent-α', 'Agent-β', 'Agent-γ'].map(name => {
                      const meta = AGENT_META[name];
                      const agentResult = agents.find(a => a.name === name);
                      const v = agentResult?.verdict || '—';
                      return (
                        <span key={name} className="flex items-center gap-1.5">
                          <span style={{ color: meta.color }}>{meta.label}</span>
                          <span style={{ color: verdictColor(v) }}>{v}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* ===== CONTRACT METADATA ===== */}
                <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-xs font-mono text-[#8A92A6]/40">
                  <a href={`https://testnet.arcscan.app/address/${address}`} target="_blank" rel="noopener noreferrer"
                    className="text-[#7eb8da]/60 hover:text-[#7eb8da] transition-colors">
                    {address.slice(0,8)}...{address.slice(-6)} ↗
                  </a>
                  <span className="text-[#8A92A6]/15">|</span>
                  <span>Arc Testnet</span>
                  <span className="text-[#8A92A6]/15">|</span>
                  <span>{consensus.agreementCount}/{consensus.totalAgents} consensus</span>
                  {consensus.settlementBatchId && (
                    <><span className="text-[#8A92A6]/15">|</span><span className="text-[#3CB878]/60">On-chain verified</span></>
                  )}
                </div>

                {/* ===== DECISION SUMMARY ===== */}
                {uniqueFindings.length > 0 && (
                  <div className="bg-[#0E1423] border border-[#D4AF37]/10 rounded-xl p-4 sm:p-5">
                    <p className="font-mono text-sm text-[#8A92A6]/40 uppercase tracking-wider mb-3">
                      Why this is {consensus.verdict.toLowerCase()}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3">
                      {uniqueFindings.map((f, j) => (
                        <RiskFactorItem key={j} factor={f} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Agent panels */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {agents.map((agent) => (
                    <AgentCard
                      key={agent.name}
                      agent={agent}
                      meta={AGENT_META[agent.name] || { label: agent.name, model: '', color: '#8A92A6', checks: [] }}
                      expanded={expandedAgent === agent.name}
                      onToggle={() => setExpandedAgent(expandedAgent === agent.name ? null : agent.name)}
                    />
                  ))}
                </div>

                {/* ===== EXPANDED ANALYSIS (full-width) ===== */}
                {expandedAgent && (() => {
                  const agent = agents.find(a => a.name === expandedAgent);
                  if (!agent) return null;
                  return (
                    <ExpandedAnalysis
                      agent={agent}
                      meta={AGENT_META[agent.name] || { label: agent.name, model: '', color: '#8A92A6' }}
                    />
                  );
                })()}

                {/* Share bar */}
                <motion.div className="flex items-center justify-center gap-3 flex-wrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
                  <button onClick={handleShare} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-cinzel tracking-wider border border-[#D4AF37]/30 text-[#D4AF37]/80 hover:bg-[#D4AF37]/10 transition-colors">
                    {copied ? '✓ Link copied!' : <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg> Copy link</>}
                  </button>
                  <button onClick={handleTweet} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-cinzel tracking-wider border border-[#1DA1F2]/30 text-[#1DA1F2]/80 hover:bg-[#1DA1F2]/10 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> Tweet
                  </button>
                </motion.div>

                {/* Live Scan Activity + Intelligence Feed */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                  <motion.div className="bg-[#0E1423] border border-[#D4AF37]/8 rounded-2xl p-4 sm:p-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}>
                    <div className="flex items-center gap-2 mb-4">
                      <span className="w-2 h-2 rounded-full bg-[#3CB878] animate-pulse" />
                      <p className="font-mono text-sm text-[#8A92A6]/60 tracking-wider uppercase">Live Scan Activity</p>
                    </div>
                    {liveFeed.length > 0 ? (
                    <div className="space-y-1">
                      {liveFeed.map((item, i) => (
                        <motion.div key={i} className="flex items-center gap-3 text-sm font-mono py-2 border-b border-[#D4AF37]/3 last:border-0"
                          initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.0 + i * 0.1 }}>
                          <span className="text-[#8A92A6]/30 w-14 flex-shrink-0">{item.time}</span>
                          <span className="text-[#8A92A6]/50">{item.addr}</span>
                          <span className="text-[#8A92A6]/50">{item.consensus}</span>
                          <span className="uppercase tracking-wider font-medium text-xs ml-auto" style={{ color: verdictColor(item.verdict) }}>{item.verdict}</span>
                        </motion.div>
                      ))}
                    </div>
                    ) : (
                      <p className="font-mono text-sm text-[#8A92A6]/25 py-4 text-center">No scans yet.</p>
                    )}
                  </motion.div>
                  <motion.div className="bg-[#0E1423] border border-[#D4AF37]/8 rounded-2xl p-4 sm:p-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.0 }}>
                    <div className="flex items-center gap-2 mb-4">
                      <span className="w-2 h-2 rounded-full bg-[#D4AF37] animate-pulse" />
                      <p className="font-mono text-sm text-[#8A92A6]/60 tracking-wider uppercase">Intelligence Feed</p>
                    </div>
                    {liveFeed.length > 0 ? (
                    <div className="space-y-1">
                      {liveFeed.slice(0, 6).map((item, i) => (
                        <motion.div key={i} className="flex items-center gap-3 text-sm font-mono py-2 border-b border-[#D4AF37]/3 last:border-0"
                          initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.1 + i * 0.1 }}>
                          <span className="text-[#8A92A6]/30 w-14 flex-shrink-0">{item.time}</span>
                          <span className="text-[#8A92A6]/50">Consensus: {item.verdict} ({item.consensus})</span>
                        </motion.div>
                      ))}
                    </div>
                    ) : (
                      <p className="font-mono text-sm text-[#8A92A6]/25 py-4 text-center">Intelligence events appear during scans.</p>
                    )}
                  </motion.div>
                </div>

                {/* Recent Verdicts */}
                {recentVerdicts.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">{recentVerdicts.map((v,i)=>(<motion.div key={v.name+'-'+i} className="bg-[#0E1423] border border-[#D4AF37]/8 rounded-xl p-3 sm:p-4 text-center" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:0.6+i*0.08}} whileHover={{borderColor:`${verdictColor(v.verdict)}40`,y:-1}}><p className="font-mono text-xs text-[#8A92A6]/50 mb-2">{v.name}</p><p className={`font-cinzel text-xl sm:text-2xl tracking-wider mb-1 ${verdictGlowClass(v.verdict)}`} style={{color:verdictColor(v.verdict)}}>{v.verdict}</p><p className="font-mono text-[10px] text-[#8A92A6]/40">{v.consensus} · {v.time}</p></motion.div>))}</div>
                ) : (
                <div className="bg-[#0E1423] border border-[#D4AF37]/8 rounded-xl p-4 sm:p-5 text-center">
                  <p className="font-mono text-sm text-[#8A92A6]/40">No completed analyses yet.</p>
                  <p className="font-mono text-xs text-[#8A92A6]/20 mt-1">Awaiting first contract scan.</p>
                </div>
                )}

                {/* Analysis History */}
                {analysisHistory.length > 0 ? (
                <div className="bg-[#0E1423] border border-[#D4AF37]/8 rounded-2xl overflow-hidden"><div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-[#D4AF37]/5"><p className="font-cinzel text-sm text-[#D4AF37]/80 tracking-wider uppercase">Analysis History</p></div><div className="overflow-x-auto"><table className="w-full text-sm font-mono"><thead><tr className="text-[#8A92A6]/50 text-left"><th className="px-3 sm:px-5 py-3 font-normal">Contract</th><th className="px-3 sm:px-5 py-3 font-normal">Verdict</th><th className="px-3 sm:px-5 py-3 font-normal hidden sm:table-cell">Consensus</th><th className="px-3 sm:px-5 py-3 font-normal">Conf.</th><th className="px-3 sm:px-5 py-3 font-normal hidden sm:table-cell">Timestamp</th></tr></thead><tbody>{analysisHistory.map((row,i)=>(<motion.tr key={row.addr+'-'+i} className="border-t border-[#D4AF37]/3 hover:bg-[#D4AF37]/3 transition-colors cursor-default" initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.8+i*0.05}}><td className="px-3 sm:px-5 py-3 text-[#7eb8da] font-medium">{row.addr}</td><td className="px-3 sm:px-5 py-3"><span className="inline-flex items-center gap-1.5 font-cinzel text-sm tracking-wider" style={{color:verdictColor(row.verdict)}}><span className="w-1.5 h-1.5 rounded-full" style={{background:verdictColor(row.verdict),boxShadow:`0 0 6px ${verdictColor(row.verdict)}`}}/>{row.verdict}</span></td><td className="px-3 sm:px-5 py-3 text-[#8A92A6]/60 hidden sm:table-cell">{row.consensus}</td><td className="px-3 sm:px-5 py-3 text-[#F8F8F5]/80 font-medium">{row.confidence}%</td><td className="px-3 sm:px-5 py-3 text-[#8A92A6]/40 hidden sm:table-cell">{row.time}</td></motion.tr>))}</tbody></table></div></div>
                ) : (
                <div className="bg-[#0E1423] border border-[#D4AF37]/8 rounded-2xl overflow-hidden"><div className="px-5 py-4 border-b border-[#D4AF37]/5"><p className="font-cinzel text-sm text-[#D4AF37]/80 tracking-wider uppercase">Analysis History</p></div><div className="p-6 text-center"><p className="font-mono text-sm text-[#8A92A6]/40">No scan history yet.</p><p className="font-mono text-xs text-[#8A92A6]/20 mt-1">Run a token scan to populate this table.</p></div></div>
                )}

                {/* ArcScan link — points to ArgusOracle where verdict is recorded on-chain */}
                {consensus.settlementBatchId && (
                  <motion.div className="text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>
                    <a href="https://testnet.arcscan.app/address/0x563b2DA572948C2b54B5f1f26CcFebC153Cb46C8" target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-xs font-mono text-[#8A92A6]/40 hover:text-[#D4AF37]/60 transition-colors">
                      Verdict recorded on-chain — View on ArcScan →
                    </a>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {!loading && !consensus && (
            <div className="max-w-2xl mx-auto space-y-6">
              {/* Latest scan — real data from backend */}
              {latestScan ? (
                <div className="bg-[#0E1423] border border-[#D4AF37]/10 rounded-xl p-5">
                  <p className="font-mono text-xs text-[#8A92A6]/40 uppercase tracking-wider mb-3">Latest Analysis</p>
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <a href={`/scan/${latestScan.address}`} className="font-mono text-sm text-[#7eb8da] hover:underline">
                        {latestScan.address.slice(0,8)}...{latestScan.address.slice(-6)}
                      </a>
                      <p className="font-mono text-xs text-[#8A92A6]/30 mt-1">{latestScan.time}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-sm text-[#8A92A6]/50">{latestScan.consensus}</span>
                      <span className={`font-medium text-sm px-3 py-1 rounded-full uppercase tracking-wider ${
                        latestScan.verdict === 'SAFE' ? 'bg-[#3CB878]/10 text-[#3CB878] border border-[#3CB878]/20' :
                        latestScan.verdict === 'RISKY' ? 'bg-[#E8A838]/10 text-[#E8A838] border border-[#E8A838]/20' :
                        'bg-[#E85555]/10 text-[#E85555] border border-[#E85555]/20'
                      }`}>{latestScan.verdict}</span>
                      <span className="font-mono text-sm text-[#F8F8F5]/60">{latestScan.confidence}%</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="font-mono text-base text-[#8A92A6]/30">No scans yet</p>
                  <p className="font-mono text-sm text-[#8A92A6]/15 mt-1">Paste an address above to run your first analysis.</p>
                </div>
              )}
            </div>
          )}
        </main>

        <footer className="border-t border-[#D4AF37]/10 mt-8 sm:mt-16 px-4 sm:px-8 py-6 sm:py-8">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6">
            <div className="text-center md:text-left"><p className="font-cinzel text-base sm:text-lg tracking-[0.15em] sm:tracking-[0.2em] text-[#D4AF37]">ARGUS</p><p className="text-[#8A92A6]/30 text-[10px] font-cinzel tracking-wider mt-1">Τρεις οφθαλμοί. Μια κρίσις.</p></div>
            <div className="flex items-center gap-4 sm:gap-6 text-[10px] font-mono text-[#8A92A6]/30 flex-wrap justify-center">
              <a href="https://github.com/Gideon145/argus" target="_blank" rel="noopener noreferrer" className="hover:text-[#D4AF37]/60 transition-colors">GitHub</a>
              <a href="https://testnet.arcscan.app/address/0x563b2DA572948C2b54B5f1f26CcFebC153Cb46C8" target="_blank" rel="noopener noreferrer" className="hover:text-[#D4AF37]/60 transition-colors">ArcScan</a>
              <a href="https://x.com/Argus_arc" target="_blank" rel="noopener noreferrer" className="hover:text-[#D4AF37]/60 transition-colors">X</a>
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#3CB878]"/>Arc Testnet · Live</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
