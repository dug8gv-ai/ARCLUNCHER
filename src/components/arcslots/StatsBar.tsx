'use client';

/**
 * StatsBar Component - Real-time Supabase channel listeners
 * Dedicated arcslots_stats_live channel for volume & metrics
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ARCSLOTS_TABLES } from '@/lib/arcslots/arcslots.constants';
import { BarChart3, Zap, Users } from 'lucide-react';

interface LiveStats {
  total_volume: number;
  active_spins: number;
  last_big_win: number;
  updated_at: string;
}

interface StatsBarProps {
  className?: string;
}

export function StatsBar({ className = '' }: StatsBarProps) {
  const [stats, setStats] = useState<LiveStats | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Subscribe to real-time updates on arcslots_stats_live
    const channel = supabase
      .channel(ARCSLOTS_TABLES.STATS_LIVE)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: ARCSLOTS_TABLES.STATS_LIVE,
        },
        (payload) => {
          if (payload.new) {
            setStats(payload.new as LiveStats);
            setIsConnected(true);
          }
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') {
          // Fetch initial stats on subscribe
          fetchInitialStats();
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchInitialStats = async () => {
    try {
      const { data, error } = await supabase
        .from(ARCSLOTS_TABLES.STATS_LIVE)
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (!error && data) {
        setStats(data as LiveStats);
      }
    } catch (err) {
      console.error('Failed to fetch initial stats:', err);
    }
  };

  const getUpdateAge = () => {
    if (!stats?.updated_at) return 'N/A';
    const updateTime = new Date(stats.updated_at).getTime();
    const now = new Date().getTime();
    const secondsAgo = Math.floor((now - updateTime) / 1000);

    if (secondsAgo < 60) return `${secondsAgo}s ago`;
    if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)}m ago`;
    return 'Over an hour ago';
  };

  return (
    <div className={`rounded-xl bg-gradient-to-r from-slate-800 via-slate-900 to-black border border-cyan-500/20 shadow-xl overflow-hidden ${className}`}>
      {/* Connection Status Bar */}
      <div className="h-1 bg-gradient-to-r from-cyan-500 to-blue-500" style={{ opacity: isConnected ? 1 : 0.3 }} />

      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-cyan-400" />
            <h3 className="text-lg font-semibold text-white">Live Network Stats</h3>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`} />
            <span className="text-xs text-[var(--text-secondary)]">{isConnected ? 'Connected' : 'Connecting...'}</span>
          </div>
        </div>

        {stats ? (
          <div className="grid grid-cols-3 gap-4">
            {/* Volume Stat */}
            <div className="p-4 rounded-lg bg-slate-700/50 border border-[var(--border-dim)] hover:border-cyan-500/50 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-yellow-400" />
                <p className="text-xs text-[var(--text-secondary)] uppercase font-semibold tracking-wider">Volume</p>
              </div>
              <p className="text-2xl font-bold text-white">
                {(stats.total_volume / 1000).toFixed(1)}K
              </p>
              <p className="text-xs text-[var(--text-secondary)] mt-1">USDC</p>
            </div>

            {/* Active Spins */}
            <div className="p-4 rounded-lg bg-slate-700/50 border border-[var(--border-dim)] hover:border-purple-500/50 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-purple-400" />
                <p className="text-xs text-[var(--text-secondary)] uppercase font-semibold tracking-wider">Active</p>
              </div>
              <p className="text-2xl font-bold text-white">
                {stats.active_spins || 0}
              </p>
              <p className="text-xs text-[var(--text-secondary)] mt-1">Concurrent Spins</p>
            </div>

            {/* Big Win Stat */}
            <div className="p-4 rounded-lg bg-slate-700/50 border border-[var(--border-dim)] hover:border-green-500/50 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🏆</span>
                <p className="text-xs text-[var(--text-secondary)] uppercase font-semibold tracking-wider">Big Win</p>
              </div>
              <p className="text-2xl font-bold text-green-400">
                {(stats.last_big_win || 0).toFixed(0)}
              </p>
              <p className="text-xs text-[var(--text-secondary)] mt-1">ARC</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-20">
            <p className="text-[var(--text-secondary)] text-sm">Loading live stats...</p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-4 pt-4 border-t border-[var(--border-dim)] flex items-center justify-between">
          <p className="text-xs text-[var(--text-secondary)]">Last update: {getUpdateAge()}</p>
          {isConnected && (
            <p className="text-xs text-cyan-400 font-semibold">Real-time Enabled</p>
          )}
        </div>
      </div>
    </div>
  );
}
