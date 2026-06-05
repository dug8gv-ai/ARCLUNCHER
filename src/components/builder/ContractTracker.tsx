'use client';

import React, { useEffect, useState, useRef } from 'react';
import { usePublicClient, useChainId, useAccount } from 'wagmi';
import { supabase } from '@/lib/supabase';
import { formatEther } from 'viem';
import { Loader2, Activity, Users, Zap, AlertTriangle, Clock } from 'lucide-react';

interface AppRecord {
  id: string;
  app_name: string;
  contract_address: string;
  is_verified: boolean;
}

interface StatsRecord {
  txs: number;
  uniqueWallets: number;
  volume: string;
  lastUpdated?: string;
  sampled?: boolean;
  warning?: boolean;
}

const CHAIN_ID = 5042002;
const REFRESH_INTERVAL_MS = 60_000;
const MAX_TX_SAMPLE = 500;
const BLOCK_RANGE = BigInt(5000) as bigint;
const BIGINT_ZERO = BigInt(0) as bigint;

// localStorage helpers
function statsCacheKey(addr: string) {
  return `arcomni_contract_stats_${addr.toLowerCase()}`;
}
function loadCachedStats(addr: string): StatsRecord | null {
  try {
    const raw = localStorage.getItem(statsCacheKey(addr));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function saveCachedStats(addr: string, record: StatsRecord) {
  try { localStorage.setItem(statsCacheKey(addr), JSON.stringify(record)); } catch { /* quota */ }
}

export function ContractTracker() {
  const { address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const isCorrectNetwork = chainId === CHAIN_ID;

  const [apps, setApps] = useState<AppRecord[]>([]);
  const [stats, setStats] = useState<Record<string, StatsRecord>>({});
  const [isLoading, setIsLoading] = useState(true);
  const statsRef = useRef(stats);
  statsRef.current = stats;

  // Load apps
  useEffect(() => {
    if (!address) { setIsLoading(false); return; }

    const fetchApps = async () => {
      const { data, error } = await supabase
        .from('registered_apps')
        .select('id, app_name, contract_address, is_verified')
        .eq('developer_wallet', address)
        .eq('is_verified', true)
        .not('contract_address', 'is', null);

      if (!error && data) {
        setApps(data as AppRecord[]);
        // Seed stats from localStorage cache
        const seeded: Record<string, StatsRecord> = {};
        for (const app of data as AppRecord[]) {
          if (!app.contract_address) continue;
          const cached = loadCachedStats(app.contract_address);
          if (cached) seeded[app.id] = cached;
        }
        if (Object.keys(seeded).length) setStats(seeded);
      }
      setIsLoading(false);
    };

    fetchApps();
  }, [address]);

  // Track contracts
  useEffect(() => {
    if (!isCorrectNetwork || !publicClient || apps.length === 0) return;

    const trackContracts = async () => {
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

          // Unique transaction hashes
          const uniqueHashes = [...new Set(
            logs.map(l => l.transactionHash).filter(Boolean) as string[]
          )];
          const txs = uniqueHashes.length;
          const sampled = uniqueHashes.length > MAX_TX_SAMPLE;
          const hashesToFetch = sampled
            ? uniqueHashes.slice(-MAX_TX_SAMPLE)
            : uniqueHashes;

          // Fetch transactions in parallel
          const txObjects = await Promise.allSettled(
            hashesToFetch.map(h =>
              publicClient.getTransaction({ hash: h as `0x${string}` })
            )
          );

          const fromAddresses = new Set<string>();
          let volumeWei = BigInt(0) as bigint;

          for (const result of txObjects) {
            if (result.status === 'fulfilled' && result.value) {
              fromAddresses.add(result.value.from.toLowerCase());
              volumeWei += result.value.value ?? BigInt(0);
            }
          }

          const record: StatsRecord = {
            txs,
            uniqueWallets: fromAddresses.size,
            volume: formatEther(volumeWei),
            lastUpdated: new Date().toLocaleTimeString(),
            sampled,
            warning: false,
          };

          updates[app.id] = record;
          saveCachedStats(app.contract_address, record);
        } catch (e) {
          console.error(`Stats fetch failed for ${app.contract_address}`, e);
          // Retain prior stats, just flag warning
          const prior = statsRef.current[app.id];
          updates[app.id] = prior
            ? { ...prior, warning: true }
            : { txs: 0, uniqueWallets: 0, volume: '0', warning: true };
        }
      }

      setStats(prev => ({ ...prev, ...updates }));
    };

    trackContracts();
    const interval = setInterval(trackContracts, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [apps, publicClient, isCorrectNetwork]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="bd-card p-6 flex justify-center items-center h-40">
        <Loader2 className="animate-spin" style={{ color: 'var(--bd-accent-gold)' }} size={32} />
      </div>
    );
  }

  if (!isCorrectNetwork) {
    return (
      <div className="bd-card p-5 space-y-3">
        <h2 className="text-base font-black" style={{ color: 'var(--bd-accent-gold)' }}>
          Live Arc Chain Smart Contract Tracker
        </h2>
        <div className="flex items-center gap-2 p-3 rounded-xl text-sm" style={{ background: 'rgba(245,197,66,0.06)', border: '1px solid rgba(245,197,66,0.2)', color: 'var(--bd-accent-gold)' }}>
          <AlertTriangle size={16} />
          Switch to Arc Testnet (chain 5042002) to view live stats.
          {apps.length > 0 && ' Showing cached data below.'}
        </div>
        {/* Show cached stats when off-network */}
        {apps.length > 0 && renderAppList(apps, stats, true)}
      </div>
    );
  }

  if (apps.length === 0) {
    return (
      <div className="bd-card p-6 text-center text-sm" style={{ color: 'rgba(245,197,66,0.5)' }}>
        No verified apps with configured contracts found.
      </div>
    );
  }

  return (
    <div className="bd-card p-6 space-y-5">
      <h2 className="text-base font-black" style={{ color: 'var(--bd-accent-gold)' }}>
        Live Arc Chain Smart Contract Tracker
      </h2>
      {renderAppList(apps, stats, false)}
    </div>
  );

  function renderAppList(
    appList: AppRecord[],
    statsMap: Record<string, StatsRecord>,
    offNetwork: boolean
  ) {
    return (
      <div className="space-y-4">
        {appList.map(app => {
          const s = statsMap[app.id];
          return (
            <div key={app.id} className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(245,197,66,0.1)' }}>
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white truncate">{app.app_name}</h3>
                    {s?.warning && (
                      <span title="Stats refresh failed; showing last known values">
                        <AlertTriangle size={14} className="flex-shrink-0" style={{ color: 'var(--bd-accent-gold)' }} />
                      </span>
                    )}
                    {s?.sampled && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(192,132,252,0.15)', color: 'var(--bd-accent-purple)' }}>
                        sampled
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-mono mt-0.5 truncate max-w-xs" style={{ color: 'rgba(245,197,66,0.4)' }}>
                    {app.contract_address}
                  </p>
                </div>
                {s?.lastUpdated && !offNetwork && (
                  <div className="flex items-center gap-1 text-[10px] flex-shrink-0" style={{ color: 'rgba(245,197,66,0.4)' }}>
                    <Clock size={10} /> {s.lastUpdated}
                  </div>
                )}
                {offNetwork && (
                  <span className="text-[10px] px-2 py-0.5 rounded flex-shrink-0" style={{ background: 'rgba(245,197,66,0.08)', color: 'rgba(245,197,66,0.6)' }}>
                    cached
                  </span>
                )}
              </div>

              {/* Stats cards */}
              <div className="flex flex-wrap gap-3">
                <StatCard icon={<Activity size={14} />} label="Recent Txs" value={s?.txs ?? 0} />
                <StatCard icon={<Users size={14} />} label="Active Wallets" value={s?.uniqueWallets ?? 0} />
                <StatCard icon={<Zap size={14} />} label="Volume" value={`${parseFloat(s?.volume ?? '0').toFixed(4)} ARC`} />
              </div>
            </div>
          );
        })}
      </div>
    );
  }
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; value: string | number; label: string }) {
  return (
    <div
      className="flex-1 text-center p-3 rounded-xl"
      style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(245,197,66,0.1)', minWidth: '90px' }}
    >
      <div className="flex justify-center mb-1" style={{ color: 'var(--bd-accent-gold)' }}>{icon}</div>
      <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'rgba(245,197,66,0.5)' }}>{label}</div>
      <div className="text-lg font-black stat-value">{value}</div>
    </div>
  );
}
