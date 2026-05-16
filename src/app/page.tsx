'use client';

import { useState } from 'react';
import { Header } from '@/components/Header';
import { NetworkGuard } from '@/components/NetworkGuard';
import { DashboardStats } from '@/components/DashboardStats';
import { LaunchForm } from '@/components/LaunchForm';
import { TradingPanel } from '@/components/TradingPanel';
import { Leaderboard } from '@/components/Leaderboard';
import { PriceChart } from '@/components/PriceChart';
import { TransactionHistory } from '@/components/TransactionHistory';

export default function Home() {
  const [selectedToken, setSelectedToken] = useState<any>(null);

  return (
    <div className="min-h-screen bg-transparent">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <Header />
        <NetworkGuard />
        
        <main>
          {/* Global Dashboard Stats */}
          <DashboardStats /> 

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Token Launch & Trading */}
            <div className="lg:col-span-1 space-y-8">
              {selectedToken ? (
                <TradingPanel token={selectedToken} />
              ) : (
                <LaunchForm />
              )}
            </div>

            {/* Right Column - Trading & Analytics */}
            <div className="lg:col-span-2 space-y-8">
              <PriceChart selectedToken={selectedToken} />
              <TransactionHistory tokenAddress={selectedToken?.token_address} />
              <div className="h-[500px]">
                <Leaderboard onSelectToken={setSelectedToken} />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
