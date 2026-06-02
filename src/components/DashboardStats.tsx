'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, Coins, TrendingUp, Users, UserCheck, UserMinus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAccount } from 'wagmi';

export function DashboardStats() {
  const { address } = useAccount();
  const [stats, setStats] = useState({
    volume: "0",
    tokens: 0,
    newToday: 0,
    registered: 0,
    online: 0,
    offline: 0
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

        // 3. Fetch total registered members from user_stats
        const { count: registeredCount } = await supabase.from('user_stats').select('*', { count: 'exact', head: true });

        const { data: dailyData } = await supabase.rpc('get_daily_new_launches');

        setStats(prev => ({
          ...prev,
          volume: grandTotal,
          tokens: launches?.length || 0,
          newToday: dailyData || 0,
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
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-panel p-6 flex items-center justify-between bg-white border border-slate-200/80"
        >
          <div>
            <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider mb-1">Registered Members</p>
            <h3 className="text-2xl font-black text-slate-800 tracking-tight">{stats.registered}</h3>
          </div>
          <div className="h-11 w-11 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 flex-shrink-0">
            <Users className="text-slate-600" size={20} />
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass-panel p-6 flex items-center justify-between bg-emerald-50/50 border border-emerald-200/80"
        >
          <div>
            <p className="text-[10px] text-emerald-600/70 font-extrabold uppercase tracking-wider mb-1">Online Now</p>
            <div className="flex items-center gap-2">
              <h3 className="text-2xl font-black text-emerald-600 tracking-tight">{stats.online}</h3>
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            </div>
          </div>
          <div className="h-11 w-11 rounded-xl bg-emerald-100 flex items-center justify-center border border-emerald-200 flex-shrink-0">
            <UserCheck className="text-emerald-600" size={20} />
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="glass-panel p-6 flex items-center justify-between bg-white border border-slate-200/80"
        >
          <div>
            <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider mb-1">Offline</p>
            <h3 className="text-2xl font-black text-slate-400 tracking-tight">{stats.offline}</h3>
          </div>
          <div className="h-11 w-11 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 flex-shrink-0 grayscale opacity-50">
            <UserMinus className="text-slate-400" size={20} />
          </div>
        </motion.div>
      </div>
    </>
  );
}
