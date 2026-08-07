'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { AGENT_URL, ARC_CHAIN_HEX, ARC_CHAIN_ID, ARC_RPC, ARC_EXPLORER, PAYMENT_WEI, TREASURY_ADDRESS } from './constants';

interface WalletState {
  address: string | null;
  balance: string;
  isCircle: boolean;
  circleUserId: string | null;
  faucetStatus: 'idle' | 'funding' | 'funded' | 'skipped';
  faucetTx: string | null;
  isConnected: boolean;
}

interface WalletActions {
  connectMetaMask: () => Promise<void>;
  connectCircle: () => Promise<void>;
  disconnect: () => void;
  refreshBalance: () => Promise<void>;
  sendPayment: () => Promise<string>;
}

type WalletContextType = WalletState & WalletActions;

const WalletContext = createContext<WalletContextType | null>(null);

export function useWallet(): WalletContextType {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within WalletProvider');
  return ctx;
}

/** Wait for MetaMask injection (up to 5s) */
async function getEthereum(): Promise<any> {
  const w = window as any;
  // Check for MetaMask specifically (some browsers inject other ethereum providers)
  if (w.ethereum?.isMetaMask) return w.ethereum;
  if (w.ethereum?.providers?.length) {
    const mm = w.ethereum.providers.find((p: any) => p.isMetaMask);
    if (mm) return mm;
  }
  // Wait for late injection
  for (let i = 0; i < 50; i++) {
    await new Promise(r => setTimeout(r, 100));
    if (w.ethereum?.isMetaMask) return w.ethereum;
    if (w.ethereum?.providers?.length) {
      const mm = w.ethereum.providers.find((p: any) => p.isMetaMask);
      if (mm) return mm;
    }
  }
  return null;
}

/** Poll for transaction receipt */
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

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState('0.00');
  const [isCircle, setIsCircle] = useState(false);
  const [circleUserId, setCircleUserId] = useState<string | null>(() => {
    // Initialize from localStorage on mount — prevents new wallet on every visit
    if (typeof window !== 'undefined') {
      return localStorage.getItem('argus_circle_uid');
    }
    return null;
  });
  const [faucetStatus, setFaucetStatus] = useState<'idle' | 'funding' | 'funded' | 'skipped'>('idle');
  const [faucetTx, setFaucetTx] = useState<string | null>(null);

  const isConnected = !!address;

  const fetchBalance = useCallback(async (addr: string) => {
    try {
      const r = await fetch(`${AGENT_URL}/balance/${addr}`);
      if (r.ok) {
        const data = await r.json();
        setBalance(parseFloat(data.balance).toFixed(2));
      }
    } catch { /* ignore */ }
  }, []);

  const autoFund = useCallback(async (addr: string) => {
    setFaucetStatus('funding');
    try {
      const res = await fetch(`${AGENT_URL}/faucet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: addr }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.funded) {
          setFaucetStatus('funded');
          setFaucetTx(data.txHash);
          setTimeout(() => fetchBalance(addr), 3000);
        } else {
          setFaucetStatus('skipped');
        }
      } else {
        setFaucetStatus('skipped');
      }
    } catch {
      setFaucetStatus('skipped');
    }
  }, [fetchBalance]);

  const connectMetaMask = useCallback(async () => {
    const eth = await getEthereum();
    if (!eth) {
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (isMobile) {
        const ok = confirm('Open this site in the MetaMask app to connect your wallet.\n\nTap OK to open MetaMask.');
        if (ok) window.location.href = 'https://metamask.app.link/dapp/argusarc.xyz';
      } else {
        alert('MetaMask not detected. Please install MetaMask (metamask.io) and refresh the page.');
      }
      return;
    }

    try {
      // This triggers the MetaMask popup if not yet authorized.
      // If already authorized, returns accounts silently — that's normal MetaMask behavior.
      const accounts = await eth.request({ method: 'eth_requestAccounts' });
      if (!accounts?.[0]) { alert('No account selected in MetaMask.'); return; }
      const addr = accounts[0].toLowerCase();
      setAddress(addr);
      setIsCircle(false);
      setCircleUserId(null);
      localStorage.setItem('argus_wallet_type', 'metamask');
      localStorage.removeItem('argus_circle_uid');

      // Ensure Arc testnet
      const currentChain = await eth.request({ method: 'eth_chainId' });
      if (parseInt(currentChain, 16) !== ARC_CHAIN_ID) {
        try {
          await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: ARC_CHAIN_HEX }] });
        } catch (switchErr: any) {
          if (switchErr.code === 4902) {
            await eth.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: ARC_CHAIN_HEX,
                chainName: 'Arc (Testnet)',
                nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
                rpcUrls: [ARC_RPC],
                blockExplorerUrls: [ARC_EXPLORER],
              }],
            });
          }
        }
      }

      await fetchBalance(addr);
      // Auto-fund only if balance is below threshold (funding.ts handles this)
      await autoFund(addr);
    } catch (e: any) {
      if (e.code === 4001) alert('Connection rejected in MetaMask.');
      else if (e.code === -32002) alert('MetaMask is already processing a request. Check the MetaMask extension.');
      else alert('Wallet connection failed: ' + (e.message || 'Unknown error'));
    }
  }, [fetchBalance, autoFund]);

  const connectCircle = useCallback(async () => {
    try {
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

      const assignRes = await fetch(`${AGENT_URL}/wallet/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: uid }),
      });
      if (!assignRes.ok) throw new Error('Wallet assignment failed');
      const assignData = await assignRes.json();
      setAddress(assignData.address);
      setIsCircle(true);
      localStorage.setItem('argus_wallet_type', 'circle');

      await autoFund(assignData.address);
      setTimeout(() => fetchBalance(assignData.address), 3000);
    } catch {
      setFaucetStatus('idle');
      alert('Could not set up your wallet. Please try again or use MetaMask.');
    }
  }, [circleUserId, fetchBalance, autoFund]);

  const disconnect = useCallback(() => {
    setAddress(null);
    setIsCircle(false);
    setCircleUserId(null);
    setBalance('0.00');
    setFaucetStatus('idle');
    setFaucetTx(null);
    localStorage.removeItem('argus_wallet_type');
  }, []);

  const refreshBalance = useCallback(async () => {
    if (address) await fetchBalance(address);
  }, [address, fetchBalance]);

  /** Send $0.01 payment to treasury via MetaMask. Returns tx hash. */
  const sendPayment = useCallback(async (): Promise<string> => {
    if (isCircle) return ''; // Circle payments handled server-side
    const eth = await getEthereum();
    if (!eth || !address) throw new Error('Wallet not connected');

    const currentChain = await eth.request({ method: 'eth_chainId' });
    if (parseInt(currentChain, 16) !== ARC_CHAIN_ID) {
      throw new Error('Not on Arc Testnet. Please switch networks.');
    }

    const txHash = await eth.request({
      method: 'eth_sendTransaction',
      params: [{ from: address, to: TREASURY_ADDRESS, value: PAYMENT_WEI }],
    });

    const receipt = await waitForTransaction(eth, txHash, 20000);
    if (!receipt) throw new Error('Transaction pending. Check MetaMask.');
    if (receipt.status === '0x0') throw new Error('Transaction reverted.');

    return txHash;
  }, [address, isCircle]);

  // Restore session from localStorage on mount
  useEffect(() => {
    const initSession = async () => {
      try {
        const type = localStorage.getItem('argus_wallet_type');
        if (type === 'metamask') {
          const eth = await getEthereum();
          if (eth) {
            const accounts = await eth.request({ method: 'eth_accounts' });
            if (accounts?.[0]) {
              const addr = accounts[0].toLowerCase();
              setAddress(addr);
              setIsCircle(false);
              await fetchBalance(addr);
            }
          }
        } else if (type === 'circle') {
          const uid = localStorage.getItem('argus_circle_uid');
          if (uid) {
            setCircleUserId(uid);
            const res = await fetch(`${AGENT_URL}/wallet/${uid}`);
            if (res.ok) {
              const data = await res.json();
              if (data.address) {
                const addr = data.address.toLowerCase();
                setAddress(addr);
                setIsCircle(true);
                await fetchBalance(addr);
              }
            }
          }
        }
      } catch (err) {
        console.warn('Auto connect session restoration failed:', err);
      }
    };
    initSession();
  }, [fetchBalance]);

  return (
    <WalletContext.Provider value={{
      address, balance, isCircle, circleUserId, faucetStatus, faucetTx, isConnected,
      connectMetaMask, connectCircle, disconnect, refreshBalance, sendPayment,
    }}>
      {children}
    </WalletContext.Provider>
  );
}
