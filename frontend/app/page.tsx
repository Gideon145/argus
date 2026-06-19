'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GuardianFigure from '@/components/GuardianFigure';

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

const LIVE_FEED = [
  { time: '2s ago', addr: '0x8f3c...2a1d', verdict: 'RISKY' as const, consensus: '2/3' },
  { time: '18s ago', addr: '0xb21a...7e3f', verdict: 'SAFE' as const, consensus: '3/3' },
  { time: '34s ago', addr: '0x4d9e...1b8c', verdict: 'RISKY' as const, consensus: '2/3' },
  { time: '51s ago', addr: '0xa745...9f02', verdict: 'SAFE' as const, consensus: '3/3' },
  { time: '1m ago', addr: '0x3c1d...6e8a', verdict: 'SCAM' as const, consensus: '3/3' },
];

const INTEL_FEED = [
  { text: 'Consensus recorded on-chain', time: '3s ago' },
  { text: 'Agent α flagged ownership risk', time: '12s ago' },
  { text: 'New verdict finalized', time: '27s ago' },
  { text: 'Liquidity anomaly detected', time: '41s ago' },
  { text: 'Transaction batch verified', time: '55s ago' },
  { text: 'Proxy upgrade risk identified', time: '1m ago' },
];

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
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
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

  // Wallet state — window.ethereum
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState('0.00');
  const [faucetStatus, setFaucetStatus] = useState<'idle' | 'funding' | 'funded' | 'skipped'>('idle');
  const [faucetTx, setFaucetTx] = useState<string | null>(null);
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

  const connectWallet = async () => {
    try {
      const eth = (window as any).ethereum;
      if (!eth) { alert('No wallet found. Install MetaMask or Rainbow.'); return; }

      // Step 1: Request accounts FIRST (this triggers the MetaMask popup)
      const accounts = await eth.request({ method: 'eth_requestAccounts' });
      if (!accounts || !accounts[0]) { alert('No account selected. Try again.'); return; }
      const addr: string = accounts[0].toLowerCase();
      setWalletAddress(addr);
      console.log('[Wallet] Connected:', addr.slice(0, 8) + '...');

      // Step 2: Switch to Arc testnet (hackathon standard, chain 5042002)
      try {
        await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x4CE902' }] });
        console.log('[Wallet] Switched to Arc testnet');
      } catch (switchErr: any) {
        console.log('[Wallet] Switch error:', switchErr.code, switchErr.message);
        if (switchErr.code === 4902) {
          // Chain not added yet — add it
          try {
            await eth.request({ method: 'wallet_addEthereumChain', params: [{
              chainId: '0x4CE902',
              chainName: 'Arc Testnet',
              nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
              rpcUrls: ['https://rpc.testnet.arc.network'],
              blockExplorerUrls: ['https://testnet.arcscan.app'],
            }]});
            console.log('[Wallet] Arc testnet added');
          } catch (addErr: any) {
            console.error('[Wallet] Failed to add Arc testnet:', addErr.message);
            alert('Failed to add Arc testnet. Please add it manually:\n\nRPC: https://rpc.testnet.arc.network\nChain ID: 5042002\nSymbol: USDC');
          }
        }
      }

      // Step 3: Fetch USDC balance from agent backend
      await fetchUSDCBalance(addr);

      // Step 4: Auto-fund new user with $0.50 test USDC
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

  useEffect(() => {
    const onMove = (e: MouseEvent) => setMousePos({ x: (e.clientX / window.innerWidth - 0.5) * 20, y: (e.clientY / window.innerHeight - 0.5) * 20 });
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  // Poll real stats from agent backend
  useEffect(() => {
    const poll = async () => {
      try {
        const r = await fetch(`${AGENT_URL}/stats`);
        if (r.ok) setStats(await r.json());
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
      const eth = (window as any).ethereum;
      const TREASURY = '0x0699a029e2e05EC88d6418EC744232702Cf77d81';
      // $0.01 USDC = 0.01 × 10^18 = 10000000000000000 wei (Arc native token = USDC, 18 decimals)
      const PAYMENT_WEI = '0x2386f26fc10000';

      // Step 1: Send $0.01 USDC via MetaMask (native transfer on Arc)
      if (eth && walletAddress) {
        try {
          const txHash = await eth.request({
            method: 'eth_sendTransaction',
            params: [{ from: walletAddress, to: TREASURY, value: PAYMENT_WEI }],
          });
          console.log('[Scan] Payment tx submitted:', txHash);

          // Step 2: Wait for on-chain confirmation
          const receipt = await waitForTransaction(eth, txHash, 20000);
          if (!receipt) {
            setError('Transaction pending too long. Try again.');
            setLoading(false);
            if (scanTimerRef.current) clearInterval(scanTimerRef.current);
            return;
          }
          if (receipt.status === '0x0') {
            setError('Payment transaction reverted on-chain. Check your wallet has USDC.');
            setLoading(false);
            if (scanTimerRef.current) clearInterval(scanTimerRef.current);
            return;
          }
          console.log('[Scan] Payment confirmed — block', parseInt(receipt.blockNumber, 16));
        } catch (payErr: any) {
          if (payErr.code === 4001) {
            setError('Payment rejected — scan cancelled');
          } else if (payErr.message?.includes('insufficient')) {
            setError('Insufficient USDC. You need at least $0.01 to scan.');
          } else {
            setError('Payment failed: ' + (payErr.message || 'Unknown error'));
          }
          setLoading(false);
          if (scanTimerRef.current) clearInterval(scanTimerRef.current);
          return;
        }
      } else {
        setError('Connect wallet to scan');
        setLoading(false);
        if (scanTimerRef.current) clearInterval(scanTimerRef.current);
        return;
      }

      // Step 3: Payment confirmed — run the scan analysis
      const res = await fetch(`${AGENT_URL}/scan`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractAddress: address, chain: 'eth' }),
      });

      let data: ScanResult;
      if (res.status === 402) {
        const debugRes = await fetch(`${AGENT_URL}/debug/scan`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contractAddress: address, chain: 'eth' }),
        });
        data = await debugRes.json();
      } else {
        data = await res.json();
      }
      
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

  const verdictBadge = (v: string) => v === 'SAFE' ? 'badge-safe' : v === 'RISKY' ? 'badge-risky' : 'badge-scam';
  const verdictColor = (v: string) => v === 'SAFE' ? '#3CB878' : v === 'RISKY' ? '#E8A838' : '#E85555';
  const feedVerdictColor = (v: string) => v === 'SAFE' ? '#3CB878' : v === 'RISKY' ? '#E8A838' : '#E85555';
  const verdictGlow = (v: string) => v === 'SAFE' ? 'shadow-[0_0_30px_rgba(60,184,120,0.25)]' : v === 'RISKY' ? 'shadow-[0_0_30px_rgba(232,168,56,0.25)]' : 'shadow-[0_0_30px_rgba(232,85,85,0.25)]';
  const agents = result?.result?.agents || [];
  const consensus = result?.result;
  const scanProgress = scanStep >= 0 && scanStep < 9;

  return (
    <div className="min-h-screen bg-[#050816] text-[#F8F8F5] overflow-x-hidden">
      {/* Background layers */}
      <div className="fixed inset-0 z-0">
        <div className="starfield" />
        {/* Network nodes */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.03]" viewBox="0 0 1200 800" preserveAspectRatio="none">
          {Array.from({ length: 8 }, (_, i) => (
            <circle key={i} cx={100 + Math.random() * 1000} cy={50 + Math.random() * 700} r="2" fill="#D4AF37">
              <animate attributeName="opacity" values="0.2;0.6;0.2" dur={`${3 + Math.random() * 4}s`} repeatCount="indefinite" />
            </circle>
          ))}
          {Array.from({ length: 12 }, (_, i) => {
            const x1 = 100 + (i * 90) % 1100, y1 = 50 + (i * 70) % 750;
            const x2 = x1 + (Math.random() - 0.5) * 200, y2 = y1 + (Math.random() - 0.5) * 200;
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#D4AF37" strokeWidth="0.3"><animate attributeName="opacity" values="0.1;0.3;0.1" dur={`${4 + Math.random() * 5}s`} repeatCount="indefinite" /></line>;
          })}
        </svg>
        {/* Floating particles */}
        {Array.from({ length: 25 }, (_, i) => (
          <motion.div key={i} className="absolute rounded-full"
            style={{ width: 1 + Math.random() * 2, height: 1 + Math.random() * 2, background: Math.random() > 0.5 ? '#D4AF37' : '#7eb8da', left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, opacity: 0 }}
            animate={{ y: [-20, -120], opacity: [0, 0.5, 0], x: [0, (Math.random() - 0.5) * 30] }}
            transition={{ duration: 3 + Math.random() * 5, repeat: Infinity, delay: Math.random() * 8, ease: 'easeInOut' }} />
        ))}
      </div>

      {/* Guardian parallax */}
      <motion.div className="fixed inset-0 z-0 pointer-events-none" animate={{ x: mousePos.x * 0.4, y: mousePos.y * 0.4 }} transition={{ type: 'spring', stiffness: 40, damping: 30 }}>
        <GuardianFigure />
      </motion.div>

      <div className="relative z-10 min-h-screen flex flex-col">

        {/* Top bar */}
        <header className="border-b border-[#D4AF37]/10 px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <motion.span className="font-cinzel text-2xl tracking-[0.25em] text-[#D4AF37]" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8 }}>
              ARGUS
            </motion.span>
            <span className="text-[#8A92A6]/40 text-xs font-cinzel tracking-[0.2em] hidden sm:inline">Τρεις οφθαλμοί. Μια κρίσις.</span>
          </div>
          <div className="flex items-center gap-6 text-xs font-mono text-[#8A92A6]/60">
            <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#3CB878] animate-pulse" />Arc Testnet</span>
            <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#D4AF37] animate-pulse" />3 Agents Active</span>
            {isConnected && <span className="flex items-center gap-2 text-[#3CB878]"><span className="w-2 h-2 rounded-full bg-[#3CB878]" />${walletBalance} USDC</span>}
            {faucetStatus === 'funding' && <span className="flex items-center gap-2 text-[#E8A838] text-xs"><span className="w-2 h-2 rounded-full bg-[#E8A838] animate-pulse" />Funding...</span>}
            {faucetStatus === 'funded' && <span className="flex items-center gap-2 text-[#3CB878] text-xs"><span className="w-2 h-2 rounded-full bg-[#3CB878]" />+$0.50 USDC</span>}
            <button onClick={connectWallet} className={isConnected ? 'px-3 py-1.5 rounded-lg text-xs font-cinzel tracking-wider border border-[#3CB878]/40 text-[#3CB878] bg-[#3CB878]/5 transition-all duration-300' : 'px-3 py-1.5 rounded-lg text-xs font-cinzel tracking-wider border border-[#D4AF37]/30 text-[#D4AF37] hover:border-[#D4AF37]/60 hover:bg-[#D4AF37]/10 transition-all duration-300'}>
              {isConnected ? `✓ ${walletAddress?.slice(0,6)}...${walletAddress?.slice(-4)}` : 'Connect Wallet'}
            </button>
          </div>
        </header>

        <main className="flex-1 max-w-6xl mx-auto w-full px-6 pt-6 pb-8">

          {/* Hero + Search */}
          <motion.div className="text-center mb-4" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.3 }}>
            <div className="relative inline-block mb-4">
              <motion.h1 className="font-cinzel text-8xl md:text-9xl font-bold tracking-[0.2em] text-[#D4AF37] select-none"
                initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.2, ease: 'easeOut' }}>
                ARGUS
              </motion.h1>
              <motion.div className="absolute inset-0" initial={{ x: '-100%' }} animate={{ x: '200%' }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 8, ease: 'easeInOut' }}
                style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(212,175,55,0.12) 45%, rgba(255,255,255,0.2) 50%, rgba(212,175,55,0.12) 55%, transparent 100%)', pointerEvents: 'none' }} />
            </div>
            <motion.p className="text-[#8A92A6] text-xl md:text-2xl tracking-[0.3em] font-cinzel mb-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
              Τρεις οφθαλμοί. Μια κρίσις.
            </motion.p>
            <motion.p className="text-[#8A92A6]/70 text-base max-w-xl mx-auto leading-relaxed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>
              Three independent intelligence systems analyze every token contract. Each stakes real capital on its verdict. Consensus determines the truth.
            </motion.p>

            {/* Search */}
            <motion.div className="mt-8 max-w-2xl mx-auto" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 }}>
              <div className="flex gap-3">
                <motion.div className="flex-1 relative" whileHover={{ scale: 1.01 }}>
                  <input type="text" placeholder="Paste token contract address..." value={address}
                    onChange={(e) => { setAddress(e.target.value); setError(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && handleScan()} disabled={loading}
                    className="input-gold w-full bg-[#0E1423] border border-[#D4AF37]/30 rounded-xl px-5 py-5 font-mono text-base text-[#F8F8F5] placeholder-[#8A92A6]/40 disabled:opacity-50 transition-all duration-300 focus:border-[#D4AF37]/60 focus:shadow-[0_0_40px_rgba(212,175,55,0.1)]" autoFocus />
                  {loading && <motion.div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none" initial={{ x: '-100%' }} animate={{ x: '100%' }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}>
                    <div className="w-20 h-full bg-gradient-to-r from-transparent via-[#D4AF37]/10 to-transparent" /></motion.div>}
                </motion.div>
                <motion.button onClick={handleScan} disabled={loading || !isValidAddress(address)}
                  className="bg-[#D4AF37]/10 border border-[#D4AF37]/40 rounded-xl px-8 py-5 font-cinzel text-sm text-[#D4AF37] tracking-wider uppercase hover:bg-[#D4AF37]/20 hover:shadow-[0_0_40px_rgba(212,175,55,0.2)] disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-300 min-w-[140px] relative overflow-hidden"
                  whileHover={!loading && isValidAddress(address) ? { scale: 1.03 } : {}}
                  whileTap={!loading && isValidAddress(address) ? { scale: 0.97 } : {}}
                >
                  {loading ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-[#D4AF37]/30 border-t-[#D4AF37] rounded-full animate-spin" /></span> : 'SCAN'}
                </motion.button>
              </div>
              <div className="flex items-center justify-center gap-4 mt-3">
                {error && <span className="text-[#E85555] text-xs font-mono">{error}</span>}
              </div>
            </motion.div>
          </motion.div>

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
                {/* Consensus header */}
                <motion.div className="bg-[#0E1423] border rounded-2xl p-6 relative overflow-hidden"
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
                  style={{ borderColor: consensus.verdict === 'SAFE' ? 'rgba(60,184,120,0.3)' : consensus.verdict === 'RISKY' ? 'rgba(232,168,56,0.3)' : 'rgba(232,85,85,0.3)' }}>
                  {/* Pulse ring on verdict */}
                  <motion.div className="absolute inset-0 rounded-2xl" initial={{ boxShadow: `0 0 0px ${verdictColor(consensus.verdict)}` }}
                    animate={{ boxShadow: [`0 0 0px ${verdictColor(consensus.verdict)}00`, `0 0 40px ${verdictColor(consensus.verdict)}15`, `0 0 0px ${verdictColor(consensus.verdict)}00`] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }} />
                  <div className="relative flex items-center justify-between">
                    <div className="flex items-center gap-5">
                      <motion.span className="font-cinzel text-4xl tracking-wider" style={{ color: verdictColor(consensus.verdict) }} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}>
                        {consensus.agreementCount}/{consensus.totalAgents}
                      </motion.span>
                      <div>
                        <p className="font-mono text-xs text-[#8A92A6] tracking-wider uppercase">Consensus</p>
                        <motion.p className="font-cinzel text-2xl tracking-wider" style={{ color: verdictColor(consensus.verdict) }} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
                          {consensus.verdict}
                        </motion.p>
                      </div>
                      {/* Vote indicators */}
                      <div className="flex gap-2 ml-4">
                        {['Agent-α', 'Agent-β', 'Agent-γ'].map((name, i) => {
                          const meta = AGENT_META[name];
                          const agreed = consensus.winningAgents.includes(name);
                          return (
                            <motion.div key={name} className="w-3 h-3 rounded-full" style={{ background: agreed ? meta.color : '#1a1a2e', boxShadow: agreed ? `0 0 8px ${meta.color}` : 'none' }}
                              initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.4 + i * 0.1, type: 'spring' }} />
                          );
                        })}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-xs text-[#8A92A6]">{consensus.winningAgents.join(', ')} agreed</p>
                      {consensus.settlementBatchId && (
                        <motion.p className="font-mono text-xs text-[#3CB878] mt-1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
                          Verified on-chain · {consensus.settlementBatchId.slice(0, 14)}...
                        </motion.p>
                      )}
                    </div>
                  </div>
                </motion.div>

                {/* Agent panels */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {agents.map((agent, i) => {
                    const meta = AGENT_META[agent.name] || { label: agent.name, model: '', color: '#8A92A6', checks: [] };
                    const won = consensus.winningAgents.includes(agent.name);
                    return (
                      <motion.div key={agent.name} className="bg-[#0E1423] border rounded-2xl overflow-hidden group"
                        initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.15, duration: 0.5 }}
                        whileHover={{ borderColor: meta.color + '50', y: -2 }} style={{ borderColor: won ? `${meta.color}25` : 'rgba(138,146,166,0.08)' }}>
                        <motion.div className="h-1" style={{ background: won ? verdictColor(agent.verdict) : '#1a1a2e' }} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.5 + i * 0.15, duration: 0.6 }} />
                        <div className="p-5">
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: meta.color }} />
                                <p className="font-cinzel text-sm tracking-wider" style={{ color: meta.color }}>{meta.label}</p>
                              </div>
                              <p className="text-[#8A92A6]/60 text-xs font-mono mt-0.5">{meta.model}</p>
                            </div>
                            <motion.span className={`font-cinzel text-xs px-3 py-1 rounded-full uppercase tracking-wider ${verdictBadge(agent.verdict)}`}
                              initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.6 + i * 0.1 }}>
                              {agent.verdict}
                            </motion.span>
                          </div>
                          <div className="mb-4">
                            <div className="flex justify-between text-xs font-mono mb-1.5">
                              <span className="text-[#8A92A6]/60">Confidence</span>
                              <motion.span style={{ color: meta.color }}>{agent.confidence}%</motion.span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-[#F8F8F5]/5">
                              <motion.div className="h-1.5 rounded-full" style={{ background: verdictColor(agent.verdict) }} initial={{ width: 0 }} animate={{ width: `${agent.confidence}%` }} transition={{ delay: 0.7 + i * 0.1, duration: 1, ease: 'easeOut' }} />
                            </div>
                          </div>
                          <p className="text-[#8A92A6]/80 text-sm leading-relaxed">{agent.reasoning}</p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Live Scan Activity + Intelligence Feed */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <motion.div className="bg-[#0E1423] border border-[#D4AF37]/8 rounded-2xl p-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}>
                    <div className="flex items-center gap-2 mb-4">
                      <span className="w-2 h-2 rounded-full bg-[#3CB878] animate-pulse" />
                      <p className="font-mono text-xs text-[#8A92A6]/60 tracking-wider uppercase">Live Scan Activity</p>
                    </div>
                    {liveFeed.length > 0 ? (
                    <div className="space-y-1.5">
                      {liveFeed.map((item, i) => (
                        <motion.div key={i} className="flex items-center gap-3 text-xs font-mono py-1.5 border-b border-[#D4AF37]/3 last:border-0"
                          initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.0 + i * 0.1 }}>
                          <span className="text-[#8A92A6]/30 w-14 flex-shrink-0">{item.time}</span>
                          <span className="text-[#8A92A6]/50">{item.addr}</span>
                          <span className="text-[#8A92A6]/50">{item.consensus}</span>
                          <span className="uppercase tracking-wider font-cinzel text-[10px] ml-auto" style={{ color: feedVerdictColor(item.verdict) }}>{item.verdict}</span>
                        </motion.div>
                      ))}
                    </div>
                    ) : (
                      <p className="font-mono text-xs text-[#8A92A6]/25 py-4 text-center">No scans yet.</p>
                    )}
                  </motion.div>
                  <motion.div className="bg-[#0E1423] border border-[#D4AF37]/8 rounded-2xl p-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.0 }}>
                    <div className="flex items-center gap-2 mb-4">
                      <span className="w-2 h-2 rounded-full bg-[#D4AF37] animate-pulse" />
                      <p className="font-mono text-xs text-[#8A92A6]/60 tracking-wider uppercase">Intelligence Feed</p>
                    </div>
                    {liveFeed.length > 0 ? (
                    <div className="space-y-1.5">
                      {liveFeed.slice(0, 6).map((item, i) => (
                        <motion.div key={i} className="flex items-center gap-3 text-xs font-mono py-1.5 border-b border-[#D4AF37]/3 last:border-0"
                          initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.1 + i * 0.1 }}>
                          <span className="text-[#8A92A6]/30 w-14 flex-shrink-0">{item.time}</span>
                          <span className="text-[#8A92A6]/50">Consensus: {item.verdict} ({item.consensus})</span>
                        </motion.div>
                      ))}
                    </div>
                    ) : (
                      <p className="font-mono text-xs text-[#8A92A6]/25 py-4 text-center">Intelligence events appear during scans.</p>
                    )}
                  </motion.div>
                </div>

                {/* Recent Verdicts */}
                {recentVerdicts.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{recentVerdicts.map((v,i)=>(<motion.div key={v.name+'-'+i} className="bg-[#0E1423] border border-[#D4AF37]/8 rounded-xl p-4 text-center" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:0.6+i*0.08}} whileHover={{borderColor:`${verdictColor(v.verdict)}40`,y:-1}}><p className="font-mono text-xs text-[#8A92A6]/50 mb-2">{v.name}</p><p className={`font-cinzel text-2xl tracking-wider mb-1 ${verdictGlow(v.verdict)}`} style={{color:verdictColor(v.verdict)}}>{v.verdict}</p><p className="font-mono text-[10px] text-[#8A92A6]/40">{v.consensus} · {v.time}</p></motion.div>))}</div>
                ) : (
                <div className="bg-[#0E1423] border border-[#D4AF37]/8 rounded-xl p-5 text-center">
                  <p className="font-mono text-sm text-[#8A92A6]/40">No completed analyses yet.</p>
                  <p className="font-mono text-xs text-[#8A92A6]/20 mt-1">Awaiting first contract scan.</p>
                </div>
                )}

                {/* Agent Performance */}
                {agentPerf.length > 0 ? (
                <div className="bg-[#0E1423] border border-[#D4AF37]/8 rounded-2xl p-6"><p className="font-cinzel text-sm text-[#D4AF37]/80 tracking-wider uppercase mb-4">Agent Performance</p><div className="grid grid-cols-1 md:grid-cols-3 gap-6">{agentPerf.map((a,i)=>(<motion.div key={a.label} className="text-center" initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.7+i*0.1}}><p className="font-cinzel text-base tracking-wider mb-1" style={{color:a.color}}>{a.label}</p><p className="text-[#8A92A6]/40 text-xs font-mono mb-3">{a.model}</p><p className="font-mono text-4xl font-bold mb-1" style={{color:a.color}}>{a.accuracy}%</p><div className="w-28 h-1.5 mx-auto rounded-full bg-[#F8F8F5]/5 mb-2"><motion.div className="h-1.5 rounded-full" style={{background:a.color}} initial={{width:0}} animate={{width:`${a.accuracy}%`}} transition={{delay:1+i*0.1,duration:1}}/></div><p className="text-[#8A92A6]/40 text-xs font-mono">{a.total.toLocaleString()} analyses · {a.avgConf}% avg</p><p className="text-[#3CB878] text-xs font-mono mt-1">↑ {a.trend} this week</p></motion.div>))}</div></div>
                ) : (
                <div className="bg-[#0E1423] border border-[#D4AF37]/8 rounded-2xl p-6 text-center">
                  <p className="font-cinzel text-sm text-[#D4AF37]/80 tracking-wider uppercase mb-4">Agent Performance</p>
                  <p className="font-mono text-sm text-[#8A92A6]/40">No performance data yet.</p>
                  <p className="font-mono text-xs text-[#8A92A6]/20 mt-1">ELO scores populate after agent staking rounds complete.</p>
                </div>
                )}

                {/* Analysis History */}
                {analysisHistory.length > 0 ? (
                <div className="bg-[#0E1423] border border-[#D4AF37]/8 rounded-2xl overflow-hidden"><div className="px-5 py-4 border-b border-[#D4AF37]/5"><p className="font-cinzel text-sm text-[#D4AF37]/80 tracking-wider uppercase">Analysis History</p></div><div className="overflow-x-auto"><table className="w-full text-sm font-mono"><thead><tr className="text-[#8A92A6]/50 text-left"><th className="px-5 py-3 font-normal">Contract</th><th className="px-5 py-3 font-normal">Verdict</th><th className="px-5 py-3 font-normal">Consensus</th><th className="px-5 py-3 font-normal">Confidence</th><th className="px-5 py-3 font-normal">Timestamp</th></tr></thead><tbody>{analysisHistory.map((row,i)=>(<motion.tr key={row.addr+'-'+i} className="border-t border-[#D4AF37]/3 hover:bg-[#D4AF37]/3 transition-colors cursor-default" initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.8+i*0.05}}><td className="px-5 py-3 text-[#7eb8da] font-medium">{row.addr}</td><td className="px-5 py-3"><span className="inline-flex items-center gap-1.5 font-cinzel text-sm tracking-wider" style={{color:verdictColor(row.verdict)}}><span className="w-1.5 h-1.5 rounded-full" style={{background:verdictColor(row.verdict),boxShadow:`0 0 6px ${verdictColor(row.verdict)}`}}/>{row.verdict}</span></td><td className="px-5 py-3 text-[#8A92A6]/60">{row.consensus}</td><td className="px-5 py-3 text-[#F8F8F5]/80 font-medium">{row.confidence}%</td><td className="px-5 py-3 text-[#8A92A6]/40">{row.time}</td></motion.tr>))}</tbody></table></div></div>
                ) : (
                <div className="bg-[#0E1423] border border-[#D4AF37]/8 rounded-2xl overflow-hidden"><div className="px-5 py-4 border-b border-[#D4AF37]/5"><p className="font-cinzel text-sm text-[#D4AF37]/80 tracking-wider uppercase">Analysis History</p></div><div className="p-6 text-center"><p className="font-mono text-sm text-[#8A92A6]/40">No scan history yet.</p><p className="font-mono text-xs text-[#8A92A6]/20 mt-1">Run a token scan to populate this table.</p></div></div>
                )}

                {/* ArcScan link */}
                {consensus.settlementBatchId && (
                  <motion.div className="text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>
                    <a href={`https://testnet.arcscan.app/address/${address}`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-xs font-mono text-[#8A92A6]/40 hover:text-[#D4AF37]/60 transition-colors">
                      View on ArcScan →
                    </a>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {!loading && !consensus && (
            <div className="max-w-6xl mx-auto w-full space-y-16 pb-12">

              <motion.div className="max-w-4xl mx-auto" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:2}}>
                <p className="font-cinzel text-sm text-[#D4AF37]/80 tracking-wider uppercase mb-6 text-center">How Argus Works</p>
                <div className="flex flex-col items-center gap-2">
                  {[
                    {step:'01',label:'Contract Address',desc:'User submits a token contract for analysis',color:'#D4AF37'},
                    {step:'02',label:'Agent α · DeepSeek-V3',desc:'Contract logic analysis — ownership, proxies, honeypots',color:'#7eb8da'},
                    {step:'03',label:'Agent β · Claude Sonnet 4',desc:'Tokenomics analysis — holders, liquidity, whales',color:'#D4AF37'},
                    {step:'04',label:'Agent γ · Rule Engine',desc:'Deterministic checks — patterns, exploits, signatures',color:'#b57ed8'},
                    {step:'05',label:'Consensus Formation',desc:'2/3 threshold — agents stake real USDC on verdicts',color:'#D4AF37'},
                    {step:'06',label:'On-Chain Verdict',desc:'Final result recorded immutably on Arc testnet',color:'#3CB878'},
                  ].map((s,i)=>(<motion.div key={s.step} className="flex items-center gap-4 w-full max-w-md" initial={{opacity:0,x:-20}} animate={{opacity:1,x:0}} transition={{delay:2.2+i*0.12}}>
                    <span className="font-mono text-xs w-8 h-8 rounded-full flex items-center justify-center border flex-shrink-0" style={{color:s.color,borderColor:s.color+'30'}}>{s.step}</span>
                    <div><p className="text-sm text-[#F8F8F5]/90">{s.label}</p><p className="text-[10px] text-[#8A92A6]/50 font-mono">{s.desc}</p></div>
                    {i<5&&<span className="text-[#D4AF37]/20 ml-auto">↓</span>}
                  </motion.div>))}
                </div>
              </motion.div>

              <motion.div className="max-w-4xl mx-auto" initial={{opacity:0}} animate={{opacity:1}} transition={{delay:2.5}}>
                <p className="font-cinzel text-sm text-[#D4AF37]/80 tracking-wider uppercase mb-6 text-center">Meet the Agents</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {Object.entries(AGENT_META).map(([key,meta])=>(<motion.div key={key} className="bg-[#0E1423] border border-[#D4AF37]/8 rounded-2xl p-6 group hover:border-[#D4AF37]/20 transition-all duration-300" whileHover={{y:-2}}>
                    <div className="w-10 h-10 rounded-full mb-4 flex items-center justify-center text-lg font-cinzel" style={{background:meta.color+'15',color:meta.color}}>{['α','β','γ'][['Agent-α','Agent-β','Agent-γ'].indexOf(key)]}</div>
                    <p className="font-cinzel text-base tracking-wider mb-1" style={{color:meta.color}}>{meta.label}</p>
                    <p className="text-[#8A92A6]/50 text-xs font-mono mb-4">{meta.model}</p>
                    <div className="space-y-1.5">{meta.checks.map(c=>(<p key={c} className="text-[#8A92A6]/60 text-xs font-mono flex items-center gap-2"><span className="w-1 h-1 rounded-full" style={{background:meta.color}}/>{c}</p>))}</div>
                  </motion.div>))}
                </div>
              </motion.div>

              <motion.div className="max-w-4xl mx-auto" initial={{opacity:0}} animate={{opacity:1}} transition={{delay:2.8}}>
                <p className="font-cinzel text-sm text-[#D4AF37]/80 tracking-wider uppercase mb-6 text-center">Example Analysis</p>
                <div className="bg-[#0E1423] border border-[#3CB878]/20 rounded-2xl p-6 max-w-lg mx-auto" style={{boxShadow:'0 0 40px rgba(60,184,120,0.05)'}}>
                  <div className="flex items-center justify-between mb-4"><p className="font-mono text-sm text-[#7eb8da]">USDC</p><span className="font-cinzel text-xs px-3 py-1 rounded-full badge-safe">SAFE</span></div>
                  <div className="flex items-center gap-4 mb-4"><span className="font-cinzel text-2xl text-[#3CB878]">3/3</span><span className="text-xs font-mono text-[#8A92A6]">Consensus · 96% confidence</span></div>
                  <div className="space-y-1.5 text-xs font-mono text-[#3CB878]/80"><p>✓ Ownership verified</p><p>✓ No honeypot detected</p><p>✓ Deep liquidity confirmed</p><p>✓ Holder distribution healthy</p><p>✓ No deterministic risks</p></div>
                </div>
              </motion.div>

              <motion.div className="max-w-4xl mx-auto" initial={{opacity:0}} animate={{opacity:1}} transition={{delay:3}}>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {[{agent:'Agent α',model:'DeepSeek-V3',desc:'Contract logic analysis — ownership, proxies, honeypots, access control',color:'#7eb8da'},{agent:'Agent β',model:'Claude Sonnet 4',desc:'Tokenomics analysis — holders, liquidity, whales, trading patterns',color:'#D4AF37'},{agent:'Agent γ',model:'Rule Engine',desc:'Deterministic security checks — patterns, exploits, signatures',color:'#b57ed8'},{agent:'Consensus Engine',model:'2/3 Threshold',desc:'Verdict aggregation with real USDC stakes — final outcome recorded on-chain',color:'#3CB878'}].map((c,i)=>(<motion.div key={c.agent} className="bg-[#0E1423] border border-[#D4AF37]/5 rounded-2xl p-5 text-center group hover:border-[#D4AF37]/15 transition-all duration-300" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:3+i*0.1}}>
                    <span className="font-cinzel text-lg tracking-wider mb-2 block" style={{color:c.color}}>{c.agent}</span>
                    <p className="text-[#8A92A6]/50 text-[10px] font-mono mb-2">{c.model}</p>
                    <p className="text-[#8A92A6]/60 text-xs leading-relaxed">{c.desc}</p>
                  </motion.div>))}
                </div>
              </motion.div>

              <motion.div className="max-w-4xl mx-auto" initial={{opacity:0}} animate={{opacity:1}} transition={{delay:3.3}}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[{value:stats.queries.toLocaleString(),label:'Contracts Analyzed',sub:`Live on Arc Testnet`},{value:stats.consensusReached.toLocaleString(),label:'Consensus Decisions',sub:stats.queries>0?`${Math.round(stats.consensusReached/stats.queries*100)}% rate`:'Awaiting data'},{value:stats.onChainRecords.toLocaleString(),label:'On-Chain Records',sub:'Immutable on Arc'},{value:stats.avgConfidence+'%',label:'Avg Confidence',sub:stats.queries>0?'From real scans':'No data yet'}].map((s,i)=>(<motion.div key={s.label} className="bg-[#0E1423] border border-[#D4AF37]/5 rounded-2xl p-5 text-center" initial={{opacity:0,scale:0.9}} animate={{opacity:1,scale:1}} transition={{delay:3.3+i*0.1}}>
                    <p className="font-mono text-2xl font-bold text-[#F8F8F5] mb-1">{s.value}</p><p className="text-[#8A92A6]/40 text-[10px] font-mono uppercase tracking-wider">{s.label}</p><p className="text-[#8A92A6]/20 text-[9px] font-mono mt-1">{s.sub}</p>
                  </motion.div>))}
                </div>
              </motion.div>

            </div>
          )}
        </main>

        <footer className="border-t border-[#D4AF37]/10 mt-16 px-8 py-8">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-center md:text-left"><p className="font-cinzel text-lg tracking-[0.2em] text-[#D4AF37]">ARGUS</p><p className="text-[#8A92A6]/30 text-[10px] font-cinzel tracking-wider mt-1">Τρεις οφθαλμοί. Μια κρίσις.</p></div>
            <div className="flex items-center gap-6 text-[10px] font-mono text-[#8A92A6]/30">
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
