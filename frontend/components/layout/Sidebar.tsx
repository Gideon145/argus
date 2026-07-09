'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Clock, Shield, Menu, X, ShieldAlert, TrendingUp, Settings } from 'lucide-react';
import { useState, type ReactNode } from 'react';

const NAV_ITEMS: { label: string; href: string; icon: ReactNode }[] = [
  { label: 'Dashboard',  href: '/',        icon: <LayoutDashboard size={18} /> },
  { label: 'Stats',      href: '/stats',   icon: <TrendingUp size={18} /> },
  { label: 'Shame',      href: '/shame',   icon: <ShieldAlert size={18} /> },
  { label: 'Patrol',     href: '/patrol',   icon: <Shield size={18} /> },
  { label: 'History',    href: '/history',  icon: <Clock size={18} /> },
  { label: 'Settings',   href: '/settings', icon: <Settings size={18} /> },
];

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    if (href === '/#scan') return false;
    return pathname.startsWith(href);
  };

  const navContent = (
    <>
      {/* Logo */}
      <div className="px-4 py-5 border-b border-border">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-bg-primary border-2 border-accent/40 flex items-center justify-center relative overflow-hidden shadow-[0_0_12px_rgba(59,130,246,0.15)]">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <ellipse cx="8" cy="10" rx="3.5" ry="2.5" fill="#7EB8DA" opacity="0.3" />
              <circle cx="8" cy="10" r="1.3" fill="#7EB8DA" />
              <ellipse cx="16" cy="10" rx="3.5" ry="2.5" fill="#D4AF37" opacity="0.3" />
              <circle cx="16" cy="10" r="1.3" fill="#D4AF37" />
              <ellipse cx="12" cy="17" rx="3.5" ry="2.5" fill="#B57ED8" opacity="0.3" />
              <circle cx="12" cy="17" r="1.3" fill="#B57ED8" />
              <path d="M12 3l-3.5 5h7L12 3z" fill="#3B82F6" opacity="0.7" />
            </svg>
          </div>
          <div>
            <span className="text-[17px] font-bold text-text-primary tracking-wide" style={{ textShadow: '0 0 12px rgba(59,130,246,0.2)' }}>ARGUS</span>
            <span className="block text-[11px] text-text-muted font-mono -mt-0.5">v0.13</span>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map(item => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                active
                  ? 'bg-accent/10 text-accent border border-accent/15'
                  : 'text-text-muted hover:text-text-secondary hover:bg-bg-tertiary/50 border border-transparent'
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-border">
        <div className="text-[12px] text-text-muted leading-relaxed">
          <p className="text-text-muted/70">© 2026 Argus</p>
          <a href="https://x.com/Argus_arc" target="_blank" rel="noopener noreferrer" className="text-accent/60 hover:text-accent transition-colors mt-1 inline-block">@Argus_arc</a>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-3 left-3 z-50 p-2 rounded-md bg-bg-secondary border border-border text-text-secondary hover:text-text-primary transition-colors"
      >
        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-56 border-r border-border bg-bg-secondary flex-shrink-0">
        {navContent}
      </aside>

      {/* Mobile sidebar */}
      <aside
        className={`lg:hidden fixed inset-y-0 left-0 w-56 border-r border-border bg-bg-secondary flex flex-col z-40 transform transition-transform duration-200 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {navContent}
      </aside>
    </>
  );
}
