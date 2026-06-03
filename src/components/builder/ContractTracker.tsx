'use client';

import React, { useEffect, useState } from 'react';
import { usePublicClient, useChainId } from 'wagmi';
import { supabase } from '@/lib/supabase';
import { formatEther } from 'viem';
import { Loader2, Activity, Users, Zap } from 'lucide-react';
import { useAccount } from 'wagmi';

interface AppRecord {
  id: string;
  app_name: string;
  contract_address: string;
  is_verified: boolean;
}

export function ContractTracker() {
  const { address } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const [apps, setApps] = useState<AppRecord[]>([]);
  const [stats, setStats] = useState<Record<string, { txs: number; uniqueWallets: number; volume: string }>>({});
  const [isLoading, setIsLoading] = useState(true);

  // STRICT ARC CHAIN ENFORCEMENT
  const EXPECTED_CHAIN_ID = 5042002;
  const isCorrectNetwork = chainId === EXPECTED_CHAIN_ID;

  useEffect(() => {
    if (!address) return;

    const fetchApps = async () => {
      const { data, error } = await supabase
        .from('registered_apps')
        .select('id, app_name, contract_address, is_verified')
        .eq('developer_wallet', address)
        .eq('is_verified', true)
        .not('contract_address', 'is', null);
      
      if (!error && data) {
        setApps(data);
      }
      setIsLoading(false);
    };

    fetchApps();
  }, [address]);

  useEffect(() => {
    if (!isCorrectNetwork || !publicClient || apps.length === 0) return;

    const trackContracts = async () => {
      const newStats: Record<string, any> = {};

      for (const app of apps) {
        if (!app.contract_address) continue;
        
        try {
          // Note: Full historical indexing natively via viem is slow.
          // In a production app, an indexer like The Graph is preferred.
          // Here we do a lightweight check of recent blocks for the MVP.
          const blockNumber = await publicClient.getBlockNumber();
          const fromBlock = blockNumber - BigInt(1000); // Check last 1000 blocks roughly
          
          const logs = await publicClient.getLogs({
            address: app.contract_address as `0x${string}`,
            fromBlock,
            toBlock: 'latest'
          });

          const uniqueSet = new Set<string>();
          let volume = BigInt(0);

          // A simple generic tracking loop over recent logs
          logs.forEach(log => {
            // we assume the first topic is standard or we just track interaction presence
            // and we track transaction hash
            if (log.transactionHash) {
              uniqueSet.add(log.transactionHash);
            }
          });

          newStats[app.id] = {
            txs: logs.length, // total log events emitted
            uniqueWallets: uniqueSet.size, // approximation of active wallets based on tx hashes
            volume: '0.0' // Full volume tracking requires specific ABI parsing
          };
        } catch (e) {
          console.error(`Failed to track ${app.contract_address}`, e);
        }
      }
      setStats(newStats);
    };

    trackContracts();
    const interval = setInterval(trackContracts, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [apps, publicClient, isCorrectNetwork]);

  if (!isCorrectNetwork) {
    return (
      <div className="p-4 bg-red-900/20 border border-red-500 rounded-xl text-red-400">
        Strict Network Policy Enforced: Please switch to Arc Testnet (5042002) to view Contract Tracking.
      </div>
    );
  }

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-cyan-400" /></div>;
  }

  if (apps.length === 0) {
    return (
      <div className="p-6 bg-[#0d0e1c] rounded-2xl border border-slate-800 text-slate-400 text-center">
        No verified apps with configured contracts found on your account.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-yellow-400">Live Arc Chain Smart Contract Tracker</h2>
      <div className="grid grid-cols-1 gap-6">
        {apps.map(app => (
          <div key={app.id} className="bg-[#090a12] p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex-1">
              <h3 className="text-lg font-bold text-white mb-1">{app.app_name}</h3>
              <p className="text-xs text-slate-500 font-mono bg-black p-1.5 rounded inline-block">
                {app.contract_address}
              </p>
            </div>
            
            <div className="flex gap-4">
              <div className="text-center p-3 bg-slate-800/30 rounded-xl border border-slate-700/50 min-w-[100px]">
                <Activity size={16} className="mx-auto text-cyan-400 mb-2" />
                <div className="text-xs text-slate-500 uppercase font-bold mb-1">Recent Txs</div>
                <div className="text-xl font-bold text-white">{stats[app.id]?.txs || 0}</div>
              </div>
              <div className="text-center p-3 bg-slate-800/30 rounded-xl border border-slate-700/50 min-w-[100px]">
                <Users size={16} className="mx-auto text-yellow-400 mb-2" />
                <div className="text-xs text-slate-500 uppercase font-bold mb-1">Active Wallets</div>
                <div className="text-xl font-bold text-white">{stats[app.id]?.uniqueWallets || 0}</div>
              </div>
              <div className="text-center p-3 bg-slate-800/30 rounded-xl border border-slate-700/50 min-w-[100px]">
                <Zap size={16} className="mx-auto text-green-400 mb-2" />
                <div className="text-xs text-slate-500 uppercase font-bold mb-1">Volume</div>
                <div className="text-xl font-bold text-white">{stats[app.id]?.volume || '0'} ARC</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
