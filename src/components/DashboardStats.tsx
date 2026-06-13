'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, Coins, TrendingUp, Users, UserCheck, UserMinus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAccount, usePublicClient } from 'wagmi';

export function DashboardStats() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [supabaseVolume, setSupabaseVolume] = useState(0);
  const [chainVolume, setChainVolume] = useState(0);
  const [stats, setStats] = useState({
    volume: "0",
    tokens: 0,
    newToday: 0,
    registered: 0,
    online: 0,
    offline: 0
  });

  const [arcScanStats, setArcScanStats] = useState({
    totalTokensBase: 0,
    dailyTokensBase: 0,
    volumeBase: 0
  });

  // Sync grand total volume to stats.volume whenever database or on-chain volumes change
  useEffect(() => {
    const grandTotal = (supabaseVolume + chainVolume + arcScanStats.volumeBase).toLocaleString(undefined, { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
    setStats(prev => ({ ...prev, volume: grandTotal }));
  }, [supabaseVolume, chainVolume, arcScanStats.volumeBase]);

  // Live on-chain block transaction volume scanner
  useEffect(() => {
    if (!publicClient) return;

    let isMounted = true;
    let lastFetchedBlock = 0;

    const scanBlocks = async () => {
      try {
        const latestBlockNumber = Number(await publicClient.getBlockNumber());
        if (latestBlockNumber === lastFetchedBlock) return;

        // If this is the initial scan, get the last 15 blocks. Otherwise, scan only new blocks.
        const startBlock = lastFetchedBlock === 0 
          ? Math.max(0, latestBlockNumber - 15) 
          : lastFetchedBlock + 1;
        
        lastFetchedBlock = latestBlockNumber;

        const blockPromises = [];
        for (let i = startBlock; i <= latestBlockNumber; i++) {
          blockPromises.push(
            publicClient.getBlock({
              blockNumber: BigInt(i),
              includeTransactions: true,
            })
          );
        }

        const rawBlocks = await Promise.all(blockPromises);
        if (!isMounted) return;

        let newVolume = 0;
        rawBlocks.forEach(b => {
          const txs = (b.transactions || []) as any[];
          // Sum native transacted value (value field in transactions)
          const totalValueWei = txs.reduce((sum, tx) => sum + BigInt(tx.value || 0), BigInt(0));
          newVolume += Number(totalValueWei) / 1e18;
        });

        if (newVolume > 0) {
          setChainVolume(prev => prev + newVolume);
        }
      } catch (err) {
        console.error('Error scanning blocks for volume:', err);
      }
    };

    scanBlocks();
    const interval = setInterval(scanBlocks, 8000); // Poll every 8 seconds

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [publicClient]);

  useEffect(() => {
    async function fetchStats() {
      try {
        // 1. Fetch all launches to count liquidity (3 USDC per launch)
        const { data: launches } = await supabase.from('token_launches').select('id');
        
        // 2. Fetch all swaps to count trading volume
        const { data: swaps } = await supabase.from('token_swaps').select('usdc_amount');
        
        const totalSwapsVolume = swaps?.reduce((acc, s) => acc + Number(s.usdc_amount), 0) || 0;
        const initialLiquidity = (launches?.length || 0) * 3;
        const dbVolume = totalSwapsVolume + initialLiquidity;
        setSupabaseVolume(dbVolume);

        // 3. Fetch total registered members from user_stats
        const { count: registeredCount } = await supabase.from('user_stats').select('*', { count: 'exact', head: true });

        // 4. Fetch ArcScan Global Testnet Stats
        let testnetTotalTx = 0;
        let testnetTodayTx = 0;
        try {
          const res = await fetch('https://testnet.arcscan.app/api/v2/stats');
          if (res.ok) {
            const scanData = await res.json();
            testnetTotalTx = Number(scanData.total_transactions) || 0;
            testnetTodayTx = Number(scanData.transactions_today) || 0;
          }
        } catch (err) {
          console.error("ArcScan API error:", err);
        }

        const { data: dailyData } = await supabase.rpc('get_daily_new_launches');

        // Base calculations to map huge testnet stats into realistic metrics
        const simulatedTotalTokens = Math.floor(testnetTotalTx / 10000); 
        const simulatedDailyTokens = Math.floor(testnetTodayTx / 5000);
        // Treat 1 testnet TX ~ $0.50 average volume equivalent for testnet realism
        const simulatedVolume = testnetTotalTx * 0.50;

        setArcScanStats({
          totalTokensBase: simulatedTotalTokens,
          dailyTokensBase: simulatedDailyTokens,
          volumeBase: simulatedVolume
        });

        setStats(prev => ({
          ...prev,
          tokens: (launches?.length || 0) + simulatedTotalTokens,
          newToday: (dailyData || 0) + simulatedDailyTokens,
          registered: registeredCount || 0,
          offline: Math.max(0, (registeredCount || 0) - prev.online)
        }));

      } catch (e) {
        console.error("Exception fetching stats:", e);
      }
    }

    fetchStats();

    // Set up Realtime listener to update stats live
    const dbChannel = supabase.channel('dashboard_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'token_launches' }, fetchStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'token_swaps' }, fetchStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_stats' }, fetchStats)
      .subscribe();

    // Set up Presence channel for online tracking
    const presenceChannel = supabase.channel('online_members');
    
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        // Count unique users across all clients
        const uniqueUsers = new Set();
        Object.values(state).forEach((presences: any) => {
          presences.forEach((p: any) => {
            if (p.user) uniqueUsers.add(p.user);
          });
        });
        
        const onlineCount = uniqueUsers.size;
        setStats(prev => ({
          ...prev,
          online: onlineCount,
          offline: Math.max(0, prev.registered - onlineCount)
        }));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && address) {
          await presenceChannel.track({
            user: address,
            online_at: new Date().toISOString()
          });
        }
      });

    return () => {
      supabase.removeChannel(dbChannel);
      supabase.removeChannel(presenceChannel);
    };
  }, [address]);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="stat-box p-6 flex items-center justify-between"
      >
        <div>
          <p className="text-[10px] text-[var(--text-secondary)] font-extrabold uppercase tracking-wider mb-1">Total Market Volume (USDC)</p>
          <h3 className="text-2xl font-black text-[var(--accent-cyan)] tracking-tight">${stats.volume}</h3>
        </div>
        <div className="h-10 w-10 rounded-lg border border-[var(--border-glow)] flex items-center justify-center flex-shrink-0 shadow-[var(--neon-shadow)] bg-[rgba(0,242,254,0.05)]">
          
          <Activity className="text-[var(--accent-cyan)]" size={20} />
        
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="stat-box p-6 flex items-center justify-between"
      >
        <div>
          <p className="text-[10px] text-[var(--text-secondary)] font-extrabold uppercase tracking-wider mb-1">Total Tokens Created</p>
          <h3 className="text-2xl font-black text-[var(--accent-cyan)] tracking-tight">{stats.tokens}</h3>
        </div>
        <div className="h-10 w-10 rounded-lg border border-[var(--border-glow)] flex items-center justify-center flex-shrink-0 shadow-[var(--neon-shadow)] bg-[rgba(0,242,254,0.05)]">
          
          <Coins className="text-[var(--accent-cyan)]" size={20} />
        
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="stat-box p-6 flex items-center justify-between"
      >
        <div>
          <p className="text-[10px] text-[var(--text-secondary)] font-extrabold uppercase tracking-wider mb-1">Daily New Launches</p>
          <h3 className="text-2xl font-black text-[var(--text-primary)] tracking-tight">{stats.newToday}</h3>
        </div>
        <div className="h-10 w-10 rounded-lg border border-[var(--border-glow)] flex items-center justify-center flex-shrink-0 shadow-[var(--neon-shadow)] bg-[rgba(0,242,254,0.05)]">
          
          <TrendingUp className="text-[var(--accent-cyan)]" size={20} />
        
        </div>
      </motion.div>
    </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="stat-box p-6 flex items-center justify-between"
        >
          <div>
            <p className="text-[10px] text-[var(--text-secondary)] font-extrabold uppercase tracking-wider mb-1">Registered Members</p>
            <h3 className="text-2xl font-black text-[var(--text-primary)] tracking-tight">{stats.registered}</h3>
          </div>
          <div className="h-10 w-10 rounded-lg border border-[var(--border-glow)] flex items-center justify-center flex-shrink-0 shadow-[var(--neon-shadow)] bg-[rgba(0,242,254,0.05)]">
          
            <Users className="text-[var(--text-secondary)]" size={20} />
          
        </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="stat-box p-6 flex items-center justify-between"
        >
          <div>
            <p className="text-[10px] text-[var(--accent-cyan)]/70 font-extrabold uppercase tracking-wider mb-1">Online Now</p>
            <div className="flex items-center gap-2">
              <h3 className="text-2xl font-black text-[var(--accent-cyan)] tracking-tight">{stats.online}</h3>
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            </div>
          </div>
          <div className="h-10 w-10 rounded-lg border border-[var(--border-glow)] flex items-center justify-center flex-shrink-0 shadow-[var(--neon-shadow)] bg-[rgba(0,242,254,0.05)]">
          
            <UserCheck className="text-[var(--accent-cyan)]" size={20} />
          
        </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="stat-box p-6 flex items-center justify-between"
        >
          <div>
            <p className="text-[10px] text-[var(--text-secondary)] font-extrabold uppercase tracking-wider mb-1">Offline</p>
            <h3 className="text-2xl font-black text-[var(--text-secondary)] tracking-tight">{stats.offline}</h3>
          </div>
          <div className="h-10 w-10 rounded-lg border border-[var(--border-glow)] flex items-center justify-center flex-shrink-0 shadow-[var(--neon-shadow)] bg-[rgba(0,242,254,0.05)]">
          
            <UserMinus className="text-[var(--text-secondary)]" size={20} />
          
        </div>
        </motion.div>
      </div>
    </>
  );
}
