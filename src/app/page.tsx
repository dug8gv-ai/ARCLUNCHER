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
import { Home as HomeIcon, Award, Coins, HelpCircle, Layers, ArrowRight, ShieldCheck, Trophy, Users, Droplet, Info } from 'lucide-react';
import dynamic from 'next/dynamic';

const PriceChart = dynamic(() => import('@/components/PriceChart').then(mod => mod.PriceChart), {
  ssr: false,
});
import { TransactionHistory } from '@/components/TransactionHistory';

export default function Home() {
  const { isConnected, address: userAddress } = useAccount();
  
  // Premium Alert State
  const [premiumAlert, setPremiumAlert] = useState<{
    title: string;
    details: Array<{ label: string; value: string }>;
    type: 'config' | 'info' | 'success' | 'error';
    onClose: () => void;
  } | null>(null);

  const triggerAlert = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info'): Promise<void> => {
    return new Promise((resolve) => {
      setPremiumAlert({
        title,
        details: [{ label: "Notification", value: message }],
        type,
        onClose: () => resolve()
      });
    });
  };
  
  // Navigation & Token States
  const [selectedToken, setSelectedToken] = useState<any>(null);
  const [profileName, setProfileName] = useState<string>('Guest');
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [currentView, setCurrentView] = useState<'dashboard' | 'leaderboard' | 'affiliates'>('dashboard');

  // Daily Locks State
  const [lockerTab, setLockerTab] = useState<'lock' | 'my_locks'>('lock');
  const [isLockerOpen, setIsLockerOpen] = useState(false);
  const [lockAssetType, setLockAssetType] = useState<'USDC' | 'TOKEN'>('USDC');
  const [lockAddress, setLockAddress] = useState('');
  const [lockTicker, setLockTicker] = useState('');
  const [lockAmount, setLockAmount] = useState('');
  const [myLocks, setMyLocks] = useState<any[]>([]);
  const [totalLockedUSD, setTotalLockedUSD] = useState(0); // Real locked value only (no base!)
  const [tokensList, setTokensList] = useState<any[]>([]);

  // Fetch locks
  const fetchLocks = async () => {
    try {
      let locksData: any[] = [];
      try {
        const { data, error } = await supabase
          .from('liquidity_locks')
          .select('*')
          .order('locked_at', { ascending: false });
        if (error) throw error;
        locksData = data || [];
      } catch (dbErr) {
        // Fallback to local storage locks if database schema doesn't exist yet!
        const local = localStorage.getItem('arclauncher_locks');
        locksData = local ? JSON.parse(local) : [];
      }

      setMyLocks(locksData.filter((l: any) => l.wallet.toLowerCase() === userAddress?.toLowerCase()));
      
      // Calculate total locked USD (Real locked values only, no base!)
      const activeLocks = locksData.filter((l: any) => !l.is_withdrawn);
      const totalAmount = activeLocks.reduce((acc: number, l: any) => acc + Number(l.amount), 0);
      setTotalLockedUSD(totalAmount);
    } catch (e) {
      console.error("Error fetching locks:", e);
    }
  };

  const fetchTokensList = async () => {
    try {
      const { data, error } = await supabase
        .from('token_launches')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) {
        setTokensList(data);
      }
    } catch (e) {
      console.error("Error fetching tokens list for locker:", e);
    }
  };

  useEffect(() => {
    fetchLocks();
    fetchTokensList();

    const handleOpenLocker = () => {
      setIsLockerOpen(true);
    };

    window.addEventListener('open-locker', handleOpenLocker);
    return () => {
      window.removeEventListener('open-locker', handleOpenLocker);
    };
  }, [isConnected, userAddress]);

  const handleCreateLock = async () => {
    if (!isConnected || !userAddress) return;
    try {
      const now = new Date();
      const unlockDate = new Date();
      unlockDate.setMonth(unlockDate.getMonth() + 1); // 1 Month locking!

      const newLock = {
        id: 'lock-' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
        wallet: userAddress.toLowerCase(),
        asset_type: lockAssetType,
        token_address: lockAssetType === 'TOKEN' ? lockAddress : null,
        token_ticker: lockAssetType === 'TOKEN' ? (lockTicker || 'TOKEN').toUpperCase() : 'USDC',
        amount: Number(lockAmount),
        locked_at: now.toISOString(),
        unlock_at: unlockDate.toISOString(),
        is_withdrawn: false
      };

      try {
        const { error } = await supabase
          .from('liquidity_locks')
          .insert(newLock);
        if (error) throw error;
      } catch (dbErr) {
        // Fallback save to local storage
        const local = localStorage.getItem('arclauncher_locks');
        const list = local ? JSON.parse(local) : [];
        list.push(newLock);
        localStorage.setItem('arclauncher_locks', JSON.stringify(list));
      }

      await triggerAlert("ASSET LOCKED", `Successfully locked ${lockAmount} ${newLock.token_ticker} for 1 Month (30 Days)!`, "success");
      
      // Reset form
      setLockAmount('');
      setLockAddress('');
      setLockTicker('');
      fetchLocks();
      setLockerTab('my_locks');
    } catch (err: any) {
      await triggerAlert("LOCK ERROR", err.message, "error");
    }
  };

  const handleUnlockAsset = async (lockId: string) => {
    try {
      try {
        const { error } = await supabase
          .from('liquidity_locks')
          .update({ is_withdrawn: true })
          .eq('id', lockId);
        if (error) throw error;
      } catch (dbErr) {
        // Fallback update in local storage
        const local = localStorage.getItem('arclauncher_locks');
        if (local) {
          const list = JSON.parse(local);
          const idx = list.findIndex((l: any) => l.id === lockId);
          if (idx !== -1) {
            list[idx].is_withdrawn = true;
            localStorage.setItem('arclauncher_locks', JSON.stringify(list));
          }
        }
      }

      await triggerAlert("ASSET UNLOCKED", "Your locked asset and liquidity have been successfully unlocked and withdrawn!", "success");
      fetchLocks();
    } catch (err: any) {
      await triggerAlert("UNLOCK ERROR", err.message, "error");
    }
  };

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
      await triggerAlert("CONNECT WALLET", "Please connect your wallet first!", "info");
      return;
    }
    
    if (checkinStats?.last_checkin) {
      const lastCheckinDate = new Date(checkinStats.last_checkin).toDateString();
      const todayDate = new Date().toDateString();
      if (lastCheckinDate === todayDate) {
        await triggerAlert("ALREADY CHECKED-IN", "You have already checked-in today! Come back tomorrow.", "info");
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

      await triggerAlert("CHECK-IN SUCCESSFUL", `Check-in Successful! Streak: ${newStreak} days!`, "success");
      fetchCheckinStats();
    } catch (err: any) {
      console.error("Checkin Transaction failed:", err);
      await triggerAlert("CHECK-IN FAILED", err.shortMessage || err.message, "error");
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
      <aside className="hidden lg:flex w-72 flex-col bg-slate-950 border-r border-slate-900 p-6 space-y-8 sticky top-0 h-screen justify-between shadow-xl z-30">
        <div className="space-y-8">
          {/* Brand header */}
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Layers className="text-white" size={20} />
            </div>
            <div>
              <span className="text-sm font-black tracking-wide text-white block">ARC LAUNCHER</span>
              <span className="text-[9px] block font-extrabold text-slate-500 tracking-widest mt-[-2px] uppercase">BETA</span>
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
                  ? 'text-white bg-blue-600/20 border border-blue-500/30'
                  : 'text-slate-400 hover:bg-slate-900/60 border border-transparent hover:text-slate-200'
              }`}
            >
              <HomeIcon size={16} className={currentView === 'dashboard' ? 'text-blue-400' : 'text-slate-500'} />
              Home Dashboard
            </button>

            {/* Dedicated Leaderboard Tab */}
            <button 
              onClick={() => setCurrentView('leaderboard')}
              className={`w-full flex items-center gap-3.5 px-4.5 py-3 rounded-2xl text-xs font-bold transition-all hover:scale-[1.01] ${
                currentView === 'leaderboard'
                  ? 'text-white bg-blue-600/20 border border-blue-500/30'
                  : 'text-slate-400 hover:bg-slate-900/60 border border-transparent hover:text-slate-200'
              }`}
            >
              <Trophy size={16} className={currentView === 'leaderboard' ? 'text-blue-400' : 'text-slate-500'} />
              Leaderboard
            </button>

            {/* Dedicated Affiliates Tab */}
            <button 
              onClick={() => setCurrentView('affiliates')}
              className={`w-full flex items-center gap-3.5 px-4.5 py-3 rounded-2xl text-xs font-bold transition-all hover:scale-[1.01] ${
                currentView === 'affiliates'
                  ? 'text-white bg-blue-600/20 border border-blue-500/30'
                  : 'text-slate-400 hover:bg-slate-900/60 border border-transparent hover:text-slate-200'
              }`}
            >
              <Users size={16} className={currentView === 'affiliates' ? 'text-blue-400' : 'text-slate-500'} />
              Affiliates
            </button>

            {/* USDC Faucet Link */}
            <a 
              href="https://faucet.circle.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center gap-3.5 px-4.5 py-3 rounded-2xl text-xs font-bold transition-all text-slate-400 hover:bg-slate-900/60 hover:text-slate-200 hover:scale-[1.01]"
            >
              <Droplet size={16} className="text-slate-500" />
              USDC Faucet
            </a>

            {/* Earn coming soon glow badge */}
            <div className="relative group">
              <button 
                disabled
                className="w-full flex items-center justify-between px-4.5 py-3 rounded-2xl text-xs font-bold text-slate-600 cursor-not-allowed transition-all"
              >
                <div className="flex items-center gap-3.5">
                  <Coins size={16} className="text-slate-600" />
                  <span>Earn Points</span>
                </div>
                {/* Glowing Pill badge */}
                <span className="text-[9px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-black uppercase tracking-tighter border border-slate-700">
                  Soon
                </span>
              </button>
            </div>

            {/* Airdrop Rules modal opener */}
            <button 
              onClick={() => setIsRulesOpen(true)}
              className="w-full flex items-center gap-3.5 px-4.5 py-3 rounded-2xl text-xs font-bold text-slate-400 hover:bg-slate-900/60 transition-all hover:text-slate-200"
            >
              <HelpCircle size={16} className="text-slate-500" />
              Airdrop Rules
            </button>
          </nav>
        </div>

        {/* Bottom Sidebar Locked Liquidity card */}
        <div 
          onClick={() => setIsLockerOpen(true)}
          className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 hover:border-slate-700 rounded-3xl p-5 space-y-3.5 shadow-inner cursor-pointer group transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider group-hover:text-blue-400 transition-colors">Liquidity Locked</span>
            <span className="bg-blue-950 text-blue-400 border border-blue-900/50 text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
              Manage 🔒
            </span>
          </div>
          <div>
            <h4 className="text-2xl font-black text-white tracking-tight">
              ${totalLockedUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h4>
            <p className="text-[10px] text-slate-500 mt-1 font-semibold flex items-center gap-1">
              USDC: <span className="text-blue-400 font-black">${totalLockedUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
      {/* Premium Liquidity Locker Modal */}
      {isLockerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-slate-900/40 transition-all duration-200 animate-in fade-in">
          <div className="bg-slate-950/95 border border-slate-800 shadow-2xl rounded-[32px] p-6 max-w-lg w-full space-y-6 transform transition-all scale-100 animate-in zoom-in-95 duration-200 text-slate-100">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-blue-600/10 text-blue-400 shadow-lg shadow-blue-500/10 border border-blue-500/20">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black tracking-wider text-white uppercase">Liquidity Locker</h3>
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Lock and claim USDC & Tokens</p>
                </div>
              </div>
              <button 
                onClick={() => setIsLockerOpen(false)}
                className="text-slate-500 hover:text-slate-200 text-xs font-black cursor-pointer bg-slate-900 hover:bg-slate-800 p-2 rounded-full transition-all"
              >
                ✕
              </button>
            </div>

            {/* Total Locked Display inside Modal */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-5 text-white flex items-center justify-between shadow-lg shadow-blue-500/20">
              <div>
                <p className="text-[8px] font-black uppercase tracking-widest text-blue-100">Total System Locked</p>
                <h4 className="text-3xl font-black mt-1">
                  ${totalLockedUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h4>
              </div>
              <div className="text-right">
                <p className="text-[8px] font-black uppercase tracking-widest text-blue-100">Lock Duration</p>
                <p className="text-xs font-bold mt-1 bg-white/10 px-3 py-1 rounded-full border border-white/20">30 Days (1 Month)</p>
              </div>
            </div>

            {/* Form & List Tabs */}
            <div className="flex gap-2 p-1 bg-slate-900 rounded-2xl">
              <button
                onClick={() => setLockerTab('lock')}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                  lockerTab === 'lock' 
                    ? 'bg-slate-850 text-white shadow-sm border border-slate-700/50' 
                    : 'text-slate-500 hover:text-slate-350'
                }`}
              >
                Create Lock
              </button>
              <button
                onClick={() => setLockerTab('my_locks')}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  lockerTab === 'my_locks' 
                    ? 'bg-slate-850 text-white shadow-sm border border-slate-700/50' 
                    : 'text-slate-500 hover:text-slate-350'
                }`}
              >
                My Active Locks
                {myLocks.length > 0 && (
                  <span className="bg-blue-600 text-white text-[8px] px-1.5 py-0.5 rounded-full font-black animate-pulse">
                    {myLocks.length}
                  </span>
                )}
              </button>
            </div>

            {lockerTab === 'lock' ? (
              /* CREATE LOCK FORM */
              <div className="space-y-4">
                {/* Asset Type Selector */}
                <div className="space-y-1.5">
                  <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Asset to Lock</span>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setLockAssetType('USDC')}
                      className={`py-3 rounded-2xl font-bold text-xs transition-all border cursor-pointer ${
                        lockAssetType === 'USDC' 
                          ? 'border-blue-500 bg-blue-950/40 text-blue-400' 
                          : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:bg-slate-900'
                      }`}
                    >
                      USDC Liquidity
                    </button>
                    <button
                      onClick={() => setLockAssetType('TOKEN')}
                      className={`py-3 rounded-2xl font-bold text-xs transition-all border cursor-pointer ${
                        lockAssetType === 'TOKEN' 
                          ? 'border-blue-500 bg-blue-950/40 text-blue-400' 
                          : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:bg-slate-900'
                      }`}
                    >
                      Meme Token
                    </button>
                  </div>
                </div>

                {/* Dynamic Selection for Launched Tokens (Wallet / platform mimic) */}
                {lockAssetType === 'TOKEN' && (
                  <div className="space-y-1.5">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Select Platform Token to Lock</span>
                    <div className="grid grid-cols-3 gap-2 max-h-[105px] overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl p-2 pr-1">
                      {tokensList.length === 0 ? (
                        <p className="text-[9px] text-slate-500 col-span-3 text-center py-2">No active platform tokens found.</p>
                      ) : (
                        tokensList.map((tok: any) => (
                          <button
                            key={tok.id}
                            onClick={() => {
                              setLockAddress(tok.token_address);
                              setLockTicker(tok.ticker);
                            }}
                            className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                              lockAddress.toLowerCase() === tok.token_address.toLowerCase()
                                ? 'border-blue-500 bg-blue-950/60'
                                : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                            }`}
                          >
                            <span className="text-[9px] font-black text-white truncate block">{tok.ticker}</span>
                            <span className="text-[7px] text-slate-500 font-mono truncate block">{tok.name}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Token details inputs if asset is TOKEN */}
                <div className="space-y-3.5">
                  {lockAssetType === 'TOKEN' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Token Address</span>
                        <input
                          type="text"
                          value={lockAddress}
                          onChange={(e) => setLockAddress(e.target.value)}
                          placeholder="0x..."
                          className="w-full bg-slate-900 border border-slate-800 text-white placeholder-slate-600 rounded-2xl p-3.5 text-xs font-mono outline-none focus:border-blue-500 focus:bg-slate-950"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Token Ticker</span>
                        <input
                          type="text"
                          value={lockTicker}
                          onChange={(e) => setLockTicker(e.target.value)}
                          placeholder="e.g. BTC"
                          className="w-full bg-slate-900 border border-slate-800 text-white placeholder-slate-600 rounded-2xl p-3.5 text-xs font-bold outline-none focus:border-blue-500 focus:bg-slate-950 uppercase"
                        />
                      </div>
                    </div>
                  )}

                  {/* Amount to Lock */}
                  <div className="space-y-1">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">
                      {lockAssetType === 'USDC' ? 'USDC Amount' : 'Token Amount'}
                    </span>
                    <div className="relative">
                      <input
                        type="number"
                        value={lockAmount}
                        onChange={(e) => setLockAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-slate-900 border border-slate-800 text-white placeholder-slate-600 rounded-2xl p-3.5 pr-12 text-xs font-extrabold outline-none focus:border-blue-500 focus:bg-slate-950"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-500">
                        {lockAssetType === 'USDC' ? 'USDC' : lockTicker || 'TOKENS'}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleCreateLock}
                  disabled={!lockAmount || Number(lockAmount) <= 0 || (lockAssetType === 'TOKEN' && !lockAddress)}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-xs tracking-wider uppercase transition-all shadow-lg shadow-blue-500/25 cursor-pointer disabled:opacity-50 active:scale-[0.98]"
                >
                  Confirm Lock for 30 Days 🔒
                </button>
              </div>
            ) : (
              /* MY LOCKS LIST */
              <div className="space-y-3 max-h-[280px] overflow-auto pr-1">
                {myLocks.length === 0 ? (
                  <div className="text-center py-10 text-slate-500 space-y-1">
                    <p className="text-xs font-bold text-slate-400">No active locks found.</p>
                    <p className="text-[10px]">Create a lock first to secure your assets!</p>
                  </div>
                ) : (
                  myLocks.map((lock) => {
                    const lockedDate = new Date(lock.locked_at);
                    const unlockDate = new Date(lock.unlock_at);
                    const now = new Date();
                    const isUnlockable = now >= unlockDate && !lock.is_withdrawn;
                    
                    // Simple remaining time calculation
                    const remainingTime = unlockDate.getTime() - now.getTime();
                    const remainingDays = Math.max(0, Math.ceil(remainingTime / (1000 * 60 * 60 * 24)));

                    return (
                      <div key={lock.id} className="bg-slate-900 border border-slate-800/60 rounded-2xl p-4 flex items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-black text-white">
                              {lock.amount} {lock.asset_type === 'USDC' ? 'USDC' : lock.token_ticker}
                            </span>
                            <span className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase ${
                              lock.is_withdrawn
                                ? 'bg-slate-800 text-slate-500'
                                : isUnlockable
                                ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-900/30'
                                : 'bg-amber-950/80 text-amber-400 border border-amber-900/30'
                            }`}>
                              {lock.is_withdrawn ? 'Withdrawn' : isUnlockable ? 'Unlockable' : `${remainingDays}d Left`}
                            </span>
                          </div>
                          <p className="text-[8px] text-slate-500 font-mono">
                            Locked: {lockedDate.toLocaleDateString()} | Unlocks: {unlockDate.toLocaleDateString()}
                          </p>
                        </div>

                        {!lock.is_withdrawn && (
                          <button
                            onClick={() => handleUnlockAsset(lock.id)}
                            disabled={!isUnlockable}
                            className={`px-3 py-2 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all cursor-pointer ${
                              isUnlockable
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20'
                                : 'bg-slate-800 text-slate-600 cursor-not-allowed border border-slate-700/40'
                            }`}
                          >
                            Unlock 🔓
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Premium Styled Dialog Alert Overlay */}
      {premiumAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-slate-900/20 transition-all duration-200 animate-in fade-in">
          <div className="bg-white/95 border border-slate-200 shadow-2xl rounded-[28px] p-6 max-w-sm w-full space-y-5 transform transition-all scale-100 animate-in zoom-in-95 duration-200">
            {/* Header Icon & Title */}
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg ${
                premiumAlert.type === 'success' 
                  ? 'bg-emerald-500/10 text-emerald-600 shadow-emerald-500/10' 
                  : premiumAlert.type === 'error'
                  ? 'bg-rose-500/10 text-rose-600 shadow-rose-500/10'
                  : 'bg-blue-600/10 text-blue-600 shadow-blue-500/10'
              }`}>
                {premiumAlert.type === 'success' ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                ) : premiumAlert.type === 'error' ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                ) : (
                  <Info className="w-5 h-5" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-xs font-black tracking-wider text-slate-800 uppercase">{premiumAlert.title}</h3>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Arc Launcher Alert</p>
              </div>
            </div>

            {/* Details List */}
            <div className="space-y-3 bg-slate-50 border border-slate-100 rounded-2xl p-4 font-mono text-[10px] text-slate-600">
              {premiumAlert.details.map((item, idx) => (
                <div key={idx} className="flex flex-col gap-0.5">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{item.label}</span>
                  <span className="text-[10px] font-bold text-slate-700 break-all select-all">{item.value}</span>
                </div>
              ))}
            </div>

            {/* Action Button */}
            <button
              onClick={() => {
                premiumAlert.onClose();
                setPremiumAlert(null);
              }}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-xs tracking-wider uppercase transition-all shadow-lg shadow-blue-500/25 cursor-pointer active:scale-[0.98] duration-150 flex items-center justify-center animate-in zoom-in-90"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
