'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { NetworkGuard } from '@/components/NetworkGuard';
import { DashboardStats } from '@/components/DashboardStats';
import { LaunchForm } from '@/components/LaunchForm';
import { TradingPanel } from '@/components/TradingPanel';
import { Leaderboard } from '@/components/Leaderboard';
import { supabase } from '@/lib/supabase';
import { useAccount } from 'wagmi';
import { Home as HomeIcon, Award, Coins, HelpCircle, Layers, ArrowRight, ShieldCheck } from 'lucide-react';
import dynamic from 'next/dynamic';

const PriceChart = dynamic(() => import('@/components/PriceChart').then(mod => mod.PriceChart), {
  ssr: false,
});
import { TransactionHistory } from '@/components/TransactionHistory';

export default function Home() {
  const { isConnected, address: userAddress } = useAccount();
  
  // Navigation & Token States
  const [selectedToken, setSelectedToken] = useState<any>(null);
  const [profileName, setProfileName] = useState<string>('Guest');
  const [isRulesOpen, setIsRulesOpen] = useState(false);

  // 1. Fetch Profile Name for Custom Header Greeting
  useEffect(() => {
    if (isConnected && userAddress) {
      const getProfile = async () => {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('name')
            .eq('wallet', userAddress.toLowerCase())
            .single();
          if (data && !error) {
            setProfileName(data.name || 'Trader');
          } else {
            setProfileName('Trader');
          }
        } catch (e) {
          setProfileName('Trader');
        }
      };
      getProfile();

      // Realtime listener for username updates
      const channel = supabase.channel(`page_profile_${userAddress}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `wallet=eq.${userAddress.toLowerCase()}`
        }, (payload: any) => {
          setProfileName(payload.new.name || 'Trader');
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      setProfileName('Guest');
    }
  }, [isConnected, userAddress]);

  // 2. URL State / Chart Persistence Fix
  useEffect(() => {
    const loadTokenFromUrl = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const tokenAddress = searchParams.get('token');
      if (tokenAddress) {
        try {
          const { data, error } = await supabase
            .from('token_launches')
            .select('*')
            .eq('token_address', tokenAddress.toLowerCase())
            .single();
          
          if (data && !error) {
            setSelectedToken(data);
          }
        } catch (e) {
          console.error("Error fetching token by URL:", e);
        }
      }
    };
    loadTokenFromUrl();
  }, []);

  // Update token selections and URL state
  const handleSelectToken = (token: any) => {
    setSelectedToken(token);
    if (token) {
      const newUrl = `${window.location.origin}/dashboard?token=${token.token_address.toLowerCase()}`;
      window.history.pushState({ path: newUrl }, '', newUrl);
    } else {
      const newUrl = `${window.location.origin}/dashboard`;
      window.history.pushState({ path: newUrl }, '', newUrl);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#f4f7fc] text-slate-800 antialiased selection:bg-blue-100">
      
      {/* 1. Desktop Sidebar Navigation (Radius inspired layout) */}
      <aside className="hidden lg:flex w-72 flex-col bg-white border-r border-slate-200/80 p-6 space-y-8 sticky top-0 h-screen justify-between shadow-sm z-30">
        <div className="space-y-8">
          {/* Brand header */}
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Layers className="text-white" size={20} />
            </div>
            <div>
              <span className="text-sm font-black tracking-wide text-slate-900 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent block">ARC LAUNCHER</span>
              <span className="text-[9px] block font-extrabold text-slate-400 tracking-widest mt-[-2px] uppercase">BETA</span>
            </div>
          </div>

          {/* Nav links */}
          <nav className="space-y-1">
            <button 
              onClick={() => handleSelectToken(null)}
              className="w-full flex items-center gap-3.5 px-4.5 py-3 rounded-2xl text-xs font-bold transition-all text-blue-600 bg-blue-50/70 border border-blue-100 hover:scale-[1.01]"
            >
              <HomeIcon size={16} />
              Home Dashboard
            </button>

            {/* Earn coming soon glow badge */}
            <div className="relative group">
              <button 
                disabled
                className="w-full flex items-center justify-between px-4.5 py-3 rounded-2xl text-xs font-bold text-slate-400 cursor-not-allowed hover:bg-slate-50 transition-all"
              >
                <div className="flex items-center gap-3.5">
                  <Coins size={16} className="text-slate-300" />
                  <span>Earn Points</span>
                </div>
                {/* Glowing Pill badge */}
                <span className="text-[9px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-black animate-pulse shadow-sm border border-blue-200/20 uppercase tracking-tighter">
                  Soon
                </span>
              </button>
            </div>

            {/* Airdrop Rules modal opener */}
            <button 
              onClick={() => setIsRulesOpen(true)}
              className="w-full flex items-center gap-3.5 px-4.5 py-3 rounded-2xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all hover:text-slate-800"
            >
              <HelpCircle size={16} className="text-slate-400" />
              Airdrop Rules
            </button>
          </nav>
        </div>

        {/* Bottom Sidebar Locked Liquidity card */}
        <div className="bg-gradient-to-br from-slate-50 to-blue-50/30 border border-slate-100 rounded-3xl p-5 space-y-3.5 shadow-inner">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">Liquidity Locked</span>
            <span className="bg-emerald-100 text-emerald-700 text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-tighter">
              Live
            </span>
          </div>
          <div>
            <h4 className="text-2xl font-black text-slate-900 tracking-tight">$3,001.07</h4>
            <p className="text-[10px] text-slate-400 mt-1 font-semibold flex items-center gap-1">
              USDC: <span className="text-slate-700 font-extrabold">2,368.77</span> | EURC: <span className="text-slate-700 font-extrabold">632.30</span>
            </p>
          </div>
        </div>
      </aside>

      {/* 2. Main content viewport area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 w-full space-y-6">
          <Header />
          <NetworkGuard />
          
          <main className="space-y-8">
            {/* Elegant Welcome Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                  Hello, {profileName} 👋
                </h2>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">Explore active markets, launch customized tokens, and claim points allocations.</p>
              </div>
            </div>

            {/* Global Dashboard Stats */}
            <DashboardStats /> 

            {/* Main Interactive Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column - Token Launch or Trading Panel */}
              <div className="lg:col-span-1 space-y-8">
                {selectedToken ? (
                  <div className="space-y-4">
                    <TradingPanel token={selectedToken} />
                    <button 
                      onClick={() => handleSelectToken(null)}
                      className="w-full py-3 border-2 border-dashed border-slate-200 text-slate-500 font-bold rounded-2xl text-xs hover:text-slate-800 hover:border-slate-400 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      ← Launch New Token instead
                    </button>
                  </div>
                ) : (
                  <LaunchForm />
                )}
              </div>

              {/* Right Column - Trading & Analytics */}
              <div className="lg:col-span-2 space-y-8">
                <PriceChart selectedToken={selectedToken} />
                <TransactionHistory tokenAddress={selectedToken?.token_address} />
                <div className="h-[500px]">
                  <Leaderboard onSelectToken={handleSelectToken} />
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* Airdrop Rules Modal Overlay (Premium design) */}
      {isRulesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md glass-modal p-8 space-y-6 relative border border-white">
            <button
              onClick={() => setIsRulesOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
            >
              ✕
            </button>

            <div className="text-center space-y-1.5">
              <Award className="text-blue-600 mx-auto" size={32} />
              <h2 className="text-xl font-black text-slate-900">Airdrop points mechanics</h2>
              <p className="text-xs text-slate-500">Every swap you execute generates points allocations instantly.</p>
            </div>

            <div className="space-y-4 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200/50 p-5 rounded-2xl">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">1</div>
                <div>
                  <p className="text-slate-800 font-extrabold text-sm mb-0.5">High-Frequency Swaps</p>
                  <p className="text-slate-500 text-xs font-medium leading-relaxed">Each trade on active tokens counts toward volume. Whether you buy or sell, you accumulate trading weight.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 border-t border-slate-200/40 pt-3">
                <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">2</div>
                <div>
                  <p className="text-slate-800 font-extrabold text-sm mb-0.5">10 USDC = 1 ARCL Point</p>
                  <p className="text-slate-500 text-xs font-medium leading-relaxed">Points are computed in real-time on database insertion: total USD volume traded divided by 10. These accumulate forever.</p>
                </div>
              </div>

              <div className="flex items-start gap-3 border-t border-slate-200/40 pt-3">
                <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">3</div>
                <div>
                  <p className="text-slate-800 font-extrabold text-sm mb-0.5">Claim Rewards Later</p>
                  <p className="text-slate-500 text-xs font-medium leading-relaxed">Points determine your share of the upcoming ARCL Airdrop pool. The higher you rank on the earners list, the larger your payout!</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsRulesOpen(false)}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all flex items-center justify-center gap-1.5"
            >
              Start Trading Now <ArrowRight size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
