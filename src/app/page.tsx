'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { NetworkGuard } from '@/components/NetworkGuard';
import { DashboardStats } from '@/components/DashboardStats';
import { LaunchForm } from '@/components/LaunchForm';
import { TradingPanel } from '@/components/TradingPanel';
import { Leaderboard } from '@/components/Leaderboard';
import { AffiliatesView } from '@/components/AffiliatesView';
import { supabase } from '@/lib/supabase';
import { useAccount, useSendTransaction, usePublicClient } from 'wagmi';
import { Home as HomeIcon, Award, Coins, HelpCircle, Layers, ArrowRight, ShieldCheck, Trophy, Users, Droplet } from 'lucide-react';
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
  const [currentView, setCurrentView] = useState<'dashboard' | 'leaderboard' | 'affiliates'>('dashboard');

  const publicClient = usePublicClient();
  const { sendTransactionAsync } = useSendTransaction();

  // Daily Checkin states
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [checkinStats, setCheckinStats] = useState<{
    checkin_count: number;
    streak_count: number;
    missed_count: number;
    last_checkin: string | null;
  } | null>(null);

  const fetchCheckinStats = async () => {
    if (!isConnected || !userAddress) return;
    try {
      const { data } = await supabase
        .from('profiles')
        .select('checkin_count, streak_count, missed_count, last_checkin')
        .eq('wallet', userAddress.toLowerCase());
      if (data && data.length > 0) {
        setCheckinStats({
          checkin_count: data[0].checkin_count || 0,
          streak_count: data[0].streak_count || 0,
          missed_count: data[0].missed_count || 0,
          last_checkin: data[0].last_checkin || null
        });
      }
    } catch (e) {
      console.error("Error fetching checkin stats:", e);
    }
  };

  useEffect(() => {
    fetchCheckinStats();
  }, [isConnected, userAddress]);

  const handleDailyCheckin = async () => {
    if (!isConnected || !userAddress) {
      alert("Please connect your wallet first!");
      return;
    }
    
    if (checkinStats?.last_checkin) {
      const lastCheckinDate = new Date(checkinStats.last_checkin).toDateString();
      const todayDate = new Date().toDateString();
      if (lastCheckinDate === todayDate) {
        alert("You have already checked-in today! Come back tomorrow.");
        return;
      }
    }

    try {
      setCheckinLoading(true);

      const tx = await sendTransactionAsync({
        to: '0x218b09A7d9FF6D69082Ac605bb27029bC321B5C3', // Admin / Launcher Address
        value: BigInt(0),
      });

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: tx });
      }

      const now = new Date();
      let newStreak = 1;
      let newMissed = checkinStats?.missed_count || 0;

      if (checkinStats?.last_checkin) {
        const lastDate = new Date(checkinStats.last_checkin);
        lastDate.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const diffTime = Math.abs(today.getTime() - lastDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
          newStreak = (checkinStats.streak_count || 0) + 1;
        } else if (diffDays > 1) {
          newStreak = 1;
          newMissed += (diffDays - 1);
        }
      }

      const newCount = (checkinStats?.checkin_count || 0) + 1;

      // Update in Supabase
      const walletLower = userAddress.toLowerCase();
      
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('wallet', walletLower);

      if (existingProfile && existingProfile.length > 0) {
        await supabase
          .from('profiles')
          .update({
            checkin_count: newCount,
            streak_count: newStreak,
            missed_count: newMissed,
            last_checkin: now.toISOString()
          })
          .eq('wallet', walletLower);
      } else {
        await supabase
          .from('profiles')
          .insert({
            wallet: walletLower,
            checkin_count: newCount,
            streak_count: newStreak,
            missed_count: newMissed,
            last_checkin: now.toISOString(),
            name: 'Anonymous',
            avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${walletLower}`
          });
      }

      alert(`Check-in Successful! Streak: ${newStreak} days!`);
      fetchCheckinStats();
    } catch (err: any) {
      console.error("Checkin Transaction failed:", err);
      alert("Check-in Transaction failed: " + (err.shortMessage || err.message));
    } finally {
      setCheckinLoading(false);
    }
  };

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
              onClick={() => {
                setCurrentView('dashboard');
                handleSelectToken(null);
              }}
              className={`w-full flex items-center gap-3.5 px-4.5 py-3 rounded-2xl text-xs font-bold transition-all hover:scale-[1.01] ${
                currentView === 'dashboard'
                  ? 'text-blue-600 bg-blue-50/70 border border-blue-100'
                  : 'text-slate-600 hover:bg-slate-50 border border-transparent hover:text-slate-800'
              }`}
            >
              <HomeIcon size={16} className={currentView === 'dashboard' ? 'text-blue-600' : 'text-slate-400'} />
              Home Dashboard
            </button>

            {/* Dedicated Leaderboard Tab */}
            <button 
              onClick={() => setCurrentView('leaderboard')}
              className={`w-full flex items-center gap-3.5 px-4.5 py-3 rounded-2xl text-xs font-bold transition-all hover:scale-[1.01] ${
                currentView === 'leaderboard'
                  ? 'text-blue-600 bg-blue-50/70 border border-blue-100'
                  : 'text-slate-600 hover:bg-slate-50 border border-transparent hover:text-slate-800'
              }`}
            >
              <Trophy size={16} className={currentView === 'leaderboard' ? 'text-blue-600' : 'text-slate-400'} />
              Leaderboard
            </button>

            {/* Dedicated Affiliates Tab */}
            <button 
              onClick={() => setCurrentView('affiliates')}
              className={`w-full flex items-center gap-3.5 px-4.5 py-3 rounded-2xl text-xs font-bold transition-all hover:scale-[1.01] ${
                currentView === 'affiliates'
                  ? 'text-blue-600 bg-blue-50/70 border border-blue-100'
                  : 'text-slate-600 hover:bg-slate-50 border border-transparent hover:text-slate-800'
              }`}
            >
              <Users size={16} className={currentView === 'affiliates' ? 'text-blue-600' : 'text-slate-400'} />
              Affiliates
            </button>

            {/* USDC Faucet Link */}
            <a 
              href="https://faucet.circle.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center gap-3.5 px-4.5 py-3 rounded-2xl text-xs font-bold transition-all text-slate-600 hover:bg-slate-50 hover:text-slate-800 hover:scale-[1.01]"
            >
              <Droplet size={16} className="text-slate-400" />
              USDC Faucet
            </a>

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
            {currentView === 'dashboard' && (
              <>
                 {/* Elegant Welcome Banner */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200/80 rounded-[32px] p-6 shadow-sm">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                      Hello, {profileName} 👋
                    </h2>
                    <p className="text-xs text-slate-500 font-semibold mt-0.5">Explore active markets, launch customized tokens, and claim points allocations.</p>
                  </div>

                  {/* Daily Check-in Interaction Block */}
                  {isConnected && (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleDailyCheckin}
                        disabled={checkinLoading || !!(checkinStats?.last_checkin && new Date(checkinStats.last_checkin).toDateString() === new Date().toDateString())}
                        className={`px-5 py-3 rounded-2xl text-xs font-black tracking-wide uppercase transition-all duration-150 flex items-center gap-2 shadow-md cursor-pointer ${
                          !!(checkinStats?.last_checkin && new Date(checkinStats.last_checkin).toDateString() === new Date().toDateString())
                            ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-200/30 cursor-not-allowed shadow-none'
                            : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-500/20 active:scale-[0.98]'
                        }`}
                      >
                        {checkinLoading ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>Checking In...</span>
                          </>
                        ) : checkinStats?.last_checkin && new Date(checkinStats.last_checkin).toDateString() === new Date().toDateString() ? (
                          <>
                            <span>✓ Checked In Today</span>
                          </>
                        ) : (
                          <>
                            <span>📅 Daily Check-in</span>
                          </>
                        )}
                      </button>

                      {/* Tiny Streak info display */}
                      {checkinStats && (
                        <div className="text-left font-semibold">
                          <span className="text-[10px] text-slate-400 block uppercase tracking-widest">Check-in Streak</span>
                          <span className="text-xs text-slate-700 font-extrabold flex items-center gap-1">
                            🔥 {checkinStats.streak_count} Days 
                            <span className="text-slate-300 font-normal">|</span> 
                            ⚠️ {checkinStats.missed_count} Missed
                          </span>
                        </div>
                      )}
                    </div>
                  )}
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
              </>
            )}

            {currentView === 'leaderboard' && (
              <div className="bg-white border border-slate-200/80 rounded-[32px] p-6 sm:p-8 shadow-sm">
                <Leaderboard onSelectToken={(token) => {
                  setCurrentView('dashboard');
                  handleSelectToken(token);
                }} />
              </div>
            )}

            {currentView === 'affiliates' && (
              <AffiliatesView />
            )}
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

              <div className="flex items-start gap-3 border-t border-slate-200/40 pt-3">
                <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">4</div>
                <div>
                  <p className="text-slate-800 font-extrabold text-sm mb-0.5">⭐ Partner Affiliate Badge</p>
                  <p className="text-slate-500 text-xs font-medium leading-relaxed">Get the exclusive Partner Affiliate badge by either: (1) Launching a token whose price successfully touches $1.00 USDC, OR (2) Completing 30 consecutive days of Daily Check-ins!</p>
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
