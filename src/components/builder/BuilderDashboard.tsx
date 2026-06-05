'use client';

import React from 'react';
import { AppRegistration } from './AppRegistration';
import { ContractTracker } from './ContractTracker';
import { Leaderboard } from './Leaderboard';
import { Rocket } from 'lucide-react';

export function BuilderDashboard() {
  return (
    <div
      className="min-h-screen text-slate-200 p-4 md:p-8 font-sans selection:bg-amber-500/30"
      style={{ background: 'var(--bd-bg-primary, #0a0a0f)' }}
    >
      {/* ── CSS custom properties ── */}
      <style>{`
        :root {
          --bd-bg-primary: #0a0a0f;
          --bd-accent-gold: #f5c542;
          --bd-accent-purple: #c084fc;
        }

        /* Glass-morphism card */
        .bd-card {
          background: rgba(255, 255, 255, 0.04);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(245, 197, 66, 0.15);
          border-radius: 1.25rem;
        }

        /* Primary action button */
        .bd-btn-primary {
          background: linear-gradient(135deg, #f5c542 0%, #e09f1e 100%);
          color: #0a0a0f;
          box-shadow: 0 0 18px rgba(245, 197, 66, 0.4);
          font-weight: 700;
          border: none;
          transition: opacity 0.2s, transform 0.1s;
        }
        .bd-btn-primary:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
        .bd-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

        /* Form inputs */
        .bd-input {
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(245, 197, 66, 0.2);
          color: #e2e8f0;
          border-radius: 0.5rem;
          padding: 0.625rem 0.75rem;
          width: 100%;
          font-size: 0.875rem;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .bd-input:focus {
          border-color: #f5c542;
          box-shadow: 0 0 10px rgba(245, 197, 66, 0.25);
        }

        /* Verified badge */
        .bd-badge-verified {
          background: rgba(245, 197, 66, 0.15);
          border: 1px solid rgba(245, 197, 66, 0.4);
          color: var(--bd-accent-gold);
        }

        /* Stat value shimmer */
        @keyframes stat-shimmer {
          0%, 100% { background-position: 0% 50%; }
          50%       { background-position: 100% 50%; }
        }
        .stat-value {
          background: linear-gradient(90deg, #f5c542, #c084fc, #f5c542);
          background-size: 200% 200%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
          animation: stat-shimmer 3s ease infinite;
        }

        /* Loading skeleton */
        @keyframes skeleton-pulse {
          0%, 100% { opacity: 0.4; }
          50%       { opacity: 0.8; }
        }
        .bd-skeleton {
          background: rgba(245, 197, 66, 0.08);
          border-radius: 0.5rem;
          animation: skeleton-pulse 1.4s ease-in-out infinite;
        }

        /* Scrollable image row */
        .bd-img-scroll {
          overflow-x: auto;
          overflow-y: hidden;
          display: flex;
          gap: 0.75rem;
          padding-bottom: 0.5rem;
        }
        .bd-img-scroll::-webkit-scrollbar { height: 4px; }
        .bd-img-scroll::-webkit-scrollbar-thumb { background: rgba(245,197,66,0.3); border-radius: 2px; }
      `}</style>

      <div className="max-w-7xl mx-auto space-y-8">

        {/* ── Header ── */}
        <div className="bd-card p-5 flex items-center gap-4">
          <div
            className="w-12 h-12 flex-shrink-0 rounded-xl flex items-center justify-center shadow-lg"
            style={{ background: 'linear-gradient(135deg, #f5c542 0%, #e09f1e 100%)', boxShadow: '0 0 18px rgba(245,197,66,0.4)' }}
          >
            <Rocket style={{ color: '#0a0a0f' }} size={24} />
          </div>
          <div className="min-w-0">
            <h1
              className="font-black tracking-tight truncate"
              style={{ color: 'var(--bd-accent-gold)', fontSize: 'clamp(1.25rem, 4vw, 1.875rem)' }}
            >
              ArcOmni Builder Dashboard
            </h1>
            <p className="text-sm" style={{ color: 'var(--bd-accent-purple)' }}>
              Deploy, Track, and Scale on Arc Chain
            </p>
          </div>
        </div>

        {/* ── Top grid: Registration + Tracker ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section><AppRegistration /></section>
          <section><ContractTracker /></section>
        </div>

        {/* ── Leaderboard ── */}
        <Leaderboard />

      </div>
    </div>
  );
}
