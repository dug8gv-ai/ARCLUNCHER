'use client';

import React from 'react';
import { AppRegistration } from './AppRegistration';
import { ContractTracker } from './ContractTracker';
import { Leaderboard } from './Leaderboard';
import { Rocket } from 'lucide-react';

export function BuilderDashboard() {
  return (
    <div
      className="min-h-screen p-4 md:p-8 font-sans"
      style={{ background: 'var(--bd-bg-primary)', color: 'var(--text-primary)' }}
    >
      <div className="max-w-7xl mx-auto space-y-8">

        {/* ── Header card ── */}
        <div className="bd-card p-5 flex items-center gap-4">
          <div
            className="w-12 h-12 flex-shrink-0 rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, var(--bd-accent-gold) 0%, #e09f1e 100%)',
              boxShadow: '0 4px 14px rgba(245,197,66,0.35)',
            }}
          >
            <Rocket style={{ color: '#0a0a0f' }} size={24} />
          </div>
          <div className="min-w-0">
            <h1
              className="text-xl sm:text-3xl font-black tracking-tight truncate"
              style={{ color: 'var(--bd-accent-gold)' }}
            >
              ArcOmni Builder Dashboard
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
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
