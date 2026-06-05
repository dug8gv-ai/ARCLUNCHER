'use client';

import React, { useEffect, useState, useRef } from 'react';
import { usePublicClient, useChainId } from 'wagmi';
import { supabase } from '@/lib/supabase';
import { formatEther } from 'viem';
import { Trophy, Star, Medal, Globe, ExternalLink, ChevronDown, ChevronUp, Zap, AlertTriangle } from 'lucide-react';

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

const CHAIN_ID = 5042002;
const MAX_TX_SAMPLE = 500;
const BLOCK_RANGE = BigInt(5000) as bigint;
const BIGINT_ZERO = BigInt(0) as bigint;
const REFRESH_MS = 60_000;

function statsCacheKey(addr: string) {
  return `arcomni_contract_stats_${addr.toLowerCase()}`;
}
function loadCached(addr: string): StatsRecord | null {
  try { const r = localStorage.getItem(statsCacheKey(addr)); return r ? JSON.parse(r) : null; } catch { return null; }
}
function saveCache(addr: string, s: StatsRecord) {
  try { localStorage.setItem(statsCacheKey(addr), JSON.stringify(s)); } catch { /* quota */ }
}

export function Leaderboard() {
  const [apps, setApps] = useState<LeaderboardApp[]>([]);
  const [stats, setStats] = useState<Record<string, StatsRecord>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const publicClient = usePublicClient();
  const chainId = useChainId();
  const statsRef = useRef(stats);
  statsRef.current = stats;

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
          // Seed cache
          const seeded: Record<string, StatsRecord> = {};
          for (const app of data as LeaderboardApp[]) {
            if (!app.contract_address) continue;
            const cached = loadCached(app.contract_address);
            if (cached) seeded[app.id] = cached;
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

  // On-chain stats — same pipeline as ContractTracker
  useEffect(() => {
    if (!publicClient || chainId !== CHAIN_ID || apps.length === 0) return;

    const loadStats = async () => {
      const updates: Record<string, StatsRecord> = {};

      for (const app of apps) {
        if (!app.contract_address) continue;

        try {
          const blockNumber = await publicClient.getBlockNumber();
          const fromBlock = blockNumber - BLOCK_RANGE > BIGINT_ZERO ? blockNumber - BLOCK_RANGE : BIGINT_ZERO;

          const logs = await publicClient.getLogs({
            address: app.contract_address as `0x${string}`,
            fromBlock,
            toBlock: 'latest',
          });

          const uniqueHashes = [...new Set(
            logs.map(l => l.transactionHash).filter(Boolean) as string[]
          )];
          const txs = uniqueHashes.length;
          const hashesToFetch = uniqueHashes.length > MAX_TX_SAMPLE
            ? uniqueHashes.slice(-MAX_TX_SAMPLE)
            : uniqueHashes;

          const txObjects = await Promise.allSettled(
            hashesToFetch.map(h =>
              publicClient.getTransaction({ hash: h as `0x${string}` })
            )
          );

          const wallets = new Set<string>();
          let volumeWei = BigInt(0) as bigint;
          for (const r of txObjects) {
            if (r.status === 'fulfilled' && r.value) {
              wallets.add(r.value.from.toLowerCase());
              volumeWei += r.value.value ?? BigInt(0);
            }
          }

          const record: StatsRecord = {
            txs,
            uniqueWallets: wallets.size,
            volume: formatEther(volumeWei),
          };
          updates[app.id] = record;
          saveCache(app.contract_address, record);
        } catch (e) {
          console.error('Leaderboard stats failed', e);
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
    return <div className="bd-card bd-skeleton h-64" />;
  }

  return (
    <div className="bd-card p-6">
      <div className="flex items-center gap-3 mb-6">
        <Trophy style={{ color: 'var(--bd-accent-gold)' }} size={22} />
        <h2 className="text-base font-black" style={{ color: 'var(--bd-accent-gold)' }}>
          Ecosystem Developer Leaderboard
        </h2>
      </div>

      <div className="space-y-3">
        {apps.length === 0 ? (
          <p className="text-center py-8 text-sm" style={{ color: 'rgba(245,197,66,0.4)' }}>
            No verified applications yet. Be the first!
          </p>
        ) : (
          apps.map((app, index) => (
            <div
              key={app.id}
              className="rounded-xl overflow-hidden transition-all"
              style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${expandedId === app.id ? 'rgba(245,197,66,0.35)' : 'rgba(245,197,66,0.1)'}` }}
            >
              {/* Main row */}
              <div
                className="flex items-center gap-3 p-4 cursor-pointer select-none"
                onClick={() => setExpandedId(expandedId === app.id ? null : app.id)}
              >
                {/* Rank */}
                <div className="flex-shrink-0 w-7 text-center">
                  {index === 0 ? <Medal style={{ color: 'var(--bd-accent-gold)' }} className="mx-auto" size={20} /> :
                   index === 1 ? <Medal className="text-slate-300 mx-auto" size={20} /> :
                   index === 2 ? <Medal className="text-amber-600 mx-auto" size={20} /> :
                   <span className="text-xs font-bold" style={{ color: 'rgba(245,197,66,0.5)' }}>#{index + 1}</span>}
                </div>

                {/* Logo */}
                <div
                  className="w-9 h-9 flex-shrink-0 rounded-lg overflow-hidden flex items-center justify-center text-xs font-black"
                  style={{ background: 'rgba(245,197,66,0.08)', border: '1px solid rgba(245,197,66,0.2)', color: 'var(--bd-accent-gold)' }}
                >
                  {app.logo_url
                    ? <img src={app.logo_url} className="w-full h-full object-cover" alt={app.app_name} />
                    : (app.app_name?.[0]?.toUpperCase() || '?')
                  }
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3
                    className="font-bold text-sm"
                    style={{
                      color: 'white',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {app.app_name}
                  </h3>
                  <p className="text-[11px]" style={{ color: 'rgba(245,197,66,0.5)' }}>
                    {app.category ? `${app.category} · ` : ''}Team: {app.team_size}
                  </p>
                </div>

                {/* Wallet + tier */}
                <div className="flex-shrink-0 text-right flex items-center gap-2">
                  <div>
                    <div className="text-xs font-mono" style={{ color: 'var(--bd-accent-gold)' }}>
                      {app.developer_wallet.slice(0, 6)}…{app.developer_wallet.slice(-4)}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] justify-end mt-0.5" style={{ color: 'var(--bd-accent-purple)' }}>
                      <Star size={10} />
                      <span>Tier {index < 3 ? '1' : '2'} Developer</span>
                    </div>
                  </div>
                  {expandedId === app.id
                    ? <ChevronUp size={14} style={{ color: 'var(--bd-accent-gold)' }} />
                    : <ChevronDown size={14} style={{ color: 'rgba(245,197,66,0.4)' }} />
                  }
                </div>
              </div>

              {/* Expanded detail */}
              {expandedId === app.id && (
                <div style={{ borderTop: '1px solid rgba(245,197,66,0.1)' }}>
                  {/* Banner */}
                  {app.banner_url && (
                    <div className="h-28 overflow-hidden">
                      <img src={app.banner_url} className="w-full h-full object-cover" alt="Banner" />
                    </div>
                  )}

                  <div className="p-4 space-y-4">
                    {app.description && (
                      <p className="text-sm text-slate-300 leading-relaxed">{app.description}</p>
                    )}

                    {/* Stat cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {[
                        { label: 'Rank', value: `#${index + 1}` },
                        { label: 'Live Volume', value: `${parseFloat(stats[app.id]?.volume ?? '0').toFixed(4)} ARC` },
                        { label: 'Wallets / Txs', value: `${stats[app.id]?.uniqueWallets ?? 0} / ${stats[app.id]?.txs ?? 0}` },
                      ].map(c => (
                        <div
                          key={c.label}
                          className="rounded-xl p-3"
                          style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(245,197,66,0.1)' }}
                        >
                          <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'rgba(245,197,66,0.4)' }}>
                            {c.label}
                          </div>
                          <div className="text-xl font-black stat-value">{c.value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Links */}
                    <div className="flex flex-wrap gap-2">
                      {app.app_url && (
                        <a
                          href={app.app_url} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg"
                          style={{ background: 'rgba(245,197,66,0.08)', color: 'var(--bd-accent-gold)', border: '1px solid rgba(245,197,66,0.2)' }}
                        >
                          <Globe size={11} /> Visit Website <ExternalLink size={9} />
                        </a>
                      )}
                      {app.contract_address ? (
                        <span
                          className="inline-flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg"
                          style={{ background: 'rgba(192,132,252,0.1)', color: 'var(--bd-accent-purple)', border: '1px solid rgba(192,132,252,0.2)' }}
                        >
                          <Zap size={11} />
                          {app.contract_address.slice(0, 8)}…{app.contract_address.slice(-6)}
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
                          style={{ background: 'rgba(245,197,66,0.06)', color: 'rgba(245,197,66,0.4)', border: '1px solid rgba(245,197,66,0.1)' }}
                        >
                          <AlertTriangle size={11} /> No contract configured
                        </span>
                      )}
                    </div>

                    {/* Sample images */}
                    {app.sample_images && app.sample_images.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(245,197,66,0.4)' }}>
                          Screenshots
                        </p>
                        <div className="bd-img-scroll">
                          {app.sample_images.map((url, i) => (
                            <img
                              key={i} src={url}
                              className="h-28 flex-shrink-0 rounded-lg object-cover hover:scale-105 transition-transform cursor-pointer"
                              style={{ border: '1px solid rgba(245,197,66,0.15)' }}
                              alt={`Sample ${i + 1}`}
                            />
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
