'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { usePublicClient, useChainId, useAccount } from 'wagmi';
import { supabase } from '@/lib/supabase';
import { formatEther } from 'viem';
import {
  Loader2, Activity, Users, Zap, AlertTriangle,
  Clock, RefreshCw, TrendingUp, Database, CheckCircle
} from 'lucide-react';

interface AppRecord {
  id: string;
  app_name: string;
  contract_address: string;
  is_verified: boolean;
}

interface AppStats {
  app_id:          string;
  total_txs:       number;
  unique_wallets:  number;
  volume_24h:      number;
  volume_total:    number;
  volume_unit:     string;
  txs_24h:         number;
  last_block:      number;
  last_updated:    string;
  warning:         boolean;
}

const CHAIN_ID            = 5042002;
const REFRESH_MS          = 90_000;   // 90s auto-refresh
const BLOCKS_PER_SECOND   = 2;        // Arc testnet ~2s block time
const SECONDS_IN_24H      = 86400;
const BLOCKS_IN_24H       = BigInt(Math.floor(SECONDS_IN_24H / BLOCKS_PER_SECOND));

export function ContractTracker() {
  const { address }    = useAccount();
  const chainId        = useChainId();
  const publicClient   = usePublicClient();
  const isCorrectNet   = chainId === CHAIN_ID;

  const [apps,      setApps]      = useState<AppRecord[]>([]);
  const [stats,     setStats]     = useState<Record<string, AppStats>>({});
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);
  const [lastSync,  setLastSync]  = useState<string>('');
  const mountedRef                = useRef(true);

  // ── Load apps from Supabase ──────────────────────────────────────────────
  useEffect(() => {
    if (!address) { setLoading(false); return; }

    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('registered_apps')
        .select('id, app_name, contract_address, is_verified')
        .eq('developer_wallet', address)
        .eq('is_verified', true)
        .not('contract_address', 'is', null);

      if (!error && data && mountedRef.current) {
        setApps(data as AppRecord[]);
        // Load previously saved stats from Supabase immediately
        await loadSavedStats(data as AppRecord[]);
      }
      if (mountedRef.current) setLoading(false);
    };

    load();
    return () => { mountedRef.current = false; };
  }, [address]);

  // ── Load saved stats from Supabase (persists across refresh) ────────────
  const loadSavedStats = async (appList: AppRecord[]) => {
    if (!appList.length) return;
    const ids = appList.map(a => a.id);
    const { data } = await supabase
      .from('app_stats')
      .select('*')
      .in('app_id', ids);

    if (data && data.length && mountedRef.current) {
      const map: Record<string, AppStats> = {};
      data.forEach((r: AppStats) => { map[r.app_id] = r; });
      setStats(map);
    }
  };

  // ── Calculate accurate stats from chain + DB ─────────────────────────────
  const calculateStats = useCallback(async (silent = false) => {
    if (!publicClient || !isCorrectNet || !apps.length) return;
    if (!silent) setRefreshing(true);

    const updates: Record<string, AppStats> = {};

    for (const app of apps) {
      if (!app.contract_address) continue;
      const addr = app.contract_address.toLowerCase() as `0x${string}`;

      try {
        const latestBlock = await publicClient.getBlockNumber();
        const fromBlock24h = latestBlock > BLOCKS_IN_24H
          ? latestBlock - BLOCKS_IN_24H
          : BigInt(0);

        // ── ALL TIME logs ──────────────────────────────────────────────────
        const [allLogs, logs24h] = await Promise.all([
          publicClient.getLogs({ address: addr, fromBlock: BigInt(0), toBlock: 'latest' }),
          publicClient.getLogs({ address: addr, fromBlock: fromBlock24h, toBlock: 'latest' }),
        ]);

        // Unique TX hashes
        const allHashes = [...new Set(allLogs.map(l => l.transactionHash).filter(Boolean) as string[])];
        const hashes24h = [...new Set(logs24h.map(l => l.transactionHash).filter(Boolean) as string[])];

        // Fetch TXs for unique wallets + native volume (batch, max 300)
        const fetchBatch = async (hashes: string[]) => {
          const batch = hashes.slice(-300);
          const results = await Promise.allSettled(
            batch.map(h => publicClient.getTransaction({ hash: h as `0x${string}` }))
          );
          const wallets = new Set<string>();
          let nativeWei = BigInt(0);
          for (const r of results) {
            if (r.status === 'fulfilled' && r.value) {
              wallets.add(r.value.from.toLowerCase());
              nativeWei += r.value.value ?? BigInt(0);
            }
          }
          return { wallets, nativeWei };
        };

        const [allFetched, fetched24h] = await Promise.all([
          fetchBatch(allHashes),
          fetchBatch(hashes24h),
        ]);

        // ── Volume from Supabase token_swaps (USDC accurate) ──────────────
        let volumeTotal = 0;
        let volume24h   = 0;
        let volumeUnit  = 'USDC';

        // Check if it's a token launch contract
        const { data: swapsDirect } = await supabase
          .from('token_swaps')
          .select('usdc_amount, created_at')
          .eq('token_address', addr);

        if (swapsDirect && swapsDirect.length > 0) {
          // Direct token match
          const now = Date.now();
          volumeTotal = swapsDirect.reduce((s: number, r: any) => s + Number(r.usdc_amount), 0);
          volume24h   = swapsDirect
            .filter((r: any) => now - new Date(r.created_at).getTime() < 86400_000)
            .reduce((s: number, r: any) => s + Number(r.usdc_amount), 0);
        } else {
          // Launcher/router contract — sum all platform swaps
          const { data: allSwaps } = await supabase
            .from('token_swaps')
            .select('usdc_amount, created_at');

          if (allSwaps && allSwaps.length > 0) {
            const now = Date.now();
            volumeTotal = allSwaps.reduce((s: number, r: any) => s + Number(r.usdc_amount), 0);
            volume24h   = allSwaps
              .filter((r: any) => now - new Date(r.created_at).getTime() < 86400_000)
              .reduce((s: number, r: any) => s + Number(r.usdc_amount), 0);
          } else {
            // Fallback: native ARC volume
            const nativeTotal = parseFloat(formatEther(allFetched.nativeWei));
            const native24h   = parseFloat(formatEther(fetched24h.nativeWei));
            if (nativeTotal > 0) {
              volumeTotal = nativeTotal;
              volume24h   = native24h;
              volumeUnit  = 'ARC';
            }
          }
        }

        const record: AppStats = {
          app_id:         app.id,
          total_txs:      allHashes.length,
          unique_wallets: allFetched.wallets.size,
          volume_24h:     parseFloat(volume24h.toFixed(4)),
          volume_total:   parseFloat(volumeTotal.toFixed(4)),
          volume_unit:    volumeUnit,
          txs_24h:        hashes24h.length,
          last_block:     Number(latestBlock),
          last_updated:   new Date().toISOString(),
          warning:        false,
        };

        updates[app.id] = record;

        // ── Persist to Supabase app_stats ──────────────────────────────────
        await supabase
          .from('app_stats')
          .upsert(record, { onConflict: 'app_id' });

      } catch (err) {
        console.error(`Stats error for ${app.contract_address}`, err);
        const prior = stats[app.id];
        updates[app.id] = prior
          ? { ...prior, warning: true }
          : {
              app_id: app.id, total_txs: 0, unique_wallets: 0,
              volume_24h: 0, volume_total: 0, volume_unit: 'USDC',
              txs_24h: 0, last_block: 0,
              last_updated: new Date().toISOString(), warning: true,
            };
      }
    }

    if (mountedRef.current) {
      setStats(prev => ({ ...prev, ...updates }));
      setLastSync(new Date().toLocaleTimeString());
      if (!silent) setRefreshing(false);
    }
  }, [apps, publicClient, isCorrectNet, stats]);

  // ── Auto-refresh ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!apps.length || !isCorrectNet) return;
    calculateStats(true);
    const interval = setInterval(() => calculateStats(true), REFRESH_MS);
    return () => clearInterval(interval);
  }, [apps, isCorrectNet]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="bd-card p-6 flex justify-center items-center h-40">
      <Loader2 className="animate-spin" style={{ color: 'var(--bd-accent-gold)' }} size={28} />
    </div>
  );

  if (!address) return (
    <div className="bd-card p-6 text-center text-sm" style={{ color: 'rgba(245,197,66,0.5)' }}>
      Connect wallet to view stats
    </div>
  );

  if (!isCorrectNet) return (
    <div className="bd-card p-5 space-y-3">
      <Header lastSync={lastSync} refreshing={refreshing} onRefresh={() => calculateStats(false)} />
      <div className="flex items-center gap-2 p-3 rounded-xl text-sm"
        style={{ background: 'rgba(245,197,66,0.06)', border: '1px solid rgba(245,197,66,0.2)', color: 'var(--bd-accent-gold)' }}>
        <AlertTriangle size={16} />
        Switch to Arc Testnet (chain 5042002).
        {Object.keys(stats).length > 0 && ' Showing last saved stats.'}
      </div>
      {apps.length > 0 && <AppList apps={apps} stats={stats} />}
    </div>
  );

  if (apps.length === 0) return (
    <div className="bd-card p-6 text-center text-sm" style={{ color: 'rgba(245,197,66,0.5)' }}>
      No verified apps with contract addresses found.
    </div>
  );

  return (
    <div className="bd-card p-6 space-y-5">
      <Header lastSync={lastSync} refreshing={refreshing} onRefresh={() => calculateStats(false)} />
      <AppList apps={apps} stats={stats} />
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function Header({ lastSync, refreshing, onRefresh }: {
  lastSync: string; refreshing: boolean; onRefresh: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
      <h2 className="text-base font-black" style={{ color: 'var(--bd-accent-gold)' }}>
        Live Contract Stats
      </h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {lastSync && (
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
            synced {lastSync}
          </span>
        )}
        <button
          onClick={onRefresh}
          disabled={refreshing}
          style={{
            padding: '5px 10px', borderRadius: 8,
            border: '1px solid rgba(245,197,66,0.25)',
            background: 'rgba(245,197,66,0.08)',
            color: 'var(--bd-accent-gold)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 11, fontFamily: 'Orbitron, sans-serif',
          }}
        >
          <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'SYNCING' : 'REFRESH'}
        </button>
      </div>
    </div>
  );
}

function AppList({ apps, stats }: { apps: AppRecord[]; stats: Record<string, AppStats> }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {apps.map(app => {
        const s = stats[app.id];
        return (
          <div key={app.id} style={{
            background: 'rgba(4,6,28,0.85)',
            border: `1px solid ${s?.warning ? 'rgba(255,215,64,0.3)' : 'rgba(41,121,255,0.2)'}`,
            borderRadius: 12, overflow: 'hidden',
          }}>
            {/* App header */}
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid rgba(41,121,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'rgba(8,14,44,0.6)',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', fontFamily: 'Orbitron, sans-serif' }}>
                    {app.app_name}
                  </span>
                  {app.is_verified && (
                    <CheckCircle size={12} style={{ color: '#00e676' }} />
                  )}
                  {s?.warning && (
                    <AlertTriangle size={12} style={{ color: 'var(--bd-accent-gold)' }} title="Last refresh failed" />
                  )}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 2 }}>
                  {app.contract_address.slice(0, 12)}...{app.contract_address.slice(-8)}
                </div>
              </div>
              {s?.last_updated && (
                <div style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'right', fontFamily: 'monospace' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                    <Database size={9} />
                    saved to DB
                  </div>
                  <div>{new Date(s.last_updated).toLocaleTimeString()}</div>
                </div>
              )}
            </div>

            {/* Stats grid */}
            {s ? (
              <div style={{ padding: '14px 16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 10 }}>
                  <StatBox
                    label="TOTAL TXS (ALL TIME)"
                    value={s.total_txs.toLocaleString()}
                    icon={<Activity size={12} />}
                    color="#00e5ff"
                  />
                  <StatBox
                    label="TXS (24H)"
                    value={s.txs_24h.toLocaleString()}
                    icon={<Clock size={12} />}
                    color="#ffd740"
                  />
                  <StatBox
                    label="UNIQUE WALLETS"
                    value={s.unique_wallets.toLocaleString()}
                    icon={<Users size={12} />}
                    color="#d500f9"
                  />
                  <StatBox
                    label="VOLUME (24H)"
                    value={`${s.volume_24h.toLocaleString()} ${s.volume_unit}`}
                    icon={<TrendingUp size={12} />}
                    color="#00e676"
                  />
                </div>
                {/* Total volume full width */}
                <div style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  background: 'rgba(0,230,118,0.05)',
                  border: '1px solid rgba(0,230,118,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Zap size={12} style={{ color: '#00e676' }} />
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Orbitron, sans-serif', letterSpacing: 1 }}>
                      GLOBAL VOLUME (ALL TIME)
                    </span>
                  </div>
                  <span style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 15, color: '#00e676' }}>
                    {s.volume_total.toLocaleString()} {s.volume_unit}
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ padding: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Loader2 size={16} className="animate-spin" style={{ color: 'var(--bd-accent-gold)' }} />
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Orbitron, sans-serif', letterSpacing: 1 }}>
                  CALCULATING STATS...
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StatBox({ label, value, icon, color }: {
  label: string; value: string; icon: React.ReactNode; color: string;
}) {
  return (
    <div style={{
      padding: '10px 12px',
      borderRadius: 8,
      background: 'rgba(4,6,26,0.8)',
      border: `1px solid ${color}22`,
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${color}, transparent)` }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
        <span style={{ color }}>{icon}</span>
        <span style={{ fontSize: 8, color: 'var(--text-muted)', fontFamily: 'Orbitron, sans-serif', letterSpacing: 1.5, textTransform: 'uppercase' }}>
          {label}
        </span>
      </div>
      <div style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 16, color }}>
        {value}
      </div>
    </div>
  );
}
