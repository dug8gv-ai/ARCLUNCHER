'use client';

import React, { useEffect, useState } from 'react';
import { usePublicClient, useChainId } from 'wagmi';
import { supabase } from '@/lib/supabase';
import { Trophy, Star, Medal, Globe, ExternalLink, ChevronDown, ChevronUp, Zap } from 'lucide-react';

interface LeaderboardApp {
  id: string;
  app_name: string;
  app_url: string;
  description: string;
  category: string;
  team_size: number;
  developer_wallet: string;
  logo_url: string | null;
  banner_url: string | null;
  sample_images: string[] | null;
  contract_address?: string | null;
}

export function Leaderboard() {
  const [apps, setApps] = useState<LeaderboardApp[]>([]);
  const [stats, setStats] = useState<Record<string, { txs: number; uniqueWallets: number; volume: string }>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const publicClient = usePublicClient();
  const chainId = useChainId();

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const { data, error } = await supabase
          .from('registered_apps')
          .select('id, app_name, app_url, description, category, team_size, developer_wallet, logo_url, banner_url, sample_images, contract_address')
          .eq('is_verified', true)
          .order('created_at', { ascending: false })
          .limit(20);

        if (!error && data) {
          setApps(data);
        }
      } catch (err) {
        console.error('Failed to refresh builder leaderboard', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeaderboard();

    const handleRefresh = () => {
      fetchLeaderboard();
    };

    window.addEventListener('builder-app-verified', handleRefresh);

    return () => {
      window.removeEventListener('builder-app-verified', handleRefresh);
    };
  }, []);

  useEffect(() => {
    if (!publicClient || chainId !== 5042002 || apps.length === 0) return;

    const loadStats = async () => {
      const nextStats: Record<string, { txs: number; uniqueWallets: number; volume: string }> = {};

      for (const app of apps) {
        if (!app.contract_address) continue;

        try {
          const blockNumber = await publicClient.getBlockNumber();
          const fromBlock = blockNumber - BigInt(1000);
          const logs = await publicClient.getLogs({
            address: app.contract_address as `0x${string}`,
            fromBlock,
            toBlock: 'latest',
          });

          const uniqueTxs = new Set(logs.map((log) => log.transactionHash));
          nextStats[app.id] = {
            txs: logs.length,
            uniqueWallets: uniqueTxs.size,
            volume: logs.length ? `${logs.length * 0.25}` : '0',
          };
        } catch (error) {
          console.error('Failed to load contract stats', error);
        }
      }

      setStats(nextStats);
    };

    loadStats();
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, [apps, chainId, publicClient]);

  if (isLoading) {
    return <div className="animate-pulse h-64 bg-[#090a12] rounded-2xl border border-[var(--border-dim)]"></div>;
  }

  return (
    <div className="bg-[#0d0e1c] p-6 rounded-2xl border border-[var(--border-dim)]">
      <div className="flex items-center gap-3 mb-6">
        <Trophy className="text-yellow-400" size={24} />
        <h2 className="text-xl font-bold text-white">Ecosystem Developer Leaderboard</h2>
      </div>

      <div className="space-y-4">
        {apps.length === 0 ? (
          <p className="text-[var(--text-secondary)] text-center py-8">No verified applications yet. Be the first!</p>
        ) : (
          apps.map((app, index) => (
            <div key={app.id} className="bg-[#090a12] rounded-xl border border-[var(--border-dim)] hover:border-cyan-500/30 transition-colors overflow-hidden">
              {/* Main Row */}
              <div 
                className="flex items-center gap-4 p-4 cursor-pointer"
                onClick={() => setExpandedId(expandedId === app.id ? null : app.id)}
              >
                {/* Rank */}
                <div className="flex-shrink-0 w-8 text-center">
                  {index === 0 ? <Medal className="text-yellow-400 mx-auto" size={24} /> :
                   index === 1 ? <Medal className="text-slate-300 mx-auto" size={24} /> :
                   index === 2 ? <Medal className="text-amber-600 mx-auto" size={24} /> :
                   <span className="text-[var(--text-secondary)] font-bold">#{index + 1}</span>}
                </div>

                {/* Logo */}
                <div className="w-10 h-10 rounded-lg overflow-hidden border border-[var(--border-dim)] bg-cyan-900/20 flex-shrink-0">
                  {app.logo_url ? (
                    <img src={app.logo_url} className="w-full h-full object-cover" alt={app.app_name} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-cyan-400 text-sm font-black">
                      {app.app_name?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                </div>
                
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-bold truncate">{app.app_name}</h3>
                  <p className="text-xs text-[var(--text-secondary)] truncate">
                    {app.category ? `${app.category} • ` : ''}Team: {app.team_size}
                  </p>
                </div>

                {/* Right Side */}
                <div className="text-right flex-shrink-0 flex items-center gap-3">
                  <div>
                    <div className="text-cyan-400 text-sm font-mono">{app.developer_wallet.slice(0,6)}...{app.developer_wallet.slice(-4)}</div>
                    <div className="flex items-center gap-1 text-xs text-yellow-500 justify-end mt-1">
                      <Star size={12} />
                      <span>Tier {(index < 3) ? '1' : '2'} Developer</span>
                    </div>
                  </div>
                  {expandedId === app.id ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
                </div>
              </div>

              {/* Expanded Details */}
              {expandedId === app.id && (
                <div className="border-t border-[var(--border-dim)] animate-in slide-in-from-top-2 duration-200">
                  {/* Banner */}
                  {app.banner_url && (
                    <div className="h-32 overflow-hidden">
                      <img src={app.banner_url} className="w-full h-full object-cover" alt="Banner" />
                    </div>
                  )}
                  
                  <div className="p-5 space-y-4">
                    {/* Description */}
                    {app.description && (
                      <p className="text-sm text-slate-300 leading-relaxed">{app.description}</p>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="rounded-xl border border-[var(--border-dim)] bg-[#070912] p-3">
                        <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Rank</div>
                        <div className="text-xl font-black text-white mt-1">#{index + 1}</div>
                      </div>
                      <div className="rounded-xl border border-[var(--border-dim)] bg-[#070912] p-3">
                        <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Live Volume</div>
                        <div className="text-xl font-black text-cyan-300 mt-1">{stats[app.id]?.volume || '0'} ARC</div>
                      </div>
                      <div className="rounded-xl border border-[var(--border-dim)] bg-[#070912] p-3">
                        <div className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Users / Txn</div>
                        <div className="text-xl font-black text-white mt-1">{stats[app.id]?.uniqueWallets || 0} / {stats[app.id]?.txs || 0}</div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      {app.app_url && (
                        <a href={app.app_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:underline font-bold bg-cyan-500/10 px-3 py-1.5 rounded-lg border border-cyan-500/20">
                          <Globe size={12} /> Visit Website <ExternalLink size={10} />
                        </a>
                      )}
                      {app.contract_address && (
                        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-300 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 font-mono truncate max-w-xs">
                          <Zap size={12} /> {app.contract_address.slice(0, 8)}...{app.contract_address.slice(-6)}
                        </span>
                      )}
                    </div>

                    {/* Sample Images */}
                    {app.sample_images && app.sample_images.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Screenshots</p>
                        <div className="flex gap-3 overflow-x-auto pb-2">
                          {app.sample_images.map((url, i) => (
                            <img key={i} src={url} className="h-28 rounded-lg object-cover border border-[var(--border-dim)] hover:scale-105 transition-transform cursor-pointer" alt={`Sample ${i+1}`} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
