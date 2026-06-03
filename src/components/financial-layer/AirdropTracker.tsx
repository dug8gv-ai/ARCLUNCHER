'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { supabase } from '@/lib/supabase';
import { Award, Loader2, Coins, TrendingUp } from 'lucide-react';

interface AirdropTrackerProps {
  onTokenPreFilled?: (address: string) => void;
}

export default function AirdropTracker({ onTokenPreFilled }: AirdropTrackerProps) {
  const { isConnected, address: userAddress } = useAccount();

  // Point Tracker States
  const [points, setPoints] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);

  const fetchPoints = async () => {
    if (!userAddress) return;
    setIsLoading(true);
    try {
      const walletLower = userAddress.toLowerCase();
      const { data, error } = await supabase
        .from('user_stats')
        .select('points, total_volume')
        .eq('wallet', walletLower)
        .single();

      if (data && !error) {
        setPoints(Number(data.points) || 0);
        setVolume(Number(data.total_volume) || 0);
      } else {
        setPoints(0);
        setVolume(0);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected && userAddress) {
      fetchPoints();

      // Setup real-time listener for points updates
      const channel = supabase.channel(`stats_airdrop_${userAddress.toLowerCase()}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'user_stats',
          filter: `wallet=eq.${userAddress.toLowerCase()}`
        }, (payload: any) => {
          if (payload.new) {
            setPoints(Number(payload.new.points) || 0);
            setVolume(Number(payload.new.total_volume) || 0);
          }
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      setPoints(0);
      setVolume(0);
    }
  }, [isConnected, userAddress]);

  // URL Chart Persistence Listener
  useEffect(() => {
    const handleUrlParsing = () => {
      const params = new URLSearchParams(window.location.search);
      const tokenAddr = params.get('token');
      if (tokenAddr && onTokenPreFilled) {
        onTokenPreFilled(tokenAddr.toLowerCase());
      }
    };

    // Run once on load
    handleUrlParsing();

    // Listen to custom history push event triggers
    const handlePopState = () => {
      handleUrlParsing();
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [onTokenPreFilled]);

  return (
    <div className="flex items-center gap-4 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 border border-[var(--border-dim)] rounded-2xl px-4 py-2.5 shadow-sm">
      <div className="w-8 h-8 rounded-lg bg-[rgba(0,242,254,0.05)]0/10 flex items-center justify-center text-[var(--accent-cyan)]">
        <Award size={16} className="animate-pulse" />
      </div>
      <div>
        <span className="text-[9px] uppercase font-extrabold tracking-widest text-[var(--text-secondary)] block">ARCL Airdrop Allocation</span>
        <div className="flex items-center gap-2">
          {isLoading ? (
            <Loader2 size={12} className="animate-spin text-[var(--accent-cyan)]" />
          ) : (
            <span className="text-xs font-black text-[var(--text-primary)] tracking-tight">
              {points.toFixed(2)} <strong className="text-[var(--accent-cyan)] font-extrabold">ARCL</strong>
            </span>
          )}
          <span className="text-[9px] text-slate-350">|</span>
          <span className="text-[9px] text-[var(--text-secondary)] font-bold">
            Volume: ${volume.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC
          </span>
        </div>
      </div>
    </div>
  );
}
