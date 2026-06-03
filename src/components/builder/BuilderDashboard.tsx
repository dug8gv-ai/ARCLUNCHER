'use client';

import React from 'react';
import { AppRegistration } from './AppRegistration';
import { ContractTracker } from './ContractTracker';
import { Leaderboard } from './Leaderboard';
import { Rocket } from 'lucide-react';

export function BuilderDashboard() {
  return (
    <div className="min-h-screen bg-[#06070a] text-slate-200 p-4 md:p-8 font-sans selection:bg-cyan-500/30">
      <div className="max-w-6xl mx-auto space-y-10">
        
        {/* Header */}
        <div className="border-b border-slate-800 pb-6 mb-8 flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Rocket className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight">ArcOmni Builder Dashboard</h1>
            <p className="text-sm text-slate-400">Deploy, Track, and Scale on Arc Chain</p>
          </div>
        </div>

        {/* Top Layout: Registration & Tracker */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <section className="space-y-4">
            <AppRegistration />
          </section>
          
          <section className="space-y-4">
            <ContractTracker />
          </section>
        </div>

        {/* Bottom Layout: Leaderboard */}
        <div className="pt-8">
          <Leaderboard />
        </div>

      </div>
    </div>
  );
}
