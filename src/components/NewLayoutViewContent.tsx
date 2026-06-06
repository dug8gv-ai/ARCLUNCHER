'use client';

/**
 * NewLayoutViewContent
 * --------------------
 * Renders the correct feature view inside the ArcNewLayout center column.
 * All props mirror the values already available in page.tsx.
 */

import React from 'react';
import { BuilderDashboard }   from '@/components/builder/BuilderDashboard';
import { UserProfileDrawer }  from '@/components/arcpay/UserProfileDrawer';
import { ArcSlotsDashboard }  from '@/components/arcslots/ArcSlotsDashboard';
import { MarketHubView }      from '@/components/markethub/MarketHubView';
import { FreelanceHub }       from '@/components/FreelanceHub';
import { PredictionDashboard }from '@/components/PredictionDashboard';
import { AffiliatesView }     from '@/components/AffiliatesView';
import { DiscreteTasks }      from '@/components/airdrop/DiscreteTasks';
import { DashboardStats }     from '@/components/DashboardStats';
import { LaunchForm }         from '@/components/LaunchForm';
import { TradingPanel }       from '@/components/TradingPanel';
import { TransactionHistory } from '@/components/TransactionHistory';
import { Leaderboard }        from '@/components/Leaderboard';
import { PriceChart }         from '@/components/PriceChart';
import { TrendingUp, Coins, Info } from 'lucide-react';

interface Props {
  currentView:       string;
  selectedToken:     any;
  handleSelectToken: (t: any) => void;
  isConnected:       boolean;
  userAddress?:      string;
  profileName:       string;
  checkinLoading:    boolean;
  checkinStats:      { checkin_count: number; streak_count: number; missed_count: number; last_checkin: string | null } | null;
  handleDailyCheckin: () => void;
  usdcWalletBalance:  number;
  eurcWalletBalance:  number;
  cirbtcWalletBalance:number;
  totalLockedUSD:     number;
  lockedUSDC:         number;
  lockedEURC:         number;
  isLockerOpen:       boolean;
  setIsLockerOpen:    (v: boolean) => void;
}

export function NewLayoutViewContent({
  currentView,
  selectedToken,
  handleSelectToken,
  isConnected,
  profileName,
  checkinLoading,
  checkinStats,
  handleDailyCheckin,
  usdcWalletBalance,
  eurcWalletBalance,
  cirbtcWalletBalance,
}: Props) {

  return (
    <div className="space-y-6">

      {/* ── Launcher ── */}
      {currentView === 'launcher' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Welcome */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl p-5"
            style={{ background: 'rgba(245,197,66,0.04)', border: '1px solid rgba(245,197,66,0.12)' }}>
            <div>
              <h2 className="text-xl font-black" style={{ color: 'var(--bd-accent-gold)' }}>Hello, {profileName} 👋</h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>Explore active markets, launch tokens, and claim points.</p>
            </div>
            {isConnected && (
              <button
                onClick={handleDailyCheckin}
                disabled={checkinLoading || !!(checkinStats?.last_checkin && new Date(checkinStats.last_checkin).toDateString() === new Date().toDateString())}
                className="bd-btn-primary px-4 py-2 rounded-xl text-xs font-bold"
              >
                {checkinLoading ? 'Checking In…' :
                 checkinStats?.last_checkin && new Date(checkinStats.last_checkin).toDateString() === new Date().toDateString()
                   ? '✓ Checked In Today'
                   : '📅 Daily Check-in'
                }
              </button>
            )}
          </div>
          <DashboardStats />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1"><LaunchForm /></div>
            <div className="lg:col-span-2">
              <Leaderboard onSelectToken={handleSelectToken} />
            </div>
          </div>
        </div>
      )}

      {/* ── Trade ── */}
      {currentView === 'trade' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {selectedToken ? (
            <>
              <div className="flex items-center justify-between p-4 rounded-2xl"
                style={{ background: 'rgba(245,197,66,0.04)', border: '1px solid rgba(245,197,66,0.12)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center"
                    style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(245,197,66,0.2)' }}>
                    {selectedToken.image_url
                      ? <img src={selectedToken.image_url} alt="" className="w-full h-full object-contain p-0.5" />
                      : <TrendingUp size={16} style={{ color: 'var(--bd-accent-gold)' }} />}
                  </div>
                  <div>
                    <h3 className="font-black text-white text-sm">{selectedToken.name}</h3>
                    <span className="text-[10px] font-mono" style={{ color: 'var(--bd-accent-gold)' }}>{selectedToken.ticker}</span>
                  </div>
                </div>
                <button onClick={() => handleSelectToken(null)} className="text-xs px-3 py-1.5 rounded-xl font-bold"
                  style={{ background: 'rgba(245,197,66,0.08)', color: 'var(--bd-accent-gold)', border: '1px solid rgba(245,197,66,0.2)' }}>
                  ← Markets
                </button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1"><TradingPanel token={selectedToken} /></div>
                <div className="lg:col-span-2 space-y-6">
                  <PriceChart selectedToken={selectedToken} />
                  <TransactionHistory tokenAddress={selectedToken.token_address} />
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-2xl p-6 space-y-4"
              style={{ background: 'rgba(245,197,66,0.04)', border: '1px solid rgba(245,197,66,0.12)' }}>
              <div className="text-center py-4">
                <TrendingUp className="mx-auto mb-3" size={28} style={{ color: 'var(--bd-accent-gold)' }} />
                <h2 className="text-lg font-black" style={{ color: 'var(--bd-accent-gold)' }}>Meme Markets Trading Desk</h2>
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Select a token to open live charts and trading.</p>
              </div>
              <Leaderboard onSelectToken={handleSelectToken} />
            </div>
          )}
        </div>
      )}

      {/* ── Social Pay / ArcPay ── */}
      {currentView === 'social-pay' && (
        <div className="animate-in fade-in duration-200">
          <UserProfileDrawer />
        </div>
      )}

      {/* ── Market Hub ── */}
      {currentView === 'markethub' && (
        <div className="animate-in fade-in duration-200">
          <MarketHubView />
        </div>
      )}

      {/* ── Gigs / Freelance ── */}
      {currentView === 'gigs' && (
        <div className="animate-in fade-in duration-200">
          <FreelanceHub />
        </div>
      )}

      {/* ── Prediction Market ── */}
      {currentView === 'prediction-market' && (
        <div className="animate-in fade-in duration-200">
          <PredictionDashboard />
        </div>
      )}

      {/* ── ArcSlots ── */}
      {currentView === 'slots' && (
        <div className="animate-in fade-in duration-200">
          <ArcSlotsDashboard />
        </div>
      )}

      {/* ── Builder Dashboard ── */}
      {currentView === 'builder' && (
        <div className="animate-in fade-in duration-200">
          <BuilderDashboard />
        </div>
      )}

      {/* ── Leaderboard ── */}
      {currentView === 'leaderboard' && (
        <div className="animate-in fade-in duration-200">
          <Leaderboard onSelectToken={handleSelectToken} />
        </div>
      )}

      {/* ── Affiliates ── */}
      {currentView === 'affiliates' && (
        <div className="animate-in fade-in duration-200">
          <AffiliatesView />
        </div>
      )}

      {/* ── Earn ── */}
      {currentView === 'earn' && (
        <div className="animate-in fade-in duration-200 space-y-6">
          <DiscreteTasks onPointsEarned={() => {}} />
        </div>
      )}

      {/* ── Wallet / Staking / Yield ── */}
      {(currentView === 'wallet' || currentView === 'staking') && (
        <div className="animate-in fade-in duration-200">
          <p className="text-center py-12 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Wallet & Staking features available in the main layout.
          </p>
        </div>
      )}

      {/* ── Guide ── */}
      {currentView === 'guide' && (
        <div className="animate-in fade-in duration-200">
          <p className="text-center py-12 text-sm" style={{ color: 'var(--text-secondary)' }}>User Guide</p>
        </div>
      )}

    </div>
  );
}
