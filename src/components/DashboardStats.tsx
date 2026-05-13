'use client';

import { motion } from 'framer-motion';
import { Activity, Coins, TrendingUp } from 'lucide-react';

export function DashboardStats() {
  // In a real app, these would be fetched via Supabase listeners
  const stats = {
    volume: "1,245,600",
    tokens: 432,
    newToday: 24
  };

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
