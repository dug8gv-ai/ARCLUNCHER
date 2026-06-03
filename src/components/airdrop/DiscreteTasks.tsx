'use client';

import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { supabase } from '@/lib/supabase';
import { checkFounderVolumeTask, checkLiquidityTraderTask, processDailyCheckIn } from '@/lib/points/AirdropTasksLogic';
import { Loader2, TrendingUp, RefreshCw, CalendarCheck, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export function DiscreteTasks({ onPointsEarned }: { onPointsEarned: (points: number) => void }) {
  const { address } = useAccount();
  
  const [strikeState, setStrikeState] = useState({
    founderRewarded: false,
    traderRewarded: false,
    streak: 0
  });
  
  const [loadingTask, setLoadingTask] = useState<string | null>(null);

  useEffect(() => {
    if (address) {
      supabase.from('user_point_strikes')
        .select('*')
        .eq('wallet_address', address)
        .single()
        .then(({ data }) => {
          if (data) {
            setStrikeState({
              founderRewarded: data.founder_volume_rewarded,
              traderRewarded: data.trader_challenge_rewarded,
              streak: data.current_streak || 0
            });
          }
        });
    }
  }, [address]);

  const handleFounderTask = async () => {
    if (!address) return toast.error('Connect wallet');
    setLoadingTask('founder');
    
    // Replace with dynamic contract input in real scenario
    const testContract = '0x0000000000000000000000000000000000000000'; 
    const success = await checkFounderVolumeTask(address, testContract);
    
    if (success) {
      toast.success('+1000 Points: Founder Volume Reached!');
      onPointsEarned(1000);
      setStrikeState(prev => ({ ...prev, founderRewarded: true }));
    } else {
      toast.error('Task requirements not met yet or already claimed.');
    }
    setLoadingTask(null);
  };

  const handleTraderTask = async () => {
    if (!address) return toast.error('Connect wallet');
    setLoadingTask('trader');
    
    const targetToken = '0x0000000000000000000000000000000000000000';
    const success = await checkLiquidityTraderTask(address, targetToken);
    
    if (success) {
      toast.success('+1000 Points: Trader Challenge Completed!');
      onPointsEarned(1000);
      setStrikeState(prev => ({ ...prev, traderRewarded: true }));
    } else {
      toast.error('Trading activity on target token not detected.');
    }
    setLoadingTask(null);
  };

  const handleCheckIn = async () => {
    if (!address) return toast.error('Connect wallet');
    setLoadingTask('checkin');
    
    const result = await processDailyCheckIn(address);
    setStrikeState(prev => ({ ...prev, streak: result.currentStreak }));
    
    if (result.pointsEarned > 0) {
      toast.success(`+200 Points: 7-Day Strike Completed!`);
      onPointsEarned(result.pointsEarned);
    } else {
      toast.success(`Checked in! Current streak: ${result.currentStreak} day(s)`);
    }
    setLoadingTask(null);
  };

  return (
    <div className="bg-[#0a0a16] border border-[var(--border-dim)] rounded-3xl p-6 md:p-8 w-full max-w-4xl mx-auto">
      <h3 className="text-xl font-bold text-white mb-6">Discrete Earn Points Engine</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Task 1: Founder */}
        <div className="bg-[#0f1021] border border-[var(--border-dim)] rounded-2xl p-6 flex flex-col items-center text-center">
          <TrendingUp className="text-cyan-400 mb-3" size={32} />
          <h4 className="text-sm font-bold text-white mb-2">Founder Volume Milestone</h4>
          <p className="text-xs text-[var(--text-secondary)] mb-4 flex-1">Launch an asset on Arc Chain and hit 1 Million TXs to unlock 1,000 points.</p>
          <button 
            onClick={handleFounderTask} 
            disabled={strikeState.founderRewarded || loadingTask === 'founder'}
            className="w-full py-2 rounded-lg bg-cyan-600/20 text-cyan-400 border border-cyan-500/50 font-bold text-sm transition-all hover:bg-cyan-600/30 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loadingTask === 'founder' ? <Loader2 className="animate-spin" size={16} /> : strikeState.founderRewarded ? <><CheckCircle size={16}/> Claimed</> : 'Verify & Claim'}
          </button>
        </div>

        {/* Task 2: Trader */}
        <div className="bg-[#0f1021] border border-[var(--border-dim)] rounded-2xl p-6 flex flex-col items-center text-center">
          <RefreshCw className="text-purple-400 mb-3" size={32} />
          <h4 className="text-sm font-bold text-white mb-2">Liquidity Trader Challenge</h4>
          <p className="text-xs text-[var(--text-secondary)] mb-4 flex-1">Create trading volume on external Arc Chain launched tokens to earn 1,000 points.</p>
          <button 
            onClick={handleTraderTask}
            disabled={strikeState.traderRewarded || loadingTask === 'trader'}
            className="w-full py-2 rounded-lg bg-purple-600/20 text-purple-400 border border-purple-500/50 font-bold text-sm transition-all hover:bg-purple-600/30 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loadingTask === 'trader' ? <Loader2 className="animate-spin" size={16} /> : strikeState.traderRewarded ? <><CheckCircle size={16}/> Claimed</> : 'Verify & Claim'}
          </button>
        </div>

        {/* Task 3: Strike */}
        <div className="bg-[#0f1021] border border-[var(--border-dim)] rounded-2xl p-6 flex flex-col items-center text-center">
          <CalendarCheck className="text-yellow-400 mb-3" size={32} />
          <h4 className="text-sm font-bold text-white mb-2">7-Day Consistency Strike</h4>
          <p className="text-xs text-[var(--text-secondary)] mb-4 flex-1">Check-in daily. Missing a day resets the strike. Completing 7 days awards 200 points.</p>
          <div className="flex gap-1 mb-4">
            {[1,2,3,4,5,6,7].map(day => (
              <div key={day} className={`w-6 h-1 rounded-full ${day <= strikeState.streak ? 'bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.6)]' : 'bg-slate-700'}`}></div>
            ))}
          </div>
          <button 
            onClick={handleCheckIn}
            disabled={loadingTask === 'checkin'}
            className="w-full py-2 rounded-lg bg-yellow-600/20 text-yellow-400 border border-yellow-500/50 font-bold text-sm transition-all hover:bg-yellow-600/30 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loadingTask === 'checkin' ? <Loader2 className="animate-spin" size={16} /> : 'Daily Check-In'}
          </button>
        </div>

      </div>
    </div>
  );
}
