'use client';

/**
 * ArcSlots Page Route - /slots
 * Isolated game view interface - completely independent from main dashboard
 * Preserves core Web3Provider architecture
 */

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { SlotMachine } from '@/components/arcslots/SlotMachine';
import { SlotReel } from '@/components/arcslots/SlotReel';
import { PoolDisplay } from '@/components/arcslots/PoolDisplay';
import { StatsBar } from '@/components/arcslots/StatsBar';
import { GiftBox } from '@/components/arcslots/GiftBox';
import { ArrowLeft, Gift } from 'lucide-react';
import Link from 'next/link';

export default function SlotsPage() {
  const { isConnected } = useAccount();
  const [isSpinning, setIsSpinning] = useState(false);
  const [lastSymbols, setLastSymbols] = useState<string[]>([]);
  const [isGiftBoxOpen, setIsGiftBoxOpen] = useState(false);

  const handleSpinComplete = (symbols: string[], reward: number) => {
    setLastSymbols(symbols);
    setIsSpinning(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-black">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      {/* Content Wrapper */}
      <div className="relative z-10">
        {/* Header */}
        <header className="sticky top-0 z-20 border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-md">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Dashboard
            </Link>

            <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
              🎰 ArcSlots
            </h1>

            <button
              onClick={() => setIsGiftBoxOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-500 hover:to-yellow-400 text-white font-semibold transition-all shadow-lg hover:shadow-yellow-500/30"
            >
              <Gift className="w-5 h-5" />
              Rewards
            </button>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-12">
          {!isConnected ? (
            /* Connection Alert */
            <div className="max-w-md mx-auto p-8 rounded-xl bg-slate-800 border border-amber-500 text-center">
              <p className="text-amber-200 font-semibold mb-2">Wallet Required</p>
              <p className="text-slate-400 text-sm">
                Connect your wallet to access ArcSlots and start earning ARC rewards.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column - Game */}
              <div className="lg:col-span-2 space-y-8">
                {/* Slot Reel Animation */}
                <SlotReel
                  isSpinning={isSpinning}
                  finalSymbols={lastSymbols}
                  onSpinComplete={() => setIsSpinning(false)}
                />

                {/* Slot Machine Controller */}
                <SlotMachine
                  disabled={isSpinning}
                  onSpinComplete={handleSpinComplete}
                />

                {/* Game Rules & Info */}
                <div className="p-6 rounded-xl bg-slate-800/50 border border-slate-700">
                  <h3 className="text-lg font-bold text-white mb-4">How to Play</h3>
                  <div className="space-y-3 text-sm text-slate-300">
                    <p>
                      <span className="font-semibold text-cyan-400">1. Select Spins:</span> Choose 1-100 spins per transaction
                    </p>
                    <p>
                      <span className="font-semibold text-cyan-400">2. Pay Fee:</span> Each spin costs 0.1 USDC (6 decimals)
                    </p>
                    <p>
                      <span className="font-semibold text-cyan-400">3. Win ARC:</span> Matching symbols earn multiplied ARC rewards (18 decimals)
                    </p>
                    <p>
                      <span className="font-semibold text-cyan-400">4. Claim:</span> Use the Rewards button to claim your pending winnings
                    </p>
                  </div>
                </div>

                {/* Prize Table */}
                <div className="p-6 rounded-xl bg-slate-800/50 border border-slate-700">
                  <h3 className="text-lg font-bold text-white mb-4">Prize Multipliers</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="p-3 bg-slate-700/50 rounded border border-slate-600">
                      <p className="text-cyan-300 font-semibold">🎯🎯🎯</p>
                      <p className="text-slate-400">10x</p>
                    </div>
                    <div className="p-3 bg-slate-700/50 rounded border border-slate-600">
                      <p className="text-cyan-300 font-semibold">💎💎💎</p>
                      <p className="text-slate-400">50x</p>
                    </div>
                    <div className="p-3 bg-slate-700/50 rounded border border-slate-600">
                      <p className="text-cyan-300 font-semibold">🏆🏆🏆</p>
                      <p className="text-slate-400">100x</p>
                    </div>
                    <div className="p-3 bg-slate-700/50 rounded border border-slate-600">
                      <p className="text-cyan-300 font-semibold">🌟🌟🌟</p>
                      <p className="text-slate-400">200x</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Stats & Pools */}
              <div className="space-y-8">
                {/* Live Stats */}
                <StatsBar />

                {/* User Pool & Global Stats */}
                <PoolDisplay refreshInterval={5000} />
              </div>
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-700/50 bg-slate-900/50 mt-20">
          <div className="container mx-auto px-4 py-8 text-center text-sm text-slate-500">
            <p>🎰 ArcSlots on Arc Testnet • Secure • Isolated • Production-Ready</p>
            <p className="mt-2">
              Decimal Partition: USDC (6) | ARC Rewards (18) • Zero Regression Policy
            </p>
          </div>
        </footer>
      </div>

      {/* Rewards Modal */}
      <GiftBox
        isOpen={isGiftBoxOpen}
        onClose={() => setIsGiftBoxOpen(false)}
        onClaimSuccess={() => {
          // Refresh stats after successful claim
        }}
      />
    </div>
  );
}
