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
        // 1. Fetch all launches to count liquidity (3 USDC per launch)
        const { data: launches } = await supabase.from('token_launches').select('id');
        
        // 2. Fetch all swaps to count trading volume
        const { data: swaps } = await supabase.from('token_swaps').select('usdc_amount');
        
        const totalSwapsVolume = swaps?.reduce((acc, s) => acc + Number(s.usdc_amount), 0) || 0;
        const initialLiquidity = (launches?.length || 0) * 3;
        const grandTotal = (totalSwapsVolume + initialLiquidity).toLocaleString(undefined, { maximumFractionDigits: 2 });

        const { data: dailyData } = await supabase.rpc('get_daily_new_launches');

        setStats({
          volume: grandTotal,
          tokens: launches?.length || 0,
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
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-panel p-6 flex items-center justify-between bg-white border border-slate-200/80"
      >
        <div>
          <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider mb-1">Total Market Volume (USDC)</p>
          <h3 className="text-2xl font-black text-blue-600 tracking-tight">${stats.volume}</h3>
        </div>
        <div className="h-11 w-11 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100 flex-shrink-0">
          <Activity className="text-blue-600" size={20} />
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-panel p-6 flex items-center justify-between bg-white border border-slate-200/80"
      >
        <div>
          <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider mb-1">Total Tokens Created</p>
          <h3 className="text-2xl font-black text-amber-600 tracking-tight">{stats.tokens}</h3>
        </div>
        <div className="h-11 w-11 rounded-xl bg-amber-50 flex items-center justify-center border border-amber-100 flex-shrink-0">
          <Coins className="text-amber-600" size={20} />
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-panel p-6 flex items-center justify-between bg-white border border-slate-200/80"
      >
        <div>
          <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider mb-1">Daily New Launches</p>
          <h3 className="text-2xl font-black text-slate-800 tracking-tight">{stats.newToday}</h3>
        </div>
        <div className="h-11 w-11 rounded-xl bg-indigo-50 flex items-center justify-center border border-indigo-100 flex-shrink-0">
          <TrendingUp className="text-indigo-600" size={20} />
        </div>
      </motion.div>
    </div>
  );
}
