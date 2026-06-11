'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAccount } from 'wagmi';
import { Loader2, PackageOpen, ExternalLink, Clock } from 'lucide-react';
import { ARCSLOTS_TOKENS } from '@/lib/arcslots/arcslots.constants';

export function BuyerOrders() {
  const { address } = useAccount();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (address) {
      fetchOrders();
    } else {
      setLoading(false);
    }
  }, [address]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('market_orders')
        .select(`
          *,
          market_products (
            name,
            images
          ),
          vendor_profiles:vendor_wallet (
            store_name
          )
        `)
        .eq('buyer_wallet', address?.toLowerCase())
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!address) {
    return <div className="stat-box p-12 text-center text-[var(--text-secondary)] font-bold">Please connect your wallet to view your orders.</div>;
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[var(--accent-cyan)] size-10" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="stat-box rounded-[32px] p-6 bg-[rgba(6,8,20,0.8)] border border-[var(--border-dim)] flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-[rgba(0,242,254,0.1)] flex items-center justify-center text-[var(--accent-cyan)] border border-[rgba(0,242,254,0.2)]">
          <PackageOpen size={24} />
        </div>
        <div>
          <h2 className="text-xl font-black text-[var(--text-primary)]">My Orders</h2>
          <p className="text-xs text-[var(--text-secondary)] font-semibold mt-0.5">Track your purchases and view order history</p>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="stat-box p-12 text-center text-[var(--text-secondary)] border border-[var(--border-dim)]">
          <PackageOpen className="mx-auto mb-4 opacity-20 size-12" />
          <p className="font-bold">You haven't placed any orders yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map(order => (
            <div key={order.id} className="stat-box rounded-[24px] p-5 bg-[var(--bg-elevated)] border border-[var(--border-dim)] flex flex-col md:flex-row gap-6">
              
              <div className="flex gap-4 flex-1">
                <img src={order.market_products?.images?.[0] || ''} className="w-20 h-20 rounded-xl object-cover bg-black" alt="" />
                <div>
                  <h4 className="font-black text-white">{order.market_products?.name || 'Unknown Product'}</h4>
                  <p className="text-xs text-[var(--text-secondary)] mt-1 mb-2">Vendor: {order.vendor_profiles?.store_name}</p>
                  <span className="bg-[rgba(255,255,255,0.05)] px-2 py-1 rounded text-[10px] font-bold text-[var(--text-secondary)] border border-[var(--border-dim)]">
                    Qty: {order.quantity}
                  </span>
                </div>
              </div>

              <div className="flex flex-row md:flex-col justify-between items-end md:items-end md:justify-center border-t md:border-t-0 md:border-l border-[var(--border-dim)] pt-4 md:pt-0 md:pl-6 md:min-w-[200px]">
                <div className="text-left md:text-right">
                  <span className="text-[10px] text-[var(--text-secondary)] font-semibold uppercase block mb-1">Total Paid</span>
                  <span className="text-xl font-black text-[var(--accent-cyan)]">${order.total_amount}</span>
                </div>
                
                <div className="flex flex-col items-end gap-2 mt-3">
                  <span className="text-[10px] text-[var(--text-secondary)] flex items-center gap-1">
                    <Clock size={10} /> {new Date(order.created_at).toLocaleDateString()}
                  </span>
                  <a 
                    href={`https://explorer.testnet.arcanum.network/tx/${order.tx_hash}`}
                    target="_blank" rel="noreferrer"
                    className="text-[10px] font-bold text-[var(--text-primary)] hover:text-[var(--accent-cyan)] flex items-center gap-1"
                  >
                    View TX <ExternalLink size={10} />
                  </a>
                </div>
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
}
