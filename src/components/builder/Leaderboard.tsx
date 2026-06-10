'use client';

import React, { useEffect, useState, useRef } from 'react';
import { usePublicClient, useChainId } from 'wagmi';
import { supabase } from '@/lib/supabase';
import { formatEther } from 'viem';
import {
  Trophy, Star, Globe, ExternalLink, Zap, AlertTriangle,
  ChevronDown, ChevronUp, Activity, Users,
} from 'lucide-react';

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

interface StatsRecord {
  txs: number;
  uniqueWallets: number;
  volume: string;
}

const CHAIN_ID   = 5042002;
const MAX_SAMPLE = 500;
const BLOCK_RANGE = BigInt(5000) as bigint;
const BIGINT_ZERO = BigInt(0) as bigint;
const REFRESH_MS  = 60_000;

function cacheKey(addr: string) { return `arcomni_contract_stats_${addr.toLowerCase()}`; }
function loadCache(addr: string): StatsRecord | null {
  try { const r = localStorage.getItem(cacheKey(addr)); return r ? JSON.parse(r) : null; } catch { return null; }
}
function saveCache(addr: string, s: StatsRecord) {
  try { localStorage.setItem(cacheKey(addr), JSON.stringify(s)); } catch { /**/ }
}

// Medal component
function RankBadge({ index }: { index: number }) {
  if (index === 0) return (
    <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-black" style={{ background: 'linear-gradient(135deg,#f5c542 0%,#e09f1e 100%)', color: '#0a0a0f', boxShadow: '0 2px 8px rgba(245,197,66,0.45)' }}>
      1
    </div>
  );
  if (index === 1) return (
    <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-black" style={{ background: 'linear-gradient(135deg,#c0c0c0,#8a8a8a)', color: '#08080f', boxShadow: '0 2px 4px rgba(148,163,184,0.2)' }}>
      2
    </div>
  );
  if (index === 2) return (
    <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-black" style={{ background: 'linear-gradient(135deg,#cd7f32,#8B4513)', color: '#fff', boxShadow: '0 0 8px rgba(205,127,50,0.4)' }}>
      3
    </div>
  );
  return (
    <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(59,130,246,0.08)', color: 'rgba(59,130,246,0.6)', border: '1px solid rgba(203,213,225,0.7)' }}>
      {index + 1}
    </div>
  );
}

export function Leaderboard() {
  const [apps,       setApps]       = useState<LeaderboardApp[]>([]);
  const [stats,      setStats]      = useState<Record<string, StatsRecord>>({});
  const [isLoading,  setIsLoading]  = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const publicClient = usePublicClient();
  const chainId      = useChainId();
  const statsRef     = useRef(stats);
  statsRef.current   = stats;

  // Fetch leaderboard
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
          setApps(data as LeaderboardApp[]);
          // Seed cached stats
          const seeded: Record<string, StatsRecord> = {};
          for (const app of data as LeaderboardApp[]) {
            if (!app.contract_address) continue;
            const c = loadCache(app.contract_address);
            if (c) seeded[app.id] = c;
          }
          if (Object.keys(seeded).length) setStats(seeded);
        }
      } catch (err) {
        console.error('Leaderboard fetch failed', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeaderboard();
    const handler = () => fetchLeaderboard();
    window.addEventListener('builder-app-verified', handler);
    return () => window.removeEventListener('builder-app-verified', handler);
  }, []);

  // On-chain stats
  useEffect(() => {
    if (!publicClient || chainId !== CHAIN_ID || apps.length === 0) return;

    const loadStats = async () => {
      const updates: Record<string, StatsRecord> = {};

      for (const app of apps) {
        if (!app.contract_address) continue;
        try {
          const blockNumber = await publicClient.getBlockNumber();
          const fromBlock   = blockNumber - BLOCK_RANGE > BIGINT_ZERO ? blockNumber - BLOCK_RANGE : BIGINT_ZERO;
          const logs        = await publicClient.getLogs({ address: app.contract_address as `0x${string}`, fromBlock, toBlock: 'latest' });

          const uniqueHashes = [...new Set(logs.map(l => l.transactionHash).filter(Boolean) as string[])];
          const txs          = uniqueHashes.length;
          const toFetch      = uniqueHashes.length > MAX_SAMPLE ? uniqueHashes.slice(-MAX_SAMPLE) : uniqueHashes;

          const txObjs = await Promise.allSettled(toFetch.map(h => publicClient.getTransaction({ hash: h as `0x${string}` })));
          const wallets   = new Set<string>();
          let volumeWei   = BigInt(0) as bigint;
          for (const r of txObjs) {
            if (r.status === 'fulfilled' && r.value) {
              wallets.add(r.value.from.toLowerCase());
              volumeWei += r.value.value ?? BIGINT_ZERO;
            }
          }

          // If on-chain native volume is 0 (ERC20 interactions have tx.value == 0),
          // fall back to Supabase token_swaps for USDC volume — 3-step fallback.
          let volumeDisplay = formatEther(volumeWei);
          let volumeSuffix  = 'ARC';
          if (volumeWei === BIGINT_ZERO && app.contract_address) {
            try {
              // Step 1: query token_swaps by this contract's token address
              const contractAddr = app.contract_address.toLowerCase();
              let { data: swapRows } = await supabase
                .from('token_swaps')
                .select('usdc_amount')
                .eq('token_address', contractAddr);

              // Step 2: if no results, get all token_launch addresses, sum their swaps
              if (!swapRows || swapRows.length === 0) {
                const { data: launches } = await supabase
                  .from('token_launches')
                  .select('token_address');
                const tokenAddresses = (launches ?? []).map((l: { token_address: string }) => l.token_address);
                if (tokenAddresses.length > 0) {
                  const { data: allSwaps } = await supabase
                    .from('token_swaps')
                    .select('usdc_amount')
                    .in('token_address', tokenAddresses);
                  swapRows = allSwaps;
                }
              }

              // Step 3: sum usdc_amount
              if (swapRows && swapRows.length > 0) {
                const totalUsdc = swapRows.reduce(
                  (sum: number, row: { usdc_amount: number | string | null }) =>
                    sum + (parseFloat(String(row.usdc_amount ?? '0')) || 0),
                  0
                );
                if (totalUsdc > 0) {
                  volumeDisplay = totalUsdc.toFixed(2);
                  volumeSuffix  = 'USDC';
                }
              }
            } catch {
              // Supabase fallback failed — keep 0.0000 ARC display
            }
          }

          const record: StatsRecord = {
            txs,
            uniqueWallets: wallets.size,
            volume: volumeSuffix === 'USDC' ? `${volumeDisplay} USDC` : formatEther(volumeWei),
          };
          updates[app.id] = record;
          saveCache(app.contract_address, record);
        } catch {
          const prior = statsRef.current[app.id];
          if (prior) updates[app.id] = prior;
        }
      }
      setStats(prev => ({ ...prev, ...updates }));
    };

    loadStats();
    const interval = setInterval(loadStats, REFRESH_MS);
    return () => clearInterval(interval);
  }, [apps, chainId, publicClient]);

  if (isLoading) {
    return <div className="bd-card bd-skeleton h-48" />;
  }

  return (
    <div className="bd-card p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <Trophy style={{ color: 'var(--bd-accent-gold)' }} size={22} />
        <h2 className="text-base font-black" style={{ color: 'var(--bd-accent-gold)' }}>
          Ecosystem Developer Leaderboard
        </h2>
      </div>

      <div className="space-y-3">
        {apps.length === 0 ? (
          <p className="text-center py-8 text-sm" style={{ color: '#94a3b8' }}>
            No verified applications yet. Be the first!
          </p>
        ) : (
          apps.map((app, index) => {
            const s          = stats[app.id];
            const isExpanded = expandedId === app.id;

            return (
              <div
                key={app.id}
                className="rounded-xl overflow-hidden transition-all"
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-dim)',
                  boxShadow: isExpanded ? 'none' : 'none',
                }}
              >
                {/* ── Main row ── */}
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer select-none"
                  onClick={() => setExpandedId(isExpanded ? null : app.id)}
                >
                  {/* Rank */}
                  <RankBadge index={index} />

                  {/* Logo */}
                  <div
                    className="w-10 h-10 flex-shrink-0 rounded-xl overflow-hidden flex items-center justify-center text-sm font-black"
                    style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(203,213,225,0.7)', color: 'var(--bd-accent-gold)' }}
                  >
                    {app.logo_url
                      ? <img src={app.logo_url} className="w-full h-full object-cover" alt={app.app_name} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      : (app.app_name?.[0]?.toUpperCase() || '?')
                    }
                  </div>

                  {/* Name + category */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-black text-sm text-white" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {app.app_name}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      {app.category && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(59,130,246,0.08)', color: '#64748b' }}>
                          {app.category}
                        </span>
                      )}
                      <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>Team: {app.team_size}</span>
                    </div>
                  </div>

                  {/* Stats mini preview */}
                  <div className="hidden sm:flex items-center gap-3 flex-shrink-0">
                    <div className="text-center">
                      <div className="text-[9px] font-bold uppercase" style={{ color: '#94a3b8' }}>Vol</div>
                      <div className="text-xs font-black stat-value">
                        {(() => {
                          const vol = s?.volume ?? '0';
                          if (vol.includes('USDC')) return vol;
                          return parseFloat(vol).toFixed(2);
                        })()}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-[9px] font-bold uppercase" style={{ color: '#94a3b8' }}>Txs</div>
                      <div className="text-xs font-black stat-value">{s?.txs ?? 0}</div>
                    </div>
                  </div>

                  {/* Wallet + tier */}
                  <div className="flex-shrink-0 text-right">
                    <div className="text-xs font-mono" style={{ color: 'var(--bd-accent-gold)' }}>
                      {app.developer_wallet.slice(0,6)}…{app.developer_wallet.slice(-4)}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] justify-end mt-0.5" style={{ color: 'var(--bd-accent-purple)' }}>
                      <Star size={10} />
                      <span>Tier {index < 3 ? '1' : '2'} Developer</span>
                    </div>
                  </div>

                  {isExpanded
                    ? <ChevronUp size={14} style={{ color: 'var(--bd-accent-gold)', flexShrink: 0 }} />
                    : <ChevronDown size={14} style={{ color: '#94a3b8', flexShrink: 0 }} />
                  }
                </div>

                {/* ── Expanded full profile ── */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid rgba(245,197,66,0.1)' }}>

                    {/* Banner */}
                    {app.banner_url && (
                      <div className="h-32 overflow-hidden">
                        <img src={app.banner_url} className="w-full h-full object-cover" alt="Banner" />
                      </div>
                    )}

                    <div className="p-5 space-y-4">
                      {/* Logo large + app name */}
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 flex-shrink-0 rounded-2xl overflow-hidden flex items-center justify-center text-2xl font-black" style={{ background: 'rgba(59,130,246,0.1)', border: '2px solid rgba(203,213,225,0.7)', color: 'var(--bd-accent-gold)' }}>
                          {app.logo_url
                            ? <img src={app.logo_url} className="w-full h-full object-cover" alt={app.app_name} />
                            : (app.app_name?.[0]?.toUpperCase() || '?')
                          }
                        </div>
                        <div>
                          <h4 className="text-lg font-black text-white" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{app.app_name}</h4>
                          {app.description && <p className="text-xs text-slate-400 mt-1 leading-relaxed max-w-md">{app.description}</p>}
                        </div>
                      </div>

                      {/* Stat cards — Rank, Volume, Wallets/Txs */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-dim)' }}>
                          <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#94a3b8' }}>Rank</div>
                          <div className="text-2xl font-black stat-value">#{index + 1}</div>
                        </div>
                        <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-dim)' }}>
                          <div className="flex items-center justify-center gap-1 mb-1">
                            <Zap size={10} style={{ color: '#94a3b8' }} />
                            <span className="text-[10px] uppercase tracking-widest" style={{ color: '#94a3b8' }}>Live Volume</span>
                          </div>
                          <div className="text-2xl font-black stat-value">
                            {(() => {
                              const vol = s?.volume ?? '0';
                              if (vol.includes('USDC')) return vol;
                              return `${parseFloat(vol).toFixed(4)} ARC`;
                            })()}
                          </div>
                        </div>
                        <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-dim)' }}>
                          <div className="flex items-center justify-center gap-2 mb-1">
                            <Users size={10} style={{ color: '#94a3b8' }} />
                            <span className="text-[10px] uppercase tracking-widest" style={{ color: '#94a3b8' }}>Wallets</span>
                            <Activity size={10} style={{ color: '#94a3b8' }} />
                            <span className="text-[10px] uppercase tracking-widest" style={{ color: '#94a3b8' }}>Txs</span>
                          </div>
                          <div className="text-2xl font-black stat-value">{s?.uniqueWallets ?? 0} / {s?.txs ?? 0}</div>
                        </div>
                      </div>

                      {/* Links */}
                      <div className="flex flex-wrap gap-2">
                        {app.app_url && (
                          <a href={app.app_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-all hover:opacity-80" style={{ background: 'rgba(245,197,66,0.08)', color: 'var(--bd-accent-gold)', border: '1px solid rgba(245,197,66,0.2)' }}>
                            <Globe size={11} /> Visit Website <ExternalLink size={9} />
                          </a>
                        )}
                        {app.contract_address ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg" style={{ background: 'rgba(192,132,252,0.1)', color: 'var(--bd-accent-purple)', border: '1px solid rgba(192,132,252,0.2)' }}>
                            <Zap size={11} /> {app.contract_address.slice(0,8)}…{app.contract_address.slice(-6)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg" style={{ background: 'rgba(203,213,225,0.1)', color: '#64748b', border: '1px solid rgba(203,213,225,0.7)' }}>
                            <AlertTriangle size={11} /> No contract configured
                          </span>
                        )}
                      </div>

                      {/* Screenshot gallery */}
                      {app.sample_images && app.sample_images.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#94a3b8' }}>Screenshots</p>
                          <div className="bd-img-scroll">
                            {app.sample_images.map((url, i) => (
                              <img key={i} src={url} className="h-28 flex-shrink-0 rounded-xl object-cover hover:scale-105 transition-transform cursor-pointer" style={{ border: '1px solid rgba(245,197,66,0.15)' }} alt={`S${i+1}`} />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
