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
        .order('timestamp', { ascending: false })

        .limit(10);
      
      if (tokenAddress) {
        query = query.eq('token_address', tokenAddress.toLowerCase());
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
    <div className="glass-panel p-6 card overflow-hidden">
      <div className="flex items-center gap-2 mb-6">
        <History className="text-[var(--accent-cyan)]" size={20} />
        <h3 className="font-extrabold text-[var(--text-primary)] text-base">Live Transactions</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-semibold">
          <thead>
            <tr className="text-[var(--text-secondary)] border-b border-[var(--border-dim)]">
              <th className="pb-3 font-bold uppercase tracking-wider">Type</th>
              <th className="pb-3 font-bold uppercase tracking-wider">Wallet</th>
              <th className="pb-3 font-bold uppercase tracking-wider text-right">USDC</th>
              <th className="pb-3 font-bold uppercase tracking-wider text-right">Tokens</th>
              <th className="pb-3 font-bold uppercase tracking-wider text-right">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-[var(--text-secondary)]">
            {swaps.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-[var(--text-secondary)] italic">No transactions yet</td>
              </tr>
            ) : (
              swaps.map((swap) => (
                <tr key={swap.id} className="group hover:bg-slate-50 transition-colors">
                  <td className="py-3">
                    <span className={`flex items-center gap-1 font-bold ${swap.is_buy ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {swap.is_buy ? <ArrowUpRight size={14}/> : <ArrowDownLeft size={14}/>}
                      {swap.is_buy ? 'BUY' : 'SELL'}
                    </span>
                  </td>
                  <td className="py-3 font-mono text-[var(--text-secondary)]">
                    {swap.user_address.slice(0, 6)}...{swap.user_address.slice(-4)}
                  </td>
                  <td className="py-3 text-right font-mono text-[var(--text-primary)]">
                    {Number(swap.usdc_amount).toFixed(2)}
                  </td>
                  <td className="py-3 text-right font-mono text-[var(--accent-cyan)]">
                    {Number(swap.token_amount).toLocaleString()}
                  </td>
                  <td className="py-3 text-right text-[var(--text-secondary)] text-xs font-medium">
                    {new Date(swap.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
