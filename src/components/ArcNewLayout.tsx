'use client';

import React from 'react';
import { useArcUX } from '@/context/ArcGlobalUXContext';
import {
  Home, Send, Download, Clock, Link2, Users, User, Settings,
  Rocket, TrendingUp, ShoppingCart, Dices, Layers, Award,
  Briefcase, PieChart, Zap, ExternalLink,
} from 'lucide-react';

type ViewKey = string;

interface ArcNewLayoutProps {
  currentView:    ViewKey;
  setCurrentView: (v: any) => void;
  profileName:  string;
  profileAvatar?: string;
  usdcBalance:  number;
  children:     React.ReactNode;
}

const NAV_LINKS = [
  { key: 'launcher',          label: 'Launcher',       icon: Rocket     },
  { key: 'trade',             label: 'Trade',           icon: TrendingUp },
  { key: 'social-pay',        label: 'ArcPay',          icon: Send       },
  { key: 'markethub',         label: 'Market Hub',      icon: ShoppingCart },
  { key: 'slots',             label: 'ArcSlots',        icon: Dices      },
  { key: 'builder',           label: 'Builder',         icon: Layers     },
  { key: 'earn',              label: 'Earn',            icon: Award      },
  { key: 'staking',           label: 'Staking',         icon: Zap        },
  { key: 'gigs',              label: 'Gigs',            icon: Briefcase  },
  { key: 'prediction-market', label: 'Predictions',     icon: PieChart   },
  { key: 'leaderboard',       label: 'Leaderboard',     icon: TrendingUp },
];

const QUICK_ACTIONS = [
  { label: 'Send to @username',    icon: Send      },
  { label: 'Scan QR Code',         icon: Download  },
  { label: 'Create Payment Link',  icon: Link2     },
  { label: 'Request Payment',      icon: Users     },
];

export function ArcNewLayout({
  currentView, setCurrentView,
  profileName, profileAvatar,
  usdcBalance, children,
}: ArcNewLayoutProps) {
  const { designVariant, resolvedTheme } = useArcUX();

  const isDark = resolvedTheme === 'dark';
  const isD2   = designVariant === 'design_2';

  // ── Design-aware tokens ────────────────────────────────────────────────────
  const bg     = isDark ? '#08080f'              : '#f0f4ff';
  const bgSide = isDark ? 'rgba(14,12,5,0.95)'  : 'rgba(255,255,255,0.9)';
  const bgCard = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.8)';
  const border = isDark ? 'rgba(245,197,66,0.14)' : 'rgba(59,130,246,0.2)';
  const txt    = isDark ? '#f0e6c8'              : '#0f172a';
  const txtDim = isDark ? '#7a6e52'              : '#64748b';
  const accent = isDark ? '#f5c542'              : '#3b82f6';
  const accentGrad = isDark
    ? 'linear-gradient(135deg,#f5c542,#d4940c)'
    : 'linear-gradient(135deg,#3b82f6,#2563eb)';

  return (
    <div
      className="flex min-h-screen w-full"
      style={{ background: bg, color: txt, fontFamily: 'Inter, sans-serif' }}
    >
      {/* ════════════════════════════════════════════════════════════
          LEFT SIDEBAR
      ════════════════════════════════════════════════════════════ */}
      <aside
        className="hidden lg:flex w-64 flex-col sticky top-[41px] h-[calc(100vh-41px)] overflow-y-auto"
        style={{
          background: bgSide,
          backdropFilter: 'blur(20px)',
          borderRight: `1px solid ${border}`,
        }}
      >
        {/* Brand */}
        <div className="p-5 flex-shrink-0">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center overflow-hidden"
              style={{ background: accentGrad, boxShadow: `0 0 14px ${isDark ? 'rgba(245,197,66,0.35)' : 'rgba(59,130,246,0.35)'}` }}
            >
              <img src="/main-logo.jpg" alt="Arc" className="w-full h-full object-contain p-0.5" />
            </div>
            <div>
              <div className="text-sm font-black tracking-wide" style={{ color: accent }}>ArcOmni</div>
              <div className="text-[10px] font-bold" style={{ color: txtDim }}>PRO</div>
            </div>
          </div>

          {/* LIVE pill */}
          <div
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold w-fit"
            style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e' }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block"
              style={{ animation: 'pulse 2s infinite' }}
            />
            LIVE ON ARC TESTNET
          </div>

          {/* Design 1 hero text */}
          {!isD2 && (
            <div className="mt-5 space-y-1">
              <div className="text-2xl font-black leading-tight" style={{ color: txt }}>Send.</div>
              <div className="text-2xl font-black leading-tight" style={{ color: txt }}>Receive.</div>
              <div className="text-2xl font-black leading-tight" style={{ color: accent }}>Pay.</div>
              <p className="text-xs mt-2 leading-relaxed" style={{ color: txtDim }}>
                Instant USDC payments on Arc Network. Send money by username, QR code, payment links, and payment requests.
              </p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          {NAV_LINKS.map(({ key, label, icon: Icon }) => {
            const active = currentView === key;
            return (
              <button
                key={key}
                onClick={() => setCurrentView(key)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-left"
                style={{
                  background:  active ? (isDark ? 'rgba(245,197,66,0.08)' : 'rgba(59,130,246,0.08)') : 'transparent',
                  color:       active ? accent : txtDim,
                  borderLeft:  active ? `2px solid ${accent}` : '2px solid transparent',
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = isDark ? 'rgba(245,197,66,0.04)' : 'rgba(59,130,246,0.04)'; }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
              >
                <Icon size={14} />
                {label}
              </button>
            );
          })}
        </nav>

        {/* Profile footer */}
        <div
          className="p-4 m-3 rounded-2xl flex-shrink-0"
          style={{ background: bgCard, border: `1px solid ${border}` }}
        >
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-xs font-black"
              style={{ background: accentGrad, color: '#08080f' }}
            >
              {profileAvatar
                ? <img src={profileAvatar} className="w-full h-full object-cover" alt="" />
                : (profileName?.[0]?.toUpperCase() || 'U')}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold truncate" style={{ color: txt }}>@{profileName}</div>
              <div className="text-[10px]" style={{ color: txtDim }}>arc.testnet</div>
            </div>
          </div>
          {/* Need gas */}
          <div className="text-[10px] font-semibold" style={{ color: txtDim }}>
            Need gas?{' '}
            <a href="https://arc-testnet.faucet.com" target="_blank" rel="noreferrer"
              className="font-bold" style={{ color: accent }}>
              Arc Faucet →
            </a>
          </div>
        </div>
      </aside>

      {/* ════════════════════════════════════════════════════════════
          MAIN CONTENT
      ════════════════════════════════════════════════════════════ */}
      <main className="flex-1 min-w-0 flex flex-col lg:flex-row gap-0">

        {/* Center content */}
        <div className="flex-1 min-w-0 p-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 41px)' }}>
          {/* Wrap children in design-aware card surface */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: bgCard,
              backdropFilter: 'blur(16px)',
              border: `1px solid ${border}`,
              boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
            }}
          >
            {children}
          </div>
        </div>

        {/* ════ RIGHT PANEL ════ */}
        <aside
          className="hidden xl:flex flex-col w-72 flex-shrink-0 p-4 space-y-4 overflow-y-auto"
          style={{ maxHeight: 'calc(100vh - 41px)', borderLeft: `1px solid ${border}` }}
        >
          {/* Quick Actions */}
          <div
            className="rounded-2xl p-4"
            style={{ background: bgCard, border: `1px solid ${border}` }}
          >
            <h3 className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: accent }}>
              Quick Actions
            </h3>
            <div className="space-y-1.5">
              {QUICK_ACTIONS.map(({ label, icon: Icon }) => (
                <button
                  key={label}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-left"
                  style={{ background: 'transparent', color: txt }}
                  onMouseEnter={e => (e.currentTarget.style.background = isDark ? 'rgba(245,197,66,0.06)' : 'rgba(59,130,246,0.06)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: isDark ? 'rgba(245,197,66,0.1)' : 'rgba(59,130,246,0.1)', color: accent }}
                  >
                    <Icon size={13} />
                  </span>
                  <span className="flex-1">{label}</span>
                  <span style={{ color: txtDim }}>›</span>
                </button>
              ))}
            </div>
          </div>

          {/* Arc Network */}
          <div
            className="rounded-2xl p-4 space-y-2"
            style={{ background: bgCard, border: `1px solid ${border}` }}
          >
            <h3 className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: accent }}>
              Arc Network
            </h3>
            {[
              { label: 'Network Status', value: 'Connected', dot: true },
              { label: 'Chain ID',        value: '5042002',  dot: false },
              { label: 'RPC',             value: 'arc-testnet.rpc.com', dot: false },
            ].map(({ label, value, dot }) => (
              <div key={label} className="flex items-center justify-between text-xs">
                <span style={{ color: txtDim }}>{label}</span>
                <span className="font-bold flex items-center gap-1.5" style={{ color: txt }}>
                  {dot && <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />}
                  {value}
                </span>
              </div>
            ))}
          </div>

          {/* Get Started */}
          <div
            className="rounded-2xl p-4"
            style={{ background: bgCard, border: `1px solid ${border}` }}
          >
            <h3 className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: accent }}>
              Get Started
            </h3>
            <a
              href="https://arc-testnet.rpc.com"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between text-xs font-semibold px-3 py-2 rounded-xl"
              style={{ background: isDark ? 'rgba(245,197,66,0.06)' : 'rgba(59,130,246,0.06)', color: accent }}
            >
              Learn about Arc
              <ExternalLink size={12} />
            </a>
          </div>
        </aside>
      </main>
    </div>
  );
}
