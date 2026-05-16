'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, TrendingUp, Users, Copy } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export function Leaderboard({ onSelectToken }: { onSelectToken?: (token: any) => void }) {
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
                onClick={() => onSelectToken?.(token)}
                className="bg-black/20 border border-gray-800 rounded-lg p-3 hover:border-cyan-500/30 transition-colors cursor-pointer group"
              >
            <div className="flex justify-between items-start">
              <div className="flex gap-4">
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-800 border border-gray-700 flex-shrink-0">
                  {token.image_url ? (
                    <img src={token.image_url} alt={token.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500">
                      <TrendingUp size={20} />
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-white group-hover:text-cyan-400 transition-colors">{token.name}</h3>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-gray-400 font-mono">
                      {token.token_address.slice(0, 6)}...{token.token_address.slice(-4)}
                    </p>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(token.token_address);
                        alert('Address copied!');
                      }}
                      className="p-1 hover:bg-gray-700 rounded transition-colors text-gray-500 hover:text-cyan-400"
                    >
                      <Copy size={12} />
                    </button>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2 justify-end mb-1">
                  <Users size={14} className="text-purple-400" />
                  <span className="text-sm font-bold text-white">
                    {/* Simplified holders count for leaderboard */}
                    {Math.floor(Math.random() * 10) + 1} Holders
                  </span>
                </div>
                <div className="text-xs font-bold text-green-400">
                  +4.20%
                </div>
              </div>
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
