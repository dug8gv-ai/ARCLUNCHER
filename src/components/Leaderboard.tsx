'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, TrendingUp, Users, Copy, Trash2, Award, ArrowUpRight, DollarSign } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAccount } from 'wagmi';

export function Leaderboard({ onSelectToken }: { onSelectToken?: (token: any) => void }) {
  const { address: userAddress } = useAccount();
  const ADMIN_WALLET = '0x218b09A7d9FF6D69082Ac605bb27029bC321B5C3';
  const isAdmin = userAddress?.toLowerCase() === ADMIN_WALLET.toLowerCase();

  const [activeTab, setActiveTab] = useState<'tokens' | 'earners'>('tokens');
  const [tokens, setTokens] = useState<any[]>([]);
  const [earners, setEarners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch Live Tokens (Markets)
  const fetchTokens = async () => {
    try {
      // 1. Fetch Tokens
      const { data: tokensData, error } = await supabase
        .from('token_launches')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      // 2. Fetch Swaps for all these tokens to calculate metrics
      const tokenAddresses = tokensData?.map(t => t.token_address) || [];
      const { data: allSwaps } = await supabase
        .from('token_swaps')
        .select('token_address, user_address, usdc_amount, token_amount')
        .in('token_address', tokenAddresses);

      const enrichedTokens = (tokensData || []).map(token => {
        const tokenSwaps = allSwaps?.filter(s => s.token_address === token.token_address) || [];
        const holders = new Set(tokenSwaps.map(s => s.user_address)).size;
        
        let priceChange = 0;
        if (tokenSwaps.length >= 2) {
          const initialPrice = Number(tokenSwaps[0].usdc_amount / tokenSwaps[0].token_amount);
          const latestPrice = Number(tokenSwaps[tokenSwaps.length - 1].usdc_amount / tokenSwaps[tokenSwaps.length - 1].token_amount);
          priceChange = ((latestPrice - initialPrice) / (initialPrice || 1)) * 100;
        }

        return {
          ...token,
          holders,
          priceChange: isNaN(priceChange) ? "0.00" : priceChange.toFixed(2)
        };
      });

      setTokens(enrichedTokens);
    } catch (e) {
      console.error("Error fetching tokens:", e);
    }
  };

  // Fetch Top Users (Airdrop Earners)
  const fetchEarners = async () => {
    try {
      // 1. Fetch user stats
      const { data: statsData, error: statsError } = await supabase
        .from('user_stats')
        .select('*')
        .order('points', { ascending: false })
        .limit(25);

      if (statsError) throw statsError;

      if (statsData && statsData.length > 0) {
        // 2. Fetch all profiles to map name/avatar
        const wallets = statsData.map(s => s.wallet.toLowerCase());
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('*')
          .in('wallet', wallets);

        const enrichedEarners = statsData.map(stat => {
          const profile = profilesData?.find(p => p.wallet.toLowerCase() === stat.wallet.toLowerCase());
          return {
            ...stat,
            name: profile?.name || 'Anonymous',
            avatar: profile?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${stat.wallet}`,
            twitter: profile?.twitter || '',
            discord: profile?.discord || '',
            is_affiliate: profile?.is_affiliate || false,
            checkin_count: profile?.checkin_count || 0,
            missed_count: profile?.missed_count || 0
          };
        });

        setEarners(enrichedEarners);
      } else {
        setEarners([]);
      }
    } catch (e) {
      console.error("Error fetching airdrop leaderboard:", e);
    }
  };

  const handleToggleAffiliate = async (wallet: string, currentStatus: boolean) => {
    try {
      const walletLower = wallet.toLowerCase();
      const newStatus = !currentStatus;

      // Check if profile exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('wallet', walletLower);

      if (existingProfile && existingProfile.length > 0) {
        const { error } = await supabase
          .from('profiles')
          .update({ is_affiliate: newStatus })
          .eq('wallet', walletLower);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('profiles')
          .insert({
            wallet: walletLower,
            is_affiliate: newStatus,
            name: 'Anonymous',
            avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${walletLower}`
          });
        if (error) throw error;
      }

      alert(`Affiliate badge status updated successfully!`);
      fetchEarners();
    } catch (err: any) {
      console.error("Error toggling affiliate status:", err);
      alert("Error toggling affiliate status: " + err.message);
    }
  };

  // Main initial loader & Realtime Subscriptions
  useEffect(() => {
    setLoading(true);
    
    const loadAllData = async () => {
      await Promise.all([fetchTokens(), fetchEarners()]);
      setLoading(false);
    };

    loadAllData();

    // Listeners for realtime sync
    const tokenChannel = supabase.channel('leaderboard_launches')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'token_launches' }, fetchTokens)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'token_swaps' }, async () => {
        await Promise.all([fetchTokens(), fetchEarners()]);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, fetchEarners)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_stats' }, fetchEarners)
      .subscribe();

    return () => {
      supabase.removeChannel(tokenChannel);
    };
  }, []);

  const handleDelete = async (e: React.MouseEvent, tokenId: string) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this token permanently?')) return;

    const { error } = await supabase
      .from('token_launches')
      .delete()
      .eq('id', tokenId);

    if (error) {
      alert('Error deleting token: ' + error.message);
    } else {
      alert('Token deleted successfully!');
      setTokens(prev => prev.filter(t => t.id !== tokenId));
    }
  };

  return (
    <div className="glass-panel p-6 h-full flex flex-col bg-white border border-slate-200/80">
      {/* Leaderboard Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h2 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
          <Trophy className="text-amber-500" size={22} />
          Leaderboard
        </h2>
        
        {/* Toggle Switch Tabs */}
        <div className="flex bg-slate-100/80 rounded-xl p-1 self-start sm:self-auto border border-slate-200/30">
          <button 
            onClick={() => setActiveTab('tokens')}
            className={`px-4.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'tokens' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Live Markets
          </button>
          <button 
            onClick={() => setActiveTab('earners')}
            className={`px-4.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'earners' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Award size={13} />
            Top Earners
          </button>
        </div>
      </div>

      {/* Main List Scroller Container */}
      <div className="flex-1 overflow-auto pr-1">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
            <span className="animate-spin text-blue-600 text-lg">⏳</span>
            <p className="text-xs font-semibold">Syncing real-time database...</p>
          </div>
        ) : activeTab === 'tokens' ? (
          /* LIVE TOKENS (MARKETS) LIST */
          <div className="space-y-3">
            {tokens.length === 0 ? (
              <p className="text-center text-slate-400 py-12 text-xs font-medium">No tokens launched yet.</p>
            ) : (
              tokens.map((token, i) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.05, 0.4) }}
                  key={token.id} 
                  onClick={() => onSelectToken?.(token)}
                  className="bg-slate-50 hover:bg-slate-100/50 border border-slate-200/60 rounded-2xl p-4 hover:border-blue-300 transition-all cursor-pointer group flex items-center justify-between"
                >
                  <div className="flex gap-4.5 items-center">
                    {/* Token Logo */}
                    <div className="w-12 h-12 rounded-2xl overflow-hidden bg-white border border-slate-200 shadow-inner flex-shrink-0 flex items-center justify-center">
                      {token.image_url ? (
                        <img src={token.image_url} alt={token.name} className="w-full h-full object-cover" />
                      ) : (
                        <TrendingUp className="text-slate-400" size={20} />
                      )}
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-800 group-hover:text-blue-600 transition-colors text-sm flex items-center gap-1.5">
                        {token.name}
                        <span className="text-[10px] bg-slate-200/80 text-slate-600 px-1.5 py-0.5 rounded font-black uppercase">
                          {token.ticker}
                        </span>
                      </h3>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <p className="text-[10px] text-slate-400 font-mono">
                          {token.token_address.slice(0, 6)}...{token.token_address.slice(-4)}
                        </p>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(token.token_address);
                            alert('Address copied!');
                          }}
                          className="p-1 hover:bg-slate-200 rounded transition-colors text-slate-400 hover:text-blue-600 cursor-pointer"
                        >
                          <Copy size={10} />
                        </button>

                        {/* Owner delete check */}
                        {userAddress?.toLowerCase() === token.creator_address?.toLowerCase() && (
                          <button 
                            onClick={(e) => handleDelete(e, token.id)}
                            className="p-1 hover:bg-red-50 rounded transition-colors text-slate-400 hover:text-red-500 cursor-pointer"
                            title="Delete Token"
                          >
                            <Trash2 size={10} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Right hand stats */}
                  <div className="text-right">
                    <div className="flex items-center gap-1.5 justify-end mb-0.5">
                      <Users size={13} className="text-blue-500" />
                      <span className="text-xs font-bold text-slate-700">
                        {token.holders} Holders
                      </span>
                    </div>
                    <div className={`text-xs font-extrabold flex items-center justify-end gap-0.5 ${Number(token.priceChange) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {Number(token.priceChange) >= 0 ? '+' : ''}{token.priceChange}%
                      <ArrowUpRight size={10} className={Number(token.priceChange) >= 0 ? 'rotate-0' : 'rotate-90'} />
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        ) : (
          /* AIRDROP EARNERS LEADERBOARD LIST */
          <div className="space-y-3">
            {earners.length === 0 ? (
              <p className="text-center text-slate-400 py-12 text-xs font-medium">No stats tracked yet. Complete a trade to earn points!</p>
            ) : (
              earners.map((earner, i) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.05, 0.4) }}
                  key={earner.wallet}
                  className={`border rounded-2xl p-4 flex items-center justify-between ${
                    userAddress?.toLowerCase() === earner.wallet.toLowerCase()
                      ? 'bg-blue-50/50 border-blue-200/80'
                      : 'bg-slate-50 hover:bg-slate-100/50 border-slate-200/60'
                  }`}
                >
                  <div className="flex gap-4 items-center">
                    {/* Rank Badge */}
                    <div className="w-6 text-slate-400 font-extrabold text-xs text-center font-mono">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                    </div>

                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-white flex-shrink-0">
                      <img src={earner.avatar} alt="" className="w-full h-full object-cover" />
                    </div>

                    <div>
                      {/* Name */}
                      <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                        {earner.name}
                        {earner.is_affiliate && (
                          <span className="text-[9px] bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-2 py-0.5 rounded-full font-black uppercase tracking-wider flex items-center gap-1 shadow-sm">
                            ⭐ Affiliate
                          </span>
                        )}
                        {userAddress?.toLowerCase() === earner.wallet.toLowerCase() && (
                          <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-black uppercase">
                            You
                          </span>
                        )}
                      </h3>
                      
                      {/* Subtitles (Social Handles & Truncated Wallet) */}
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400 font-medium">
                        <span className="font-mono">
                          {earner.wallet.slice(0, 6)}...{earner.wallet.slice(-4)}
                        </span>
                        {earner.twitter && (
                          <span className="text-[#1DA1F2] font-semibold">{earner.twitter}</span>
                        )}
                      </div>

                      {/* Daily Check-in Stats Display */}
                      <div className="flex items-center gap-2 mt-1.5 text-[9px] font-bold text-slate-500 bg-slate-100/60 border border-slate-200/20 px-2.5 py-1 rounded-xl w-fit">
                        <span>📅 Check-ins: <span className="text-blue-600 font-black">{earner.checkin_count || 0}d</span></span>
                        <span className="text-slate-300 font-normal">|</span>
                        <span>⚠️ Missed: <span className="text-slate-400 font-extrabold">{earner.missed_count || 0}d</span></span>
                      </div>
                    </div>
                  </div>

                  {/* Volume & Points / Admin actions */}
                  <div className="flex items-center gap-4">
                    {/* Admin Actions */}
                    {isAdmin && (
                      <button
                        onClick={() => handleToggleAffiliate(earner.wallet, !!earner.is_affiliate)}
                        className={`px-3 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-wider transition-all cursor-pointer ${
                          earner.is_affiliate 
                            ? 'bg-rose-500/10 text-rose-600 hover:bg-rose-500/20' 
                            : 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20'
                        }`}
                      >
                        {earner.is_affiliate ? 'Revoke Affiliate' : 'Grant Affiliate'}
                      </button>
                    )}

                    <div className="text-right">
                      <div className="flex items-center gap-1 justify-end text-[10px] text-slate-500 font-bold mb-0.5">
                        <DollarSign size={11} className="text-slate-400" />
                        <span>{Number(earner.total_volume || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} Vol</span>
                      </div>
                      <div className="bg-blue-100/80 text-blue-700 font-black text-xs px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm border border-blue-200/20">
                        <Award size={12} className="text-blue-600" />
                        <span>{Number(earner.points || 0).toFixed(2)} pts</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
