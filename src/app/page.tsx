import { Header } from '@/components/Header';
import { NetworkGuard } from '@/components/NetworkGuard';
import { DashboardStats } from '@/components/DashboardStats';
import { LaunchForm } from '@/components/LaunchForm';
import { Leaderboard } from '@/components/Leaderboard';
import { PriceChart } from '@/components/PriceChart';

export default function Home() {
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
            <div className="lg:col-span-1">
              <LaunchForm />
            </div>

            {/* Right Column - Trading & Analytics */}
            <div className="lg:col-span-2 space-y-8">
              <PriceChart />
              <div className="h-[400px]">
                <Leaderboard />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
