'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { P2PChat } from './P2PChat';
import { PaymentBox } from './PaymentBox';
import { Search, X, User, Loader2, AtSign, MessageCircle } from 'lucide-react';
import { isAddress } from 'viem';
import toast from 'react-hot-toast';

interface ResolvedProfile {
  wallet: string;
  name: string;
  avatar: string;
  twitter?: string;
  discord?: string;
}

export function UserProfileDrawer() {
  const [searchInput, setSearchInput] = useState('');
  const [activeProfile, setActiveProfile] = useState<ResolvedProfile | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const input = searchInput.trim();
    if (!input) return;

    setIsSearching(true);
    setActiveProfile(null);

    try {
      // Case 1: Direct wallet address entered
      if (isAddress(input)) {
        const { data } = await supabase
          .from('profiles')
          .select('wallet, name, avatar, twitter, discord')
          .eq('wallet', input.toLowerCase())
          .single();

        if (data) {
          setActiveProfile({
            wallet: data.wallet,
            name: data.name || input.slice(0, 6) + '...' + input.slice(-4),
            avatar: data.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${input}`,
            twitter: data.twitter,
            discord: data.discord,
          });
        } else {
          // Wallet exists but no profile saved — still allow P2P
          setActiveProfile({
            wallet: input,
            name: input.slice(0, 6) + '...' + input.slice(-4),
            avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${input}`,
          });
        }
        return;
      }

      // Case 2: Username search — try all variants
      const withAt = input.startsWith('@') ? input : `@${input}`;
      const withoutAt = input.startsWith('@') ? input.slice(1) : input;

      // Try exact match with @, without @, and partial match
      const { data } = await supabase
        .from('profiles')
        .select('wallet, name, avatar, twitter, discord')
        .or(`name.ilike.${withAt},name.ilike.${withoutAt},name.ilike.%${withoutAt}%`)
        .limit(1);

      if (!data || data.length === 0) {
        toast.error(`No user found with username "${input}"`);
        return;
      }

      const found = data[0];

      setActiveProfile({
        wallet: found.wallet,
        name: found.name,
        avatar: found.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${found.wallet}`,
        twitter: found.twitter,
        discord: found.discord,
      });
    } catch (err) {
      console.error('Search error:', err);
      toast.error('Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Search className="text-slate-400" size={18} />
          </div>
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search @username or 0x... wallet address"
            className="w-full bg-white border border-slate-200 rounded-2xl py-3.5 pl-12 pr-4 text-slate-800 text-sm font-semibold focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none transition-all placeholder:text-slate-400"
          />
        </div>
        <button
          type="submit"
          disabled={isSearching || !searchInput.trim()}
          className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 rounded-2xl transition-all disabled:opacity-50 flex items-center gap-2"
        >
          {isSearching ? <Loader2 className="animate-spin" size={18} /> : 'Find'}
        </button>
      </form>

      {/* Resolved Profile Card */}
      {activeProfile && (
        <div className="bg-white border border-slate-200/80 rounded-[28px] p-6 md:p-8 shadow-sm animate-in slide-in-from-bottom-4 fade-in duration-300">

          {/* Profile Header */}
          <div className="flex justify-between items-start mb-8">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-blue-100 shadow-md flex-shrink-0">
                <img
                  src={activeProfile.avatar}
                  alt={activeProfile.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/bottts/svg?seed=${activeProfile.wallet}`;
                  }}
                />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">{activeProfile.name}</h3>
                <p className="text-slate-400 font-mono text-xs mt-0.5">
                  {activeProfile.wallet.slice(0, 6)}...{activeProfile.wallet.slice(-4)}
                </p>
                {/* Social links */}
                <div className="flex items-center gap-3 mt-2">
                  {activeProfile.twitter && (
                    <a
                      href={`https://x.com/${activeProfile.twitter.replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] text-blue-500 hover:text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100"
                    >
                      <AtSign size={10} /> {activeProfile.twitter}
                    </a>
                  )}
                  {activeProfile.discord && (
                    <span className="flex items-center gap-1 text-[10px] text-indigo-500 font-bold bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                      <MessageCircle size={10} /> {activeProfile.discord}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={() => setActiveProfile(null)}
              className="p-2 text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Payment + Chat Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: Payment */}
            <div>
              <PaymentBox targetWallet={activeProfile.wallet} />
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200/50 rounded-xl">
                <p className="text-[10px] text-amber-700 leading-relaxed font-semibold">
                  ⚠️ Direct P2P transfers execute natively on Arc Chain. Verify the wallet address before sending.
                </p>
              </div>
            </div>

            {/* Right: Chat */}
            <div>
              <P2PChat targetWallet={activeProfile.wallet} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
