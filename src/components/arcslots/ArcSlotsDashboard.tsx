import React from 'react';
import { SlotMachine } from './SlotMachine';
import { SlotDonate } from './SlotDonate';

export function ArcSlotsDashboard() {
  return (
    <div className="min-h-screen bg-[#0a0a16] text-white p-4 md:p-8 font-sans selection:bg-cyan-500/30">
      
      {/* HEADER LOGO */}
      <div className="flex items-center gap-3 mb-12">
        <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-xl shadow-lg shadow-purple-500/10">
          🎰
        </div>
        <h1 className="text-xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-200" style={{ textShadow: '0 0 20px rgba(250, 204, 21, 0.3)'}}>
          ARCSLOTS
        </h1>
      </div>

      <div className="max-w-4xl mx-auto space-y-16 pb-20">
        
        {/* HERO SECTION */}
        <div className="text-center space-y-6">
          <h2 className="text-5xl md:text-7xl font-black tracking-tight">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-200" style={{ filter: 'drop-shadow(0 0 15px rgba(250,204,21,0.4))' }}>Winner Takes </span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500" style={{ filter: 'drop-shadow(0 0 15px rgba(34,211,238,0.4))' }}>The Pool</span>
          </h2>
          <p className="text-slate-400 text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
            Every 0.1 USDC spin grows the global jackpot on Arc Testnet. Match three crowns 👑 and the entire pool is yours.
          </p>
        </div>

        {/* STATS ROW */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#0f1021] border border-slate-800/80 rounded-2xl p-6 text-center shadow-xl">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold mb-3">Active Spinners</p>
            <p className="text-3xl font-black text-cyan-400 mb-1" style={{ textShadow: '0 0 10px rgba(34,211,238,0.3)' }}>12</p>
            <p className="text-[9px] uppercase tracking-wider text-slate-600 font-bold">Last 10 Min</p>
          </div>
          <div className="bg-[#0f1021] border border-slate-800/80 rounded-2xl p-6 text-center shadow-xl">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold mb-3">Total Wallets</p>
            <p className="text-3xl font-black text-yellow-400 mb-1" style={{ textShadow: '0 0 10px rgba(250,204,21,0.3)' }}>148</p>
            <p className="text-[9px] uppercase tracking-wider text-slate-600 font-bold">All Time</p>
          </div>
          <div className="bg-[#0f1021] border border-slate-800/80 rounded-2xl p-6 text-center shadow-xl">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold mb-3">Global Volume</p>
            <p className="text-3xl font-black text-yellow-400 mb-1" style={{ textShadow: '0 0 10px rgba(250,204,21,0.3)' }}>1,450 USDC</p>
            <p className="text-[9px] uppercase tracking-wider text-slate-600 font-bold">Spins + Donations + Jackpots</p>
          </div>
        </div>

        {/* CURRENT JACKPOT POOL */}
        <div className="relative group">
          <div className="absolute inset-0 bg-yellow-500/20 rounded-[2rem] blur-xl transition-all duration-500 group-hover:bg-yellow-500/30 group-hover:blur-2xl"></div>
          <div className="relative bg-[#0d0e1c] border border-yellow-500/30 rounded-[2rem] p-10 text-center shadow-2xl">
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-400 font-bold mb-4">Current Jackpot Pool</p>
            <div className="flex items-baseline justify-center gap-3">
              <span className="text-6xl md:text-8xl font-black text-yellow-400 tracking-tighter" style={{ textShadow: '0 0 30px rgba(250,204,21,0.4)' }}>
                160.29
              </span>
              <span className="text-2xl md:text-4xl font-bold text-yellow-500/80">USDC</span>
            </div>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mt-6">
              36 Spins • 4 Jackpots Paid
            </p>
          </div>
        </div>

        {/* SLOT MACHINE CORE */}
        <div className="relative pt-8">
          <SlotMachine />
        </div>

        {/* DONATE BOX */}
        <SlotDonate />

        {/* INFO CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12 border-t border-slate-800/50">
          <div className="bg-[#0d0e1c] border border-slate-800 rounded-2xl p-6">
            <h4 className="text-xs uppercase tracking-widest text-cyan-400 font-bold mb-3">Global Pool</h4>
            <p className="text-sm text-slate-400 leading-relaxed">90% of every spin fee accumulates in one shared jackpot.</p>
          </div>
          <div className="bg-[#0d0e1c] border border-slate-800 rounded-2xl p-6">
            <h4 className="text-xs uppercase tracking-widest text-cyan-400 font-bold mb-3">On-Chain Fair</h4>
            <p className="text-sm text-slate-400 leading-relaxed">Reels resolved on Arc Testnet. Every spin is a verifiable transaction.</p>
          </div>
          <div className="bg-[#0d0e1c] border border-slate-800 rounded-2xl p-6">
            <h4 className="text-xs uppercase tracking-widest text-cyan-400 font-bold mb-3">Winner Takes All</h4>
            <p className="text-sm text-slate-400 leading-relaxed">Three crowns trigger a payout of the entire pool to your wallet.</p>
          </div>
        </div>

      </div>
    </div>
  );
}
