'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, Coins, TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export function DashboardStats() {
  const [stats, setStats] = useState({
    volume: "0",
    tokens: 0,
    newToday: 0
  });

  useEffect(() => {
    async function fetchStats() {
      try {
        // Fetch total market volume from RPC or fallback to manual calculation
        const { data: volumeData } = await supabase.rpc('get_global_market_volume');
        
        // Manual Fallback if RPC returns 0
        const { data: launches } = await supabase.from('token_launches').select('id');
        const { data: swaps } = await supabase.from('token_swaps').select('usdc_amount');
        
        const launchFeesInUSDC = (launches?.length || 0) * 4;
        const swapVolumeInUSDC = swaps?.reduce((acc, curr) => acc + Number(curr.usdc_amount), 0) || 0;
        const manualVolume = (launchFeesInUSDC + swapVolumeInUSDC).toLocaleString();

        const { data: dailyData } = await supabase.rpc('get_daily_new_launches');
        const { count } = await supabase.from('token_launches').select('*', { count: 'exact', head: true });

        setStats({
          volume: volumeData && Number(volumeData) > 0 ? (Number(volumeData) / 1000000).toLocaleString() : manualVolume,
          tokens: count || 0,
          newToday: dailyData || 0
        });

      } catch (e) {
        console.error("Exception fetching stats:", e);
      }
    }

    fetchStats();

    // Set up Realtime listener to update stats live
    const channel = supabase.channel('dashboard_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'token_launches' }, fetchStats)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'token_swaps' }, fetchStats)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-panel p-6 flex items-center justify-between"
      >
        <div>
          <p className="text-sm text-gray-400 mb-1">Total Market Volume (USDC)</p>
          <h3 className="text-3xl font-bold neon-text-cyan">${stats.volume}</h3>
        </div>
        <div className="h-12 w-12 rounded-full bg-cyan-900/30 flex items-center justify-center border border-cyan-500/30">
          <Activity className="text-cyan-400" />
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-panel p-6 flex items-center justify-between"
      >
        <div>
          <p className="text-sm text-gray-400 mb-1">Total Tokens Created</p>
          <h3 className="text-3xl font-bold neon-text-gold">{stats.tokens}</h3>
        </div>
        <div className="h-12 w-12 rounded-full bg-yellow-900/30 flex items-center justify-center border border-yellow-500/30">
          <Coins className="text-yellow-400" />
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-panel p-6 flex items-center justify-between"
      >
        <div>
          <p className="text-sm text-gray-400 mb-1">Daily New Launches</p>
          <h3 className="text-3xl font-bold text-white">{stats.newToday}</h3>
        </div>
        <div className="h-12 w-12 rounded-full bg-purple-900/30 flex items-center justify-center border border-purple-500/30">
          <TrendingUp className="text-purple-400" />
        </div>
      </motion.div>
    </div>
  );
}
