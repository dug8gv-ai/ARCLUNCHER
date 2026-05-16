'use client';

import { useState } from 'react';
import { Header } from '@/components/Header';
import { NetworkGuard } from '@/components/NetworkGuard';
import { DashboardStats } from '@/components/DashboardStats';
import { LaunchForm } from '@/components/LaunchForm';
import { Leaderboard } from '@/components/Leaderboard';
import { PriceChart } from '@/components/PriceChart';

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
            {/* Left Column - Token Launch Mechanism */}
            <div className="lg:col-span-1 space-y-8">
              <LaunchForm />
              {/* Future Trading Panel will go here */}
            </div>

            {/* Right Column - Trading & Analytics */}
            <div className="lg:col-span-2 space-y-8">
              <PriceChart selectedToken={selectedToken} />
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
