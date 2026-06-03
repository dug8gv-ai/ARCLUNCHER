'use client';

import React, { useState } from 'react';
import { P2PChat } from './P2PChat';
import { PaymentBox } from './PaymentBox';
import { Search, X, User } from 'lucide-react';
import { isAddress } from 'viem';

export function UserProfileDrawer() {
  const [searchInput, setSearchInput] = useState('');
  const [activeProfile, setActiveProfile] = useState<string | null>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const input = searchInput.trim();
    if (isAddress(input)) {
      setActiveProfile(input);
    } else {
      // If using custom usernames, we would do a Supabase lookup here.
      // For this MVP, we enforce standard hex addresses to represent a user profile.
      alert('Please enter a valid Arc Chain wallet address');
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      
      {/* Search Bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Search className="text-slate-500" size={20} />
          </div>
          <input 
            type="text" 
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search username or 0x... wallet address"
            className="w-full bg-[#0d0e1c] border border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-white focus:border-cyan-500 outline-none transition-colors"
          />
        </div>
        <button type="submit" className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-8 rounded-2xl transition-all">
          Find
        </button>
      </form>

      {/* Dynamic Profile Card Drawer */}
      {activeProfile && (
        <div className="bg-[#0a0a16] border border-slate-800 rounded-3xl p-6 md:p-8 animate-in slide-in-from-bottom-4 fade-in duration-300">
          
          <div className="flex justify-between items-start mb-8">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <User size={32} className="text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Web3 Profile</h3>
                <p className="text-slate-400 font-mono text-sm">{activeProfile}</p>
              </div>
            </div>
            <button onClick={() => setActiveProfile(null)} className="p-2 text-slate-500 hover:text-white bg-slate-800/50 hover:bg-slate-800 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left Column: Payment */}
            <div>
              <PaymentBox targetWallet={activeProfile} />
              <div className="mt-6 p-4 bg-yellow-900/10 border border-yellow-500/20 rounded-xl">
                <p className="text-xs text-yellow-500/80 leading-relaxed">
                  Direct P2P transfers are executed natively on the Arc Chain. Ensure you verify the wallet address before sending assets.
                </p>
              </div>
            </div>

            {/* Right Column: Chat */}
            <div>
              <P2PChat targetWallet={activeProfile} />
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
