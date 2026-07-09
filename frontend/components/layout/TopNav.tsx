'use client';

import { useWallet } from '@/lib/wallet-context';
import { StatusDot } from '@/components/ui/StatusDot';
import { Wallet, ChevronDown, Zap, ExternalLink } from 'lucide-react';
import { formatAddress } from '@/lib/utils';

export function TopNav() {
  const { isConnected, address, balance, isCircle, faucetStatus, connectMetaMask, connectCircle, disconnect } = useWallet();

  return (
    <header className="h-14 border-b border-border bg-bg-secondary/80 backdrop-blur-sm flex items-center justify-between px-4 lg:px-6 flex-shrink-0 z-30">
      {/* Left section */}
      <div className="flex items-center gap-5">
        {/* Network */}
        <div className="hidden md:flex items-center gap-2 text-xs">
          <StatusDot status="online" />
          <span className="text-text-secondary font-medium">Arc Testnet</span>
        </div>

        {/* Agent status */}
        <div className="hidden lg:flex items-center gap-2 text-xs">
          <div className="flex -space-x-1">
            {['#7EB8DA', '#D4AF37', '#B57ED8'].map(color => (
              <span key={color} className="w-2 h-2 rounded-full border border-bg-secondary" style={{ backgroundColor: color }} />
            ))}
          </div>
          <span className="text-text-muted">3 agents online</span>
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-3">
        {/* Balance */}
        {isConnected && (
          <div className="hidden sm:flex items-center gap-1.5 text-xs font-mono">
            <span className="text-success font-medium">${balance}</span>
            <span className="text-text-muted">USDC</span>
          </div>
        )}

        {/* Wallet */}
        {!isConnected ? (
          <div className="flex items-center gap-2">
            <button
              onClick={connectCircle}
              disabled={faucetStatus === 'funding'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-accent text-white hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              <Zap size={14} />
              {faucetStatus === 'funding' ? 'Setting up...' : 'Get Started'}
            </button>
            <button
              onClick={connectMetaMask}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-border text-text-secondary hover:text-text-primary hover:border-border-active transition-colors"
            >
              <Wallet size={14} />
              MetaMask
            </button>
          </div>
        ) : (
          <button
            onClick={disconnect}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono border border-success/20 text-success bg-success/5 hover:bg-success/10 transition-colors"
          >
            {isCircle && <Zap size={12} />}
            {address ? formatAddress(address) : ''}
            <ChevronDown size={12} className="text-text-muted" />
          </button>
        )}

        {/* Explorer link */}
        {isConnected && address && (
          <a
            href={`https://testnet.arcscan.app/address/${address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-muted hover:text-text-secondary transition-colors"
            title="View on ArcScan"
          >
            <ExternalLink size={14} />
          </a>
        )}
      </div>
    </header>
  );
}
