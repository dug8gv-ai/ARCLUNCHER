'use client';

/**
 * PoolDisplay Component - Live jackpot polling via React Query
 * Independent tracking from core dashboard contexts
 */

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import { getPool, getGlobalStats } from '@/lib/arcslots/arcslots.functions';
import { Loader2, TrendingUp, Wallet } from 'lucide-react';

interface PoolDisplayProps {
  refreshInterval?: number;
}

export function PoolDisplay({ refreshInterval = 5000 }: PoolDisplayProps) {
  const { address: userAddress } = useAccount();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // User-specific pool query
  const { data: userPool, isLoading: userPoolLoading } = useQuery({
    queryKey: ['arcslots:userPool', userAddress],
    queryFn: async () => {
      if (!userAddress) return null;
      return getPool(userAddress);
    },
    enabled: !!userAddress && isClient,
    refetchInterval: refreshInterval,
    staleTime: 0,
  });

  // Global stats query
  const { data: globalStats, isLoading: globalStatsLoading } = useQuery({
    queryKey: ['arcslots:globalStats'],
    queryFn: getGlobalStats,
    enabled: isClient,
    refetchInterval: refreshInterval,
    staleTime: 0,
  });

  if (!isClient) {
    return (
      <div className="p-4 rounded-lg bg-slate-900 border border-slate-700 animate-pulse">
        <div className="h-6 bg-slate-700 rounded w-1/3"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* User Pool Card */}
      {userAddress && (
        <div className="p-6 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-cyan-500/20 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-cyan-400" />
              <h3 className="text-lg font-semibold text-white">Your Pool</h3>
            </div>
            {userPoolLoading && <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />}
          </div>

          {userPool ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-slate-700/50 border border-slate-600">
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">USDC Balance</p>
                <p className="text-2xl font-bold text-white mt-1">{(userPool.balance_usdc || 0).toFixed(2)}</p>
                <p className="text-xs text-slate-500 mt-1">6 decimals</p>
              </div>

              <div className="p-3 rounded-lg bg-slate-700/50 border border-slate-600">
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">ARC Balance</p>
                <p className="text-2xl font-bold text-cyan-300 mt-1">{(userPool.balance_arc || 0).toFixed(2)}</p>
                <p className="text-xs text-slate-500 mt-1">18 decimals</p>
              </div>

              <div className="p-3 rounded-lg bg-slate-700/50 border border-slate-600">
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Total Spins</p>
                <p className="text-2xl font-bold text-white mt-1">{userPool.total_spins || 0}</p>
              </div>

              <div className="p-3 rounded-lg bg-slate-700/50 border border-slate-600">
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Total Won</p>
                <p className="text-2xl font-bold text-green-400 mt-1">{(userPool.total_won || 0).toFixed(2)}</p>
              </div>
            </div>
          ) : (
            <p className="text-slate-400">No pool data available. Make your first spin!</p>
          )}
        </div>
      )}

      {/* Global Stats Card */}
      <div className="p-6 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-purple-500/20 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-purple-400" />
            <h3 className="text-lg font-semibold text-white">Global Stats</h3>
          </div>
          {globalStatsLoading && <Loader2 className="w-4 h-4 animate-spin text-purple-400" />}
        </div>

        {globalStats ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-slate-700/50 border border-slate-600">
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Total Spins</p>
              <p className="text-2xl font-bold text-white mt-1">{globalStats.total_spins || 0}</p>
            </div>

            <div className="p-3 rounded-lg bg-slate-700/50 border border-slate-600">
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Total Won</p>
              <p className="text-2xl font-bold text-green-400 mt-1">{(globalStats.total_won || 0).toFixed(2)}</p>
            </div>

            <div className="p-3 rounded-lg bg-slate-700/50 border border-slate-600 col-span-2">
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Active Players</p>
              <p className="text-2xl font-bold text-white mt-1">{globalStats.active_players || 0}</p>
            </div>
          </div>
        ) : (
          <p className="text-slate-400">Loading global statistics...</p>
        )}

        <p className="text-xs text-slate-500 mt-4">Refreshes every {refreshInterval / 1000}s</p>
      </div>
    </div>
  );
}
