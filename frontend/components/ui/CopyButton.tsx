'use client';

import { useState, useCallback } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopyButtonProps {
  text: string;
  className?: string;
  label?: string;
}

export function CopyButton({ text, className = '', label }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors ${className}`}
      title="Copy to clipboard"
    >
      {copied ? (
        <><Check size={14} className="text-success" />{label ? 'Copied' : null}</>
      ) : (
        <><Copy size={14} />{label || null}</>
      )}
    </button>
  );
}
