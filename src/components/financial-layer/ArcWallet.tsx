'use client';

import { useState, useEffect } from 'react';
import { useAccount, usePublicClient, useWriteContract } from 'wagmi';
import { erc20Abi, formatUnits, parseUnits } from 'viem';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeftRight, TrendingUp, Wallet, ArrowDown, DollarSign, Euro, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

// Mock contract or simulated EURC address on Arc Testnet
const USDC_ADDRESS = '0x3600000000000000000000000000000000000000';
const EURC_ADDRESS = '0xeC00000000000000000000000000000000000000'; // Simulated EURC Address

export default function ArcWallet() {
  const { isConnected, address: userAddress } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  // Balance states (Starts with simulated fallbacks)
  const [usdcBalance, setUsdcBalance] = useState<number>(1000.00);
  const [eurcBalance, setEurcBalance] = useState<number>(500.00);
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);

  // Swap input states
  const [swapDirection, setSwapDirection] = useState<'USDC_TO_EURC' | 'EURC_TO_USDC'>('USDC_TO_EURC');
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [fxRate, setFxRate] = useState(0.92); // 1 USDC = 0.92 EURC
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapResult, setSwapResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Fetch balances (combines on-chain read & simulated local state)
  const fetchBalances = async () => {
    if (!isConnected || !userAddress || !publicClient) return;
    
    setIsLoadingBalances(true);
    try {
      // 1. Fetch on-chain USDC Balance (6 Decimals)
      let usdcVal = 0;
      try {
        const usdcRaw = await publicClient.readContract({
          address: USDC_ADDRESS,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [userAddress],
        }) as bigint;
        usdcVal = Number(formatUnits(usdcRaw, 6));
      } catch (err) {
        console.warn('Could not fetch USDC on-chain balance, using simulated.', err);
        // Fallback to local storage or defaults
        const stored = localStorage.getItem(`sim_usdc_${userAddress.toLowerCase()}`);
        usdcVal = stored ? Number(stored) : 1000.00;
      }

      // 2. Fetch on-chain EURC Balance (18 Decimals)
      let eurcVal = 0;
      try {
        const eurcRaw = await publicClient.readContract({
          address: EURC_ADDRESS,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [userAddress],
        }) as bigint;
        eurcVal = Number(formatUnits(eurcRaw, 18));
      } catch (err) {
        // Fallback to local storage or defaults
        const stored = localStorage.getItem(`sim_eurc_${userAddress.toLowerCase()}`);
        eurcVal = stored ? Number(stored) : 500.00;
      }

      setUsdcBalance(usdcVal);
      setEurcBalance(eurcVal);
    } catch (e) {
      console.error('Error fetching balances:', e);
    } finally {
      setIsLoadingBalances(false);
    }
  };

  useEffect(() => {
    if (isConnected && userAddress) {
      // Load initial local simulation values if they exist
      const localUsdc = localStorage.getItem(`sim_usdc_${userAddress.toLowerCase()}`);
      const localEurc = localStorage.getItem(`sim_eurc_${userAddress.toLowerCase()}`);
      if (localUsdc) setUsdcBalance(Number(localUsdc));
      if (localEurc) setEurcBalance(Number(localEurc));

      fetchBalances();
    }
  }, [isConnected, userAddress]);

  // Adjust rates depending on direction
  useEffect(() => {
    if (swapDirection === 'USDC_TO_EURC') {
      setFxRate(0.92);
      if (fromAmount) {
        setToAmount((Number(fromAmount) * 0.92).toFixed(2));
      } else {
        setToAmount('');
      }
    } else {
      setFxRate(1.09);
      if (fromAmount) {
        setToAmount((Number(fromAmount) * 1.09).toFixed(2));
      } else {
        setToAmount('');
      }
    }
  }, [swapDirection, fromAmount]);

  const handleSwap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !userAddress) {
      setSwapResult({ type: 'error', message: 'Please connect your wallet first.' });
      return;
    }

    const amt = Number(fromAmount);
    if (!fromAmount || amt <= 0) {
      setSwapResult({ type: 'error', message: 'Enter a valid positive amount.' });
      return;
    }

    // Check balance
    if (swapDirection === 'USDC_TO_EURC' && amt > usdcBalance) {
      setSwapResult({ type: 'error', message: 'Insufficient USDC balance.' });
      return;
    }
    if (swapDirection === 'EURC_TO_USDC' && amt > eurcBalance) {
      setSwapResult({ type: 'error', message: 'Insufficient EURC balance.' });
      return;
    }

    setIsSwapping(true);
    setSwapResult(null);

    try {
      // Simulated blockchain transaction wait (Premium UX)
      await new Promise((resolve) => setTimeout(resolve, 2500));

      let newUsdc = usdcBalance;
      let newEurc = eurcBalance;
      let usdVolume = 0;

      if (swapDirection === 'USDC_TO_EURC') {
        newUsdc = usdcBalance - amt;
        newEurc = eurcBalance + (amt * 0.92);
        usdVolume = amt;
      } else {
        newUsdc = usdcBalance + (amt * 1.09);
        newEurc = eurcBalance - amt;
        usdVolume = amt * 1.09;
      }

      // Save new simulated balances to localStorage
      localStorage.setItem(`sim_usdc_${userAddress.toLowerCase()}`, newUsdc.toFixed(2));
      localStorage.setItem(`sim_eurc_${userAddress.toLowerCase()}`, newEurc.toFixed(2));
      
      setUsdcBalance(newUsdc);
      setEurcBalance(newEurc);

      // Trigger reward points +1 per 10 USDC swapped volume
      if (usdVolume >= 10) {
        try {
          const pointsEarned = usdVolume / 10;
          const walletLower = userAddress.toLowerCase();
          
          const { data: currentStats } = await supabase
            .from('user_stats')
            .select('*')
            .eq('wallet', walletLower);

          if (currentStats && currentStats.length > 0) {
            await supabase
              .from('user_stats')
              .update({
                total_volume: Number(currentStats[0].total_volume || 0) + usdVolume,
                points: Number(currentStats[0].points || 0) + pointsEarned
              })
              .eq('wallet', walletLower);
          } else {
            await supabase
              .from('user_stats')
              .insert({
                wallet: walletLower,
                total_volume: usdVolume,
                points: pointsEarned
              });
          }
        } catch (dbErr) {
          console.error('Error logging points to Supabase:', dbErr);
        }
      }

      setSwapResult({
        type: 'success',
        message: `Successfully swapped ${fromAmount} ${swapDirection === 'USDC_TO_EURC' ? 'USDC' : 'EURC'} for ${toAmount} ${swapDirection === 'USDC_TO_EURC' ? 'EURC' : 'USDC'}!`,
      });
      setFromAmount('');
      setToAmount('');
    } catch (err: any) {
      setSwapResult({ type: 'error', message: err.message || 'Transaction rejected.' });
    } finally {
      setIsSwapping(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      
      {/* Brand Rebrand Title */}
      <div className="flex items-center justify-between bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center border border-blue-100 text-blue-600 shadow-sm shadow-blue-500/5 animate-pulse">
            <Wallet size={22} />
          </div>
          <div>
            <span className="text-[10px] uppercase font-extrabold tracking-widest text-blue-600 block">EVM Multi-Currency</span>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">ARC Global Multi-Asset Wallet</h2>
          </div>
        </div>
        <button 
          onClick={fetchBalances} 
          disabled={isLoadingBalances}
          className="p-3.5 hover:bg-slate-50 border border-slate-100 rounded-2xl transition-all text-slate-500 hover:text-slate-800 disabled:opacity-50"
          title="Refresh Balances"
        >
          <RefreshCw size={14} className={isLoadingBalances ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Balance Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* USDC CARD */}
        <div className="bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 border border-blue-650 rounded-[32px] p-6 text-white shadow-xl shadow-blue-500/10 relative overflow-hidden group">
          <div className="absolute right-[-10px] bottom-[-20px] text-white/5 group-hover:scale-110 transition-transform duration-350 select-none">
            <DollarSign size={180} strokeWidth={1} />
          </div>
          <div className="flex justify-between items-center mb-6">
            <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full border border-white/10">USDC (Base Token)</span>
            <DollarSign size={20} className="text-blue-100" />
          </div>
          <div className="space-y-1">
            <span className="text-xs text-blue-100 font-semibold">Available Balance</span>
            <h3 className="text-3xl font-black tracking-tight font-mono">
              ${usdcBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
          </div>
          <div className="mt-6 flex justify-between items-center text-[10px] text-blue-100 border-t border-white/10 pt-4 font-bold">
            <span>Decimals: 6</span>
            <span>Arc Testnet Network</span>
          </div>
        </div>

        {/* EURC CARD */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 border border-slate-950 rounded-[32px] p-6 text-white shadow-xl shadow-slate-950/10 relative overflow-hidden group">
          <div className="absolute right-[-10px] bottom-[-20px] text-white/5 group-hover:scale-110 transition-transform duration-350 select-none">
            <Euro size={180} strokeWidth={1} />
          </div>
          <div className="flex justify-between items-center mb-6">
            <span className="text-[10px] font-black uppercase tracking-widest bg-white/10 px-3 py-1 rounded-full border border-white/5">EURC (Euro Stable)</span>
            <Euro size={20} className="text-slate-400" />
          </div>
          <div className="space-y-1">
            <span className="text-xs text-slate-350 font-semibold">Available Balance</span>
            <h3 className="text-3xl font-black tracking-tight font-mono">
              €{eurcBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
          </div>
          <div className="mt-6 flex justify-between items-center text-[10px] text-slate-400 border-t border-white/5 pt-4 font-bold">
            <span>Decimals: 18</span>
            <span>Arc Testnet Network</span>
          </div>
        </div>

      </div>

      {/* FX Swap Engine Widget */}
      <div className="bg-white border border-slate-200/80 rounded-[32px] p-6 sm:p-8 shadow-sm space-y-6 max-w-xl mx-auto">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100 text-blue-600">
            <ArrowLeftRight size={18} />
          </div>
          <div>
            <h4 className="font-extrabold text-slate-800 text-sm">Isolated FX Swap Engine</h4>
            <p className="text-[10px] text-slate-500 font-semibold">Swap USDC directly to simulated EURC at zero slippage.</p>
          </div>
        </div>

        <form onSubmit={handleSwap} className="space-y-5">
          {/* FROM ASSET BOX */}
          <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4.5 space-y-2">
            <div className="flex justify-between items-center text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
              <span>From Asset</span>
              <span className="cursor-pointer text-blue-600" onClick={() => setFromAmount(swapDirection === 'USDC_TO_EURC' ? usdcBalance.toFixed(2) : eurcBalance.toFixed(2))}>
                Max: {swapDirection === 'USDC_TO_EURC' ? usdcBalance.toFixed(2) : eurcBalance.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <input
                type="number"
                placeholder="0.00"
                step="any"
                required
                value={fromAmount}
                onChange={(e) => setFromAmount(e.target.value)}
                className="w-2/3 bg-transparent text-2xl font-black font-mono text-slate-800 outline-none"
              />
              <span className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-black text-slate-700 shadow-sm flex items-center gap-1">
                {swapDirection === 'USDC_TO_EURC' ? <DollarSign size={13} className="text-blue-600" /> : <Euro size={13} className="text-slate-600" />}
                {swapDirection === 'USDC_TO_EURC' ? 'USDC' : 'EURC'}
              </span>
            </div>
          </div>

          {/* FLIP TOGGLE BUTTON */}
          <div className="flex justify-center -my-3 relative z-10">
            <button
              type="button"
              onClick={() => setSwapDirection(prev => prev === 'USDC_TO_EURC' ? 'EURC_TO_USDC' : 'USDC_TO_EURC')}
              className="p-3 bg-white hover:bg-slate-50 border border-slate-200 text-blue-600 hover:text-blue-700 rounded-full shadow-md hover:shadow-lg transition-all hover:scale-105 cursor-pointer active:scale-95"
            >
              <ArrowDown size={16} />
            </button>
          </div>

          {/* TO ASSET BOX */}
          <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4.5 space-y-2">
            <div className="flex justify-between items-center text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
              <span>To Asset (Estimated)</span>
            </div>
            <div className="flex justify-between items-center">
              <input
                type="text"
                placeholder="0.00"
                readOnly
                value={toAmount}
                className="w-2/3 bg-transparent text-2xl font-black font-mono text-slate-400 outline-none"
              />
              <span className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-black text-slate-700 shadow-sm flex items-center gap-1">
                {swapDirection === 'USDC_TO_EURC' ? <Euro size={13} className="text-slate-600" /> : <DollarSign size={13} className="text-blue-600" />}
                {swapDirection === 'USDC_TO_EURC' ? 'EURC' : 'USDC'}
              </span>
            </div>
          </div>

          {/* RATE DETAILS */}
          <div className="flex justify-between items-center bg-blue-50/40 border border-blue-100 p-3 rounded-xl text-[10px] font-extrabold text-slate-600">
            <span className="flex items-center gap-1"><TrendingUp size={12} className="text-blue-500" /> Guaranteed FX Rate</span>
            <span className="font-mono text-blue-600">1 {swapDirection === 'USDC_TO_EURC' ? 'USDC' : 'EURC'} = {fxRate} {swapDirection === 'USDC_TO_EURC' ? 'EURC' : 'USDC'}</span>
          </div>

          {/* SWAP ACTION BUTTON */}
          <button
            type="submit"
            disabled={isSwapping}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-sm tracking-wide uppercase transition-all shadow-md shadow-blue-500/10 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSwapping ? (
              <>
                <RefreshCw size={15} className="animate-spin" />
                Processing FX Execution...
              </>
            ) : (
              'Confirm FX Swap'
            )}
          </button>
        </form>

        {/* FEEDBACK POPUPS */}
        <AnimatePresence>
          {swapResult && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className={`p-4.5 rounded-2xl border text-xs font-bold flex items-start gap-3 ${
                swapResult.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'
              }`}
            >
              {swapResult.type === 'success' ? <CheckCircle2 size={16} className="shrink-0" /> : <AlertCircle size={16} className="shrink-0" />}
              <span>{swapResult.message}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}
