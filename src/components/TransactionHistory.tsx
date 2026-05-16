'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { History, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

export function TransactionHistory({ tokenAddress }: { tokenAddress?: string }) {
  const [swaps, setSwaps] = useState<any[]>([]);

  useEffect(() => {
    async function fetchSwaps() {
      let query = supabase
        .from('token_swaps')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (tokenAddress) {
        query = query.eq('token_address', tokenAddress);
      }

      const { data } = await query;
      if (data) setSwaps(data);
    }

    fetchSwaps();

    const channel = supabase.channel('swaps_history')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'token_swaps' }, fetchSwaps)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tokenAddress]);

  return (
    <div className="glass-panel p-6 overflow-hidden">
      <div className="flex items-center gap-2 mb-6">
        <History className="text-cyan-400" size={20} />
        <h3 className="font-bold text-white">Live Transactions</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-gray-500 border-b border-gray-800">
              <th className="pb-3 font-medium">Type</th>
              <th className="pb-3 font-medium">Wallet</th>
              <th className="pb-3 font-medium text-right">USDC</th>
              <th className="pb-3 font-medium text-right">Tokens</th>
              <th className="pb-3 font-medium text-right">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {swaps.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-gray-600 italic">No transactions yet</td>
              </tr>
            ) : (
              swaps.map((swap) => (
                <tr key={swap.id} className="group hover:bg-white/5 transition-colors">
                  <td className="py-3">
                    <span className={`flex items-center gap-1 font-bold ${swap.is_buy ? 'text-green-400' : 'text-red-400'}`}>
                      {swap.is_buy ? <ArrowUpRight size={14}/> : <ArrowDownLeft size={14}/>}
                      {swap.is_buy ? 'BUY' : 'SELL'}
                    </span>
                  </td>
                  <td className="py-3 font-mono text-gray-400">
                    {swap.user_address.slice(0, 6)}...{swap.user_address.slice(-4)}
                  </td>
                  <td className="py-3 text-right font-mono text-white">
                    {Number(swap.usdc_amount).toFixed(2)}
                  </td>
                  <td className="py-3 text-right font-mono text-cyan-400">
                    {Number(swap.token_amount).toLocaleString()}
                  </td>
                  <td className="py-3 text-right text-gray-500 text-xs">
                    {new Date(swap.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
