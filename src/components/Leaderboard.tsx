'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, TrendingUp, Users, Copy, Trash2, Award, ArrowUpRight, DollarSign, Info } from 'lucide-react';
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

  // Premium Alert State
  const [premiumAlert, setPremiumAlert] = useState<{
    title: string;
    details: Array<{ label: string; value: string }>;
    type: 'config' | 'info' | 'success' | 'error';
    onClose: () => void;
  } | null>(null);

  // Premium Confirm State
  const [premiumConfirm, setPremiumConfirm] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
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

  const triggerConfirm = (title: string, message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setPremiumConfirm({
        title,
        message,
        onConfirm: () => {
          setPremiumConfirm(null);
          resolve(true);
        },
        onCancel: () => {
          setPremiumConfirm(null);
          resolve(false);
        }
      });
    });
  };

  // Fetch Live Tokens (Markets)
  const fetchTokens = async () => {
    try {
      // 1. Fetch Tokens (Defensive check for is_pinned column existence)
      let tokensData: any[] | null = null;
      let error: any = null;

      try {
        const res = await supabase
          .from('token_launches')
          .select('*')
          .order('is_pinned', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(20);
        
        if (res.error) throw res.error;
        tokensData = res.data;
      } catch (fallbackErr: any) {
        // Fallback to default sorting if is_pinned column doesn't exist in user's Supabase yet
        const res = await supabase
          .from('token_launches')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20);
        tokensData = res.data;
        error = res.error;
      }

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

      await triggerAlert("AFFILIATE UPDATED", "Affiliate badge status updated successfully!", "success");
      fetchEarners();
    } catch (err: any) {
      console.error("Error toggling affiliate status:", err);
      await triggerAlert("AFFILIATE ERROR", err.message, "error");
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

  const handleTogglePin = async (e: React.MouseEvent, tokenId: string, currentPinned: boolean) => {
    e.stopPropagation();
    try {
      const { error } = await supabase
        .from('token_launches')
        .update({ is_pinned: !currentPinned })
        .eq('id', tokenId);
      if (error) throw error;
      await triggerAlert("PIN UPDATED", "Token pin status updated successfully!", "success");
      fetchTokens();
    } catch (err: any) {
      console.error("Error toggling pin:", err);
      await triggerAlert("PIN ERROR", err.message, "error");
    }
  };

  const handleCycleBadge = async (e: React.MouseEvent, tokenId: string, currentBadge: string | null) => {
    e.stopPropagation();
    try {
      let nextBadge: string | null = null;
      if (!currentBadge) {
        nextBadge = 'official';
      } else if (currentBadge === 'official') {
        nextBadge = 'partner';
      } else {
        nextBadge = null;
      }

      const { error } = await supabase
        .from('token_launches')
        .update({ badge_type: nextBadge })
        .eq('id', tokenId);
      if (error) throw error;
      await triggerAlert("BADGE UPDATED", `Token badge successfully set to: ${nextBadge || 'None'}`, "success");
      fetchTokens();
    } catch (err: any) {
      console.error("Error setting badge:", err);
      await triggerAlert("BADGE ERROR", err.message, "error");
    }
  };

  const handleDelete = async (e: React.MouseEvent, tokenId: string, tokenAddress: string) => {
    e.stopPropagation();
    if (!isAdmin) {
      await triggerAlert("UNAUTHORIZED", "Only the Admin is authorized to delete tokens!", "error");
      return;
    }
    const confirmed = await triggerConfirm("CONFIRM DELETE", "Are you sure you want to permanently delete this token and all its swap history? This action is irreversible.");
    if (!confirmed) return;

    try {
      // 1. Delete dependent swaps first (Defensive casing wipes)
      const { error: swapError } = await supabase
        .from('token_swaps')
        .delete()
        .in('token_address', [tokenAddress, tokenAddress.toLowerCase(), tokenAddress.toUpperCase()]);
      if (swapError) throw swapError;

      // 2. Delete the token launch record!
      const { error: launchError } = await supabase
        .from('token_launches')
        .delete()
        .eq('id', tokenId);
      if (launchError) throw launchError;

      await triggerAlert("TOKEN DELETED", "Token and all its swap history have been permanently deleted!", "success");
      setTokens(prev => prev.filter(t => t.id !== tokenId));
    } catch (error: any) {
      await triggerAlert("DELETION ERROR", error.message, "error");
    }
  };

  return (
    <div className="stat-box p-6 h-full flex flex-col">
      {/* Leaderboard Header Section - Cyan Gradient */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 -mx-6 -mt-6 px-6 py-4 rounded-t-[20px]" style={{ background: 'linear-gradient(90deg, rgba(0, 242, 254, 0.2) 0%, rgba(0, 242, 254, 0.05) 50%, transparent 100%)' }}>
        <h2 className="text-lg font-extrabold text-[var(--accent-cyan)] flex items-center gap-2" style={{ textShadow: '0 0 10px rgba(0,242,254,0.4)' }}>
          <Trophy className="text-[var(--accent-cyan)]" size={22} />
          Leaderboard
        </h2>
        
        {/* Toggle Switch Tabs */}
        <div className="flex bg-[rgba(6,8,20,0.6)] rounded-xl p-1 self-start sm:self-auto border border-[var(--border-dim)]">
          <button 
            onClick={() => setActiveTab('tokens')}
            className={`px-4.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'tokens' ? 'bg-[rgba(0,242,254,0.1)] text-[var(--accent-cyan)] shadow-sm border border-[var(--border-dim)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Live Markets
          </button>
          <button 
            onClick={() => setActiveTab('earners')}
            className={`px-4.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'earners' ? 'bg-[rgba(0,242,254,0.1)] text-[var(--accent-cyan)] shadow-sm border border-[var(--border-dim)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
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
          <div className="flex flex-col items-center justify-center py-20 text-[var(--text-secondary)] gap-2">
            <span className="animate-spin text-[var(--accent-cyan)] text-lg">⏳</span>
            <p className="text-xs font-semibold">Syncing real-time database...</p>
          </div>
        ) : activeTab === 'tokens' ? (
          /* LIVE TOKENS (MARKETS) LIST */
          <div className="space-y-3">
            {tokens.length === 0 ? (
              <p className="text-center text-[var(--text-secondary)] py-12 text-xs font-medium">No tokens launched yet.</p>
            ) : (
              tokens.map((token, i) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.05, 0.4) }}
                  key={token.id} 
                  onClick={() => onSelectToken?.(token)}
                  className="bg-[rgba(6,8,20,0.5)] hover:bg-[rgba(13,17,39,0.8)] border border-[var(--border-dim)] rounded-2xl p-4 hover:border-[var(--border-glow)] transition-all cursor-pointer group flex items-center justify-between"
                >
                  <div className="flex gap-4.5 items-center">
                    {/* Token Logo */}
                    <div className="w-12 h-12 rounded-2xl overflow-hidden card shadow-inner flex-shrink-0 flex items-center justify-center">
                      {token.image_url ? (
                        <img src={token.image_url} alt={token.name} className="w-full h-full object-contain p-0.5" />
                      ) : (
                        <TrendingUp className="text-[var(--text-secondary)]" size={20} />
                      )}
                    </div>
                    <div>
                      <h3 className="font-extrabold text-[var(--text-primary)] group-hover:text-[var(--accent-cyan)] transition-colors text-sm flex items-center gap-1.5 flex-wrap">
                        {token.is_pinned && (
                          <span className="text-[8px] bg-amber-500 text-white px-1.5 py-0.5 rounded font-black flex items-center gap-0.5 border border-amber-600/20">
                            📌 Pinned
                          </span>
                        )}
                        {token.name}
                        <span className="text-[10px] bg-[rgba(0,242,254,0.1)] text-[var(--accent-cyan)] px-1.5 py-0.5 rounded font-black uppercase border border-[var(--border-dim)]">
                          {token.ticker}
                        </span>
                        {token.badge_type === 'official' && (
                          <span className="text-[8px] btn-primary text-white px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider flex items-center gap-0.5 shadow-sm border border-blue-400/20">
                            👑 Official
                          </span>
                        )}
                        {token.badge_type === 'partner' && (
                          <span className="text-[8px] bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider flex items-center gap-0.5 shadow-sm border border-emerald-400/20">
                            🤝 Partner
                          </span>
                        )}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <p className="text-[10px] text-[var(--text-secondary)] font-mono">
                          {token.token_address.slice(0, 6)}...{token.token_address.slice(-4)}
                        </p>
                        <button 
                          onClick={async (e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(token.token_address);
                            await triggerAlert("ADDRESS COPIED", "The token contract address has been copied to your clipboard successfully.", "success");
                          }}
                          className="p-1 hover:bg-slate-200 rounded transition-colors text-[var(--text-secondary)] hover:text-[var(--accent-cyan)] cursor-pointer"
                        >
                          <Copy size={10} />
                        </button>

                        {/* Admin Action Buttons */}
                        {isAdmin && (
                          <div className="flex items-center gap-1 bg-[rgba(6,8,20,0.5)] border border-[var(--border-dim)] p-0.5 rounded-lg ml-2">
                            {/* Pin Toggle */}
                            <button
                              onClick={(e) => handleTogglePin(e, token.id, !!token.is_pinned)}
                              className={`p-0.5 rounded cursor-pointer transition-colors ${
                                token.is_pinned 
                                  ? 'bg-amber-100 text-amber-600' 
                                  : 'text-[var(--text-secondary)] hover:text-amber-500 hover:bg-slate-200'
                              }`}
                              title={token.is_pinned ? "Unpin Token" : "Pin to Top"}
                            >
                              <span className="text-[9px]">📌</span>
                            </button>

                            {/* Badge Cycle */}
                            <button
                              onClick={(e) => handleCycleBadge(e, token.id, token.badge_type)}
                              className={`p-0.5 rounded cursor-pointer transition-colors ${
                                token.badge_type 
                                  ? 'bg-[rgba(0,242,254,0.1)] text-[var(--accent-cyan)]' 
                                  : 'text-[var(--text-secondary)] hover:text-[var(--accent-cyan)] hover:bg-slate-200'
                              }`}
                              title={`Set Badge: ${token.badge_type || 'None'} (Click to cycle)`}
                            >
                              <span className="text-[9px]">👑</span>
                            </button>

                            {/* Delete Trash */}
                            <button 
                              onClick={(e) => handleDelete(e, token.id, token.token_address)}
                              className="p-0.5 hover:bg-red-50 rounded transition-colors text-[var(--text-secondary)] hover:text-red-500 cursor-pointer"
                              title="Delete Token permanently"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Right hand stats */}
                  <div className="text-right">
                    <div className="flex items-center gap-1.5 justify-end mb-0.5">
                      <Users size={13} className="text-[var(--accent-cyan)]" />
                      <span className="text-xs font-bold text-[var(--text-primary)]">
                        {token.holders} Holders
                      </span>
                    </div>
                    <div
                      className="text-xs font-extrabold flex items-center justify-end gap-0.5"
                      style={{
                        color: Number(token.priceChange) >= 0 ? '#00e676' : '#ff1744',
                        textShadow: Number(token.priceChange) >= 0
                          ? '0 0 8px rgba(0,230,118,0.6)'
                          : '0 0 8px rgba(255,23,68,0.6)',
                      }}
                    >
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
              <p className="text-center text-[var(--text-secondary)] py-12 text-xs font-medium">No stats tracked yet. Complete a trade to earn points!</p>
            ) : (
              earners.map((earner, i) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.05, 0.4) }}
                  key={earner.wallet}
                  className={`border rounded-2xl p-4 flex items-center justify-between ${
                    userAddress?.toLowerCase() === earner.wallet.toLowerCase()
                      ? 'bg-[rgba(0,242,254,0.08)] border-[var(--border-glow)]'
                      : 'bg-[rgba(6,8,20,0.5)] hover:bg-[rgba(13,17,39,0.8)] border-[var(--border-dim)]'
                  }`}
                >
                  <div className="flex gap-4 items-center">
                    {/* Rank Badge */}
                    <div className="w-6 text-[var(--text-secondary)] font-extrabold text-xs text-center font-mono">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                    </div>

                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-xl overflow-hidden border border-[var(--border-dim)] shadow-sm bg-[var(--bg-card)] flex-shrink-0">
                      <img src={earner.avatar} alt="" className="w-full h-full object-contain p-0.5" />
                    </div>

                    <div>
                      {/* Name */}
                      <h3 className="font-extrabold text-[var(--text-primary)] text-sm flex items-center gap-2">
                        {earner.name}
                        {earner.is_affiliate && (
                          <span className="text-[9px] btn-primary text-white px-2 py-0.5 rounded-full font-black uppercase tracking-wider flex items-center gap-1 shadow-sm">
                            ⭐ Affiliate
                          </span>
                        )}
                        {userAddress?.toLowerCase() === earner.wallet.toLowerCase() && (
                          <span className="text-[9px] bg-[rgba(0,242,254,0.1)] text-[var(--accent-cyan)] px-1.5 py-0.5 rounded-full font-black uppercase">
                            You
                          </span>
                        )}
                      </h3>
                      
                      {/* Subtitles (Social Handles & Truncated Wallet) */}
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-[var(--text-secondary)] font-medium">
                        <span className="font-mono">
                          {earner.wallet.slice(0, 6)}...{earner.wallet.slice(-4)}
                        </span>
                        {earner.twitter && (
                          <span className="text-[#1DA1F2] font-semibold">{earner.twitter}</span>
                        )}
                      </div>

                      {/* Daily Check-in Stats Display */}
                      <div className="flex items-center gap-2 mt-1.5 text-[9px] font-bold text-[var(--text-secondary)] bg-[rgba(6,8,20,0.5)] border border-[var(--border-dim)] px-2.5 py-1 rounded-xl w-fit">
                        <span>📅 Check-ins: <span className="text-[var(--accent-cyan)] font-black">{earner.checkin_count || 0}d</span></span>
                        <span className="text-slate-300 font-normal">|</span>
                        <span>⚠️ Missed: <span className="text-[var(--text-secondary)] font-extrabold">{earner.missed_count || 0}d</span></span>
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
                      <div className="flex items-center gap-1 justify-end text-[10px] text-[var(--text-secondary)] font-bold mb-0.5">
                        <DollarSign size={11} className="text-[var(--text-secondary)]" />
                        <span>{Number(earner.total_volume || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} Vol</span>
                      </div>
                      <div className="bg-[rgba(0,242,254,0.1)]/80 text-[var(--accent-cyan)] font-black text-xs px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm border border-[var(--border-dim)]">
                        <Award size={12} className="text-[var(--accent-cyan)]" />
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

      {/* Premium Styled Dialog Alert Overlay */}
      {premiumAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-slate-900/20 transition-all duration-200 animate-in fade-in">
          <div className="bg-[var(--bg-card)]/95 border border-[var(--border-dim)] shadow-2xl rounded-[28px] p-6 max-w-sm w-full space-y-5 transform transition-all scale-100 animate-in zoom-in-95 duration-200">
            {/* Header Icon & Title */}
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg ${
                premiumAlert.type === 'success' 
                  ? 'bg-emerald-500/10 text-emerald-600 shadow-emerald-500/10' 
                  : premiumAlert.type === 'error'
                  ? 'bg-rose-500/10 text-rose-600 shadow-rose-500/10'
                  : 'bg-blue-600/10 text-[var(--accent-cyan)] shadow-blue-500/10'
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
                <h3 className="text-xs font-black tracking-wider text-[var(--text-primary)] uppercase">{premiumAlert.title}</h3>
                <p className="text-[9px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">ArcOmni Alert</p>
              </div>
            </div>

            {/* Details List */}
            <div className="space-y-3 bg-[rgba(6,8,20,0.5)] border border-[var(--border-dim)] rounded-2xl p-4 font-mono text-[10px] text-[var(--text-secondary)]">
              {premiumAlert.details.map((item, idx) => (
                <div key={idx} className="flex flex-col gap-0.5">
                  <span className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest">{item.label}</span>
                  <span className="text-[10px] font-bold text-[var(--text-primary)] break-all select-all">{item.value}</span>
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

      {/* Premium Styled Dialog Confirm Overlay */}
      {premiumConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-slate-900/20 transition-all duration-200 animate-in fade-in">
          <div className="bg-[var(--bg-card)]/95 border border-[var(--border-dim)] shadow-2xl rounded-[28px] p-6 max-w-sm w-full space-y-5 transform transition-all scale-100 animate-in zoom-in-95 duration-200">
            {/* Header Icon & Title */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg bg-blue-600/10 text-[var(--accent-cyan)] shadow-blue-500/10">
                <Info className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-xs font-black tracking-wider text-[var(--text-primary)] uppercase">{premiumConfirm.title}</h3>
                <p className="text-[9px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">Confirm Action</p>
              </div>
            </div>

            {/* Message Body */}
            <p className="text-xs text-[var(--text-secondary)] font-medium leading-relaxed bg-[rgba(6,8,20,0.5)] border border-[var(--border-dim)] rounded-2xl p-4">
              {premiumConfirm.message}
            </p>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={premiumConfirm.onCancel}
                className="flex-1 py-3 border border-[var(--border-dim)] hover:bg-slate-50 text-[var(--text-secondary)] rounded-2xl font-bold text-xs tracking-wider uppercase transition-all cursor-pointer active:scale-[0.98] duration-150 flex items-center justify-center"
              >
                Cancel
              </button>
              <button
                onClick={premiumConfirm.onConfirm}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-xs tracking-wider uppercase transition-all shadow-lg shadow-blue-500/25 cursor-pointer active:scale-[0.98] duration-150 flex items-center justify-center"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
