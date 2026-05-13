'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, TrendingUp, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export function Leaderboard() {
  const [activeTab, setActiveTab] = useState<'gainers' | 'trending'>('gainers');
  const [tokens, setTokens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTokens() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('token_launches')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10);

        if (error) throw error;
        setTokens(data || []);
      } catch (e) {
        console.error("Error fetching tokens:", e);
      } finally {
        setLoading(false);
      }
    }

    fetchTokens();

    const channel = supabase.channel('leaderboard_updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'token_launches' }, fetchTokens)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="glass-panel p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Trophy className="text-yellow-400" size={20} />
          Leaderboard
        </h2>
        
        <div className="flex bg-black/40 rounded-lg p-1">
          <button 
            onClick={() => setActiveTab('gainers')}
            className={`px-4 py-1.5 rounded-md text-sm transition-all ${
              activeTab === 'gainers' ? 'bg-cyan-900/50 text-cyan-400 font-medium' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Top Gainers
          </button>
          <button 
            onClick={() => setActiveTab('trending')}
            className={`px-4 py-1.5 rounded-md text-sm transition-all ${
              activeTab === 'trending' ? 'bg-purple-900/50 text-purple-400 font-medium' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Trending
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto pr-2">
        <div className="space-y-3">
          {loading ? (
            <p className="text-center text-gray-500 py-10">Loading real-time tokens...</p>
          ) : tokens.length === 0 ? (
            <p className="text-center text-gray-500 py-10 text-sm">No tokens launched yet.</p>
          ) : (
            tokens.map((token, i) => (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                key={token.id} 
                className="bg-black/20 border border-gray-800 rounded-lg p-4 flex items-center justify-between hover:border-cyan-500/30 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  {token.image_url ? (
                    <img src={token.image_url} alt={token.ticker} className="w-10 h-10 rounded-full object-cover border border-gray-700" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center font-bold text-sm border border-gray-700">
                      {token.ticker.substring(0,2)}
                    </div>
                  )}
                  <div>
                    <h4 className="font-bold text-white leading-tight">{token.ticker}</h4>
                    <p className="text-xs text-gray-500">{token.name}</p>
                  </div>
                </div>
                
                <div className="text-right">
                  <p className="font-mono text-sm text-white">4.0 USDC</p>
                  <p className="text-xs text-cyan-400 font-medium">New</p>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
      
      <button className="w-full mt-4 py-2 border border-gray-700 rounded-lg text-sm text-gray-400 hover:text-white hover:border-gray-500 transition-colors">
        View All Tokens
      </button>
    </div>
  );
}
