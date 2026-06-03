'use client';

import React, { useState } from 'react';
import { Marketplace } from './Marketplace';
import { VendorProfile } from './VendorProfile';
import { InventoryManager } from './InventoryManager';
import { ShoppingCart, Store, Package } from 'lucide-react';

export function MarketHubView() {
  const [activeTab, setActiveTab] = useState<'market' | 'vendor' | 'inventory'>('market');

  return (
    <div className="animate-in fade-in duration-300 max-w-6xl mx-auto space-y-6">
      
      {/* Top Navigation Panel */}
      <div className="stat-box rounded-[32px] p-2 flex items-center gap-2 overflow-x-auto bg-[rgba(6,8,20,0.5)] backdrop-blur-xl">
        <button
          onClick={() => setActiveTab('market')}
          className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-3 px-4 rounded-[24px] text-sm font-black transition-all ${
            activeTab === 'market'
              ? 'bg-[var(--bg-card)] text-[var(--accent-cyan)] shadow-sm border border-[var(--border-dim)]'
              : 'text-[var(--text-secondary)] hover:text-white hover:bg-[rgba(255,255,255,0.02)]'
          }`}
        >
          <ShoppingCart size={16} /> Global Market
        </button>

        <button
          onClick={() => setActiveTab('inventory')}
          className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-3 px-4 rounded-[24px] text-sm font-black transition-all ${
            activeTab === 'inventory'
              ? 'bg-[var(--bg-card)] text-[var(--accent-cyan)] shadow-sm border border-[var(--border-dim)]'
              : 'text-[var(--text-secondary)] hover:text-white hover:bg-[rgba(255,255,255,0.02)]'
          }`}
        >
          <Package size={16} /> Inventory
        </button>

        <button
          onClick={() => setActiveTab('vendor')}
          className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-3 px-4 rounded-[24px] text-sm font-black transition-all ${
            activeTab === 'vendor'
              ? 'bg-[var(--bg-card)] text-[var(--accent-cyan)] shadow-sm border border-[var(--border-dim)]'
              : 'text-[var(--text-secondary)] hover:text-white hover:bg-[rgba(255,255,255,0.02)]'
          }`}
        >
          <Store size={16} /> Store Setup
        </button>
      </div>

      {/* Render Active View */}
      <div className="pt-2">
        {activeTab === 'market' && <Marketplace />}
        {activeTab === 'inventory' && <InventoryManager />}
        {activeTab === 'vendor' && <VendorProfile />}
      </div>

    </div>
  );
}
