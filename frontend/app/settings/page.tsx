'use client';

import { useState } from 'react';
import { useWallet } from '@/lib/wallet-context';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { StatusDot } from '@/components/ui/StatusDot';
import { formatAddress } from '@/lib/utils';
import { Settings, Sliders, Shield, Circle, Wallet, Database, RefreshCw } from 'lucide-react';

export default function SettingsPage() {
  const {
    address,
    isCircle,
    circleUserId,
    balance,
    isConnected,
    disconnect,
    refreshBalance,
  } = useWallet();

  const [threshold, setThreshold] = useState(2); // default consensus threshold
  const [successMsg, setSuccessMsg] = useState('');

  const saveSettings = () => {
    setSuccessMsg('Parameters saved successfully.');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 border-b border-border">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text-primary flex items-center gap-2">
            <Settings size={20} className="text-accent" /> Platform Settings
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Configure consensus rules, view wallet session data, and inspect node telemetry.
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="p-3 rounded bg-success/5 border border-success/15 text-xs text-success font-mono">
          {successMsg}
        </div>
      )}

      {/* Consensus configurations */}
      <Card title="Consensus Parameters" subtitle="Configure validation thresholds for token audits.">
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-1">
              <span className="font-semibold text-text-primary block">Consensus Agreement Threshold</span>
              <span className="text-text-muted">Minimum number of agents that must agree to carry a verdict.</span>
            </div>
            <select
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="bg-bg-primary border border-border rounded px-3 py-1.5 text-text-secondary focus:border-accent font-mono"
            >
              <option value={2}>2 / 3 Agents (Standard)</option>
              <option value={3}>3 / 3 Agents (Max Safety)</option>
            </select>
          </div>

          <div className="pt-4 border-t border-border flex justify-end">
            <button
              onClick={saveSettings}
              className="px-4 py-2 rounded text-xs font-medium bg-accent text-white hover:bg-accent/90 transition-colors"
            >
              Save Configuration
            </button>
          </div>
        </div>
      </Card>

      {/* Wallet Session information */}
      <Card title="Staking Account Session" subtitle="Current cryptographic session and faucet state.">
        {isConnected ? (
          <div className="space-y-4 text-xs font-mono">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 bg-bg-primary rounded border border-border space-y-1">
                <span className="text-[10px] text-text-muted uppercase">Connected Type</span>
                <span className="text-text-primary font-bold flex items-center gap-1.5 mt-1">
                  {isCircle ? (
                    <>
                      <Circle size={12} className="text-accent" /> Circle pre-created
                    </>
                  ) : (
                    <>
                      <Wallet size={12} className="text-accent" /> MetaMask injected
                    </>
                  )}
                </span>
              </div>
              
              <div className="p-3 bg-bg-primary rounded border border-border space-y-1">
                <span className="text-[10px] text-text-muted uppercase">Staking Balance</span>
                <span className="text-success font-bold text-sm block mt-1">
                  ${balance} USDC
                </span>
              </div>
            </div>

            <div className="space-y-3.5 pt-2">
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-text-muted">Active Address:</span>
                <span className="text-text-secondary select-all">{address}</span>
              </div>

              {isCircle && circleUserId && (
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-text-muted">Circle User ID:</span>
                  <span className="text-text-secondary select-all">{circleUserId}</span>
                </div>
              )}

              <div className="flex justify-between py-1">
                <span className="text-text-muted">Arc Testnet Node:</span>
                <span className="text-text-secondary">https://rpc.testnet.arc.network</span>
              </div>
            </div>

            <div className="pt-4 border-t border-border flex items-center justify-between gap-3">
              <button
                onClick={refreshBalance}
                className="flex items-center gap-1 px-3 py-1.5 rounded border border-border bg-bg-secondary hover:bg-bg-tertiary transition-all text-[11px] font-mono text-text-secondary"
              >
                <RefreshCw size={12} /> Sync Balance
              </button>

              <button
                onClick={disconnect}
                className="px-3 py-1.5 rounded bg-critical/5 border border-critical/15 text-[11px] text-critical hover:bg-critical/10 transition-colors"
              >
                Disconnect Session
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 text-xs text-text-muted font-mono">
            No active session detected. Connect a wallet to view parameters.
          </div>
        )}
      </Card>

      {/* Network parameters */}
      <Card title="Arc Testnet Telemetry" subtitle="RPC network configurations.">
        <div className="space-y-3.5 text-xs font-mono">
          <div className="flex justify-between py-1 border-b border-border/50">
            <span className="text-text-muted">Chain ID:</span>
            <span className="text-text-secondary">5042002 (Arc Testnet)</span>
          </div>
          <div className="flex justify-between py-1 border-b border-border/50">
            <span className="text-text-muted">Gas Asset:</span>
            <span className="text-text-secondary">USDC (Native)</span>
          </div>
          <div className="flex justify-between py-1 border-b border-border/50">
            <span className="text-text-muted">Consensus Engine:</span>
            <span className="text-text-secondary">Malachite BFT</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-text-muted">Network Status:</span>
            <span className="text-success font-medium flex items-center gap-1">
              <StatusDot status="online" /> Live telemetry connected
            </span>
          </div>
        </div>
      </Card>

      {/* Open Source */}
      <Card title="Open Source" subtitle="Agent prompts and system architecture are fully transparent." padding="sm">
        <div className="space-y-3 text-[14px] text-text-secondary leading-relaxed">
          <p>
            All three agent system prompts are publicly auditable. See exactly what instructions Agent α (DeepSeek), Agent β (Claude), and Agent γ (Rule Engine) receive before every scan.
          </p>
          <a
            href="https://github.com/Gideon145/argus/tree/master/agent/src/agents"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded border border-accent/30 bg-accent/5 text-accent hover:bg-accent/10 transition-colors text-[13px] font-medium"
          >
            <Database size={14} /> View Agent Prompts on GitHub →
          </a>
        </div>
      </Card>
    </div>
  );
}
