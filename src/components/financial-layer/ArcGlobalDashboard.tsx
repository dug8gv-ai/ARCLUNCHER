'use client';

import { useState, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useDisconnect } from 'wagmi';
import { 
  Wallet, Send, Trophy, Coins, HelpCircle, ChevronDown, 
  Settings, LogOut, Layers, Rocket, TrendingUp, HelpCircle as HelpIcon, ArrowRight, CreditCard
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';

// Import Financial Layer Components
import ArcWallet from './ArcWallet';
import SocialPay from './SocialPay';
import AirdropTracker from './AirdropTracker';
import CircleHub from './CircleHub';
import ArcBridge from './ArcBridge';
import ArcYield from './ArcYield';

// Dynamic Load for PriceChart to avoid SSR issues
import dynamic from 'next/dynamic';
const PriceChart = dynamic(() => import('@/components/PriceChart').then(mod => mod.PriceChart), {
  ssr: false,
});
import { TradingPanel } from '@/components/TradingPanel';
import { Leaderboard } from '@/components/Leaderboard';

export default function ArcGlobalDashboard() {
  const { isConnected, address: userAddress } = useAccount();
  const { disconnect } = useDisconnect();

  // Dashboard routing states
  const [currentTab, setCurrentTab] = useState<'wallet' | 'social-pay' | 'leaderboard' | 'bridge' | 'staking' | 'trade' | 'circle-hub'>('wallet');
  const [selectedToken, setSelectedToken] = useState<any>(null);
  const [bridgeInitialToken, setBridgeInitialToken] = useState<'USDC' | 'EURC'>('USDC');

  // Profile Dropdown States
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [myProfile, setMyProfile] = useState<{ name: string; avatar: string } | null>(null);

  const fetchProfile = async () => {
    if (!userAddress) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('name, avatar')
        .eq('wallet', userAddress.toLowerCase())
        .single();
      if (data && !error) {
        setMyProfile({
          name: data.name || 'Anonymous',
          avatar: data.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${userAddress.toLowerCase()}`
        });
      } else {
        setMyProfile({
          name: 'Anonymous',
          avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${userAddress.toLowerCase()}`
        });
      }
    } catch (e) {
      setMyProfile({
        name: 'Anonymous',
        avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${userAddress.toLowerCase()}`
      });
    }
  };

  useEffect(() => {
    if (isConnected && userAddress) {
      fetchProfile();

      // Listen for profile changes
      const channel = supabase.channel(`dashboard_global_profile_${userAddress.toLowerCase()}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `wallet=eq.${userAddress.toLowerCase()}`
        }, () => {
          fetchProfile();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      setMyProfile(null);
    }
  }, [isConnected, userAddress]);

  // Handle Leaderboard selection
  const handleSelectToken = (token: any) => {
    setSelectedToken(token);
    if (token) {
      const newUrl = `${window.location.origin}/dashboard?token=${token.token_address.toLowerCase()}`;
      window.history.pushState({ path: newUrl }, '', newUrl);
      setCurrentTab('trade');
    } else {
      const newUrl = `${window.location.origin}/dashboard`;
      window.history.pushState({ path: newUrl }, '', newUrl);
    }
  };

  // Pre-fill URL parsing
  const handlePreFillToken = (address: string) => {
    const fetchTokenAndSelect = async () => {
      try {
        const { data } = await supabase
          .from('token_launches')
          .select('*')
          .eq('token_address', address.toLowerCase())
          .single();
        if (data) {
          setSelectedToken(data);
          setCurrentTab('trade');
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchTokenAndSelect();
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const payTo = params.get('payTo');
    const token = params.get('token');
    
    if (payTo) {
      setCurrentTab('social-pay');
    } else if (token) {
      handlePreFillToken(token);
    }
  }, []);

  return (
    <div className="min-h-screen flex bg-[#f4f7fc] text-[var(--text-primary)] antialiased selection:bg-[rgba(0,242,254,0.1)]">
      
      {/* SIDEBAR NAVIGATION - LUXURY BLUE & WHITE BRANDED */}
      <aside className="hidden lg:flex w-72 flex-col bg-[var(--bg-card)] border-r border-[var(--border-dim)] p-6 space-y-8 sticky top-0 h-screen justify-between shadow-[0_8px_30px_rgb(0,0,0,0.02)] z-30">
        <div className="space-y-8">
          {/* Brand header */}
          <div className="flex items-center gap-3 px-2">
            <motion.div
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ type: 'spring', stiffness: 300 }}
              className="w-10 h-10 rounded-xl overflow-hidden shadow-sm shadow-blue-500/10"
            >
              <img src="/main-logo.jpg" alt="ArcOmni" className="w-full h-full object-contain p-0.5" />
            </motion.div>
            <div>
              <span className="text-sm font-black tracking-wide text-[var(--text-primary)] block">ARC GLOBAL</span>
              <span className="text-[9px] block font-extrabold text-[var(--accent-cyan)] tracking-widest mt-[-2px] uppercase">FINANCIAL</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            {/* Arc Wallet Tab */}
            <button
              onClick={() => setCurrentTab('wallet')}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-xs font-bold transition-all hover:scale-[1.01] ${
                currentTab === 'wallet'
                  ? 'text-[var(--accent-cyan)] bg-[rgba(0,242,254,0.05)] border border-[var(--border-dim)] shadow-sm shadow-blue-500/5'
                  : 'text-[var(--text-secondary)] hover:bg-slate-50 border border-transparent hover:text-[var(--text-primary)]'
              }`}
            >
              <Wallet size={16} className={currentTab === 'wallet' ? 'text-[var(--accent-cyan)]' : 'text-[var(--text-secondary)]'} />
              Arc Wallet
            </button>

            {/* Social Pay Tab */}
            <button
              onClick={() => setCurrentTab('social-pay')}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-xs font-bold transition-all hover:scale-[1.01] ${
                currentTab === 'social-pay'
                  ? 'text-[var(--accent-cyan)] bg-[rgba(0,242,254,0.05)] border border-[var(--border-dim)] shadow-sm shadow-blue-500/5'
                  : 'text-[var(--text-secondary)] hover:bg-slate-50 border border-transparent hover:text-[var(--text-primary)]'
              }`}
            >
              <Send size={16} className={currentTab === 'social-pay' ? 'text-[var(--accent-cyan)]' : 'text-[var(--text-secondary)]'} />
              Social Pay
            </button>

            {/* Leaderboard Tab */}
            <button
              onClick={() => setCurrentTab('leaderboard')}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-xs font-bold transition-all hover:scale-[1.01] ${
                currentTab === 'leaderboard'
                  ? 'text-[var(--accent-cyan)] bg-[rgba(0,242,254,0.05)] border border-[var(--border-dim)] shadow-sm shadow-blue-500/5'
                  : 'text-[var(--text-secondary)] hover:bg-slate-50 border border-transparent hover:text-[var(--text-primary)]'
              }`}
            >
              <Trophy size={16} className={currentTab === 'leaderboard' ? 'text-[var(--accent-cyan)]' : 'text-[var(--text-secondary)]'} />
              Leaderboard
            </button>

            {/* Circle Bridge Tab */}
            <button
              onClick={() => setCurrentTab('bridge')}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-xs font-bold transition-all hover:scale-[1.01] ${
                currentTab === 'bridge'
                  ? 'text-[var(--accent-cyan)] bg-[rgba(0,242,254,0.05)] border border-[var(--border-dim)] shadow-sm shadow-blue-500/5'
                  : 'text-[var(--text-secondary)] hover:bg-slate-50 border border-transparent hover:text-[var(--text-primary)]'
              }`}
            >
              <Coins size={16} className={currentTab === 'bridge' ? 'text-[var(--accent-cyan)]' : 'text-[var(--text-secondary)]'} />
              Circle CCTP Bridge
            </button>

            {/* Circle Developer Hub Tab */}
            <button
              onClick={() => setCurrentTab('circle-hub')}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold transition-all hover:scale-[1.01] ${
                currentTab === 'circle-hub'
                  ? 'text-[var(--accent-cyan)] bg-[rgba(0,242,254,0.05)] border border-[var(--border-dim)] shadow-sm shadow-blue-500/5'
                  : 'text-[var(--text-secondary)] hover:bg-slate-50 border border-transparent hover:text-[var(--text-primary)]'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <CreditCard size={16} className={currentTab === 'circle-hub' ? 'text-[var(--accent-cyan)]' : 'text-[var(--text-secondary)]'} />
                <span>Circle Hub</span>
              </div>
              <span className="text-[9px] bg-[rgba(0,242,254,0.05)]0 text-white px-2 py-0.5 rounded-full font-black uppercase tracking-widest border border-blue-600 animate-pulse">
                New
              </span>
            </button>

            {/* Staking Tab */}
            <button
              onClick={() => setCurrentTab('staking')}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold transition-all hover:scale-[1.01] ${
                currentTab === 'staking'
                  ? 'text-[var(--accent-cyan)] bg-[rgba(0,242,254,0.05)] border border-[var(--border-dim)] shadow-sm'
                  : 'text-[var(--text-secondary)] hover:bg-slate-50 border border-transparent hover:text-[var(--text-primary)]'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <TrendingUp size={16} className={currentTab === 'staking' ? 'text-[var(--accent-cyan)]' : 'text-[var(--text-secondary)]'} />
                <span>Staking & Yield</span>
              </div>
            </button>
          </nav>
        </div>

        {/* Bottom Staking & Yield Card */}
        <button
          type="button"
          onClick={() => setCurrentTab('staking')}
          className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-[var(--border-dim)] hover:border-[var(--border-dim)] rounded-3xl p-5 space-y-3.5 shadow-sm cursor-pointer text-left transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[var(--text-secondary)] font-extrabold uppercase tracking-wider">Staking & Yield</span>
            <span className="bg-[rgba(0,242,254,0.1)] text-[var(--accent-cyan)] border border-[var(--border-dim)] text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
              Live
            </span>
          </div>
          <div>
            <h4 className="text-lg font-black text-[var(--text-primary)] tracking-tight">
              Open the live vaults
            </h4>
            <p className="text-[10px] text-[var(--text-secondary)] font-semibold mt-2 leading-relaxed">
              Review APY, balances, and wallet-signed staking actions for USDC, EURC, and cirBTC.
            </p>
          </div>
        </button>
      </aside>

      {/* VIEWPORT CONTROLLER */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 w-full space-y-6">
          
          {/* HEADER LAYER WITH AIRDROP WIDGET */}
          <motion.header
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="glass-panel px-6 py-4 mb-4 flex flex-col md:flex-row items-center justify-between gap-4 sticky top-4 z-40 bg-[var(--bg-card)]/90 backdrop-blur-md"
          >
            <div className="flex items-center gap-3">
              <motion.div
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: 'spring', stiffness: 300 }}
                className="w-10 h-10 rounded-xl overflow-hidden shadow-sm shadow-blue-500/10"
              >
                <img src="/main-logo.jpg" alt="ArcOmni" className="w-full h-full object-contain p-0.5" />
              </motion.div>
              <div>
                <h1 className="text-xl font-black tracking-tight text-[var(--text-primary)] flex items-center gap-2">
                  ARC GLOBAL <span className="text-xs bg-[rgba(0,242,254,0.05)]0/10 text-[var(--accent-cyan)] px-2 py-0.5 rounded-full font-bold">PRO</span>
                </h1>
                <p className="text-xs text-[var(--text-secondary)] hidden md:block font-semibold">Decentralized Multi-Asset Financial Hub</p>
              </div>
            </div>

            <div className="flex items-center gap-3 justify-end w-full md:w-auto">
              {/* Point Tracker Widget */}
              <AirdropTracker onTokenPreFilled={handlePreFillToken} />

              {/* Profile setup details */}
              {isConnected && myProfile && (
                <div className="relative">
                  <button
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="flex items-center gap-2 bg-[rgba(6,10,38,0.9)] border border-[var(--border-dim)] hover:bg-[rgba(8,14,44,0.8)] text-[var(--text-primary)] px-3.5 py-1.5 rounded-full shadow-sm text-xs font-semibold cursor-pointer"
                  >
                    <div className="w-6 h-6 rounded-full overflow-hidden border border-[var(--border-dim)] bg-[var(--bg-card)]">
                      <img src={myProfile.avatar} alt="" className="w-full h-full object-contain p-0.5" />
                    </div>
                    <span className="max-w-[80px] truncate text-[var(--text-primary)]">@{myProfile.name}</span>
                    <ChevronDown size={14} className="text-[var(--text-secondary)]" />
                  </button>

                  {isDropdownOpen && (
                    <div className="absolute right-0 mt-2.5 w-44 card rounded-2xl shadow-xl py-2 z-50 text-xs font-medium text-[var(--text-primary)] animate-in fade-in slide-in-from-top-1">
                      <button
                        onClick={() => {
                          setIsDropdownOpen(false);
                          setCurrentTab('social-pay');
                        }}
                        className="w-full px-4 py-2 hover:bg-slate-50 flex items-center gap-2 text-left cursor-pointer transition-colors"
                      >
                        <Settings size={13} className="text-[var(--text-secondary)]" />
                        Profile Settings
                      </button>
                      <button
                        onClick={() => {
                          setIsDropdownOpen(false);
                          disconnect();
                        }}
                        className="w-full px-4 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2 text-left cursor-pointer transition-colors border-t border-[var(--border-dim)]"
                      >
                        <LogOut size={13} />
                        Disconnect
                      </button>
                    </div>
                  )}
                </div>
              )}

              <ConnectButton />
            </div>
          </motion.header>

          {/* MAIN RENDER ENGINE */}
          <motion.main
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="space-y-8"
          >
            
            {/* ARC WALLET TAB */}
            {currentTab === 'wallet' && (
              <ArcWallet 
                onSwitchToBridge={(token) => {
                  setBridgeInitialToken(token);
                  setCurrentTab('bridge');
                }} 
              />
            )}

            {/* SOCIAL PAY TAB */}
            {currentTab === 'social-pay' && <SocialPay />}

            {/* LEADERBOARD VIEW */}
            {currentTab === 'leaderboard' && (
              <div className="card rounded-[32px] p-6 sm:p-8 shadow-sm animate-in fade-in duration-200">
                <div className="mb-4">
                  <h3 className="text-lg font-black text-[var(--text-primary)]">ARC MEME LEADERBOARD</h3>
                  <p className="text-xs text-[var(--text-secondary)] font-semibold mt-0.5">Click any active launch to open its charts and trade desks.</p>
                </div>
                <Leaderboard onSelectToken={handleSelectToken} />
              </div>
            )}

            {/* CIRCLE CCTP BRIDGE */}
            {currentTab === 'bridge' && <ArcBridge />}

            {/* CIRCLE HUB TAB */}
            {currentTab === 'circle-hub' && <CircleHub />}

            {/* STAKING TAB */}
            {currentTab === 'staking' && <ArcYield />}

            {/* TRADING VIEW (ACTIVATED BY LEADERBOARD OR URL TOKEN) */}
            {currentTab === 'trade' && selectedToken && (
              <div className="space-y-8 animate-in fade-in duration-200">
                <div className="flex items-center justify-between card rounded-[28px] p-5 shadow-sm">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-xl overflow-hidden bg-[rgba(6,10,38,0.9)] border border-[var(--border-dim)] flex items-center justify-center">
                      {selectedToken.image_url ? (
                        <img src={selectedToken.image_url} alt="" className="w-full h-full object-contain p-0.5" />
                      ) : (
                        <TrendingUp className="text-[var(--text-secondary)]" size={18} />
                      )}
                    </div>
                    <div>
                      <h3 className="font-extrabold text-[var(--text-primary)] text-base flex items-center gap-1.5">
                        {selectedToken.name}
                        <span className="text-xs bg-slate-100 text-[var(--text-secondary)] px-2 py-0.5 rounded font-black uppercase">{selectedToken.ticker}</span>
                      </h3>
                      <p className="text-[10px] text-[var(--text-secondary)] font-mono mt-0.5">{selectedToken.token_address}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedToken(null);
                      setCurrentTab('leaderboard');
                    }}
                    className="text-xs bg-slate-50 hover:bg-slate-100 border border-[var(--border-dim)] text-[var(--text-secondary)] font-extrabold px-4 py-2 rounded-2xl transition-all cursor-pointer shadow-sm"
                  >
                    ← View Other Markets
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-1">
                    <TradingPanel token={selectedToken} />
                  </div>
                  <div className="lg:col-span-2 space-y-8">
                    <PriceChart selectedToken={selectedToken} />
                  </div>
                </div>
              </div>
            )}

          </motion.main>

        </div>
      </div>

    </div>
  );
}
