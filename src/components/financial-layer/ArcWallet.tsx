'use client';

import { useState, useEffect } from 'react';
import { useAccount, usePublicClient, useWriteContract } from 'wagmi';
import { erc20Abi, formatUnits, parseUnits } from 'viem';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeftRight, TrendingUp, Wallet, ArrowDown, DollarSign, Euro, RefreshCw, CheckCircle2, AlertCircle, Bitcoin } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { USDC_ADDRESS, EURC_ADDRESS, CIRBTC_ADDRESS, ARC_GLOBAL_VAULT_ADDRESS, arcVaultAbi } from '@/lib/arcDefiAbi';
import { createBrowserAdapter, appKitSwap } from '@/lib/appKit';

type AssetType = 'USDC' | 'EURC' | 'cirBTC';

const ASSET_CONFIG = {
  USDC: { address: USDC_ADDRESS, decimals: 6, icon: <DollarSign size={13} className="text-blue-600" />, rateToUSDC: 1 },
  EURC: { address: EURC_ADDRESS, decimals: 6, icon: <Euro size={13} className="text-slate-600" />, rateToUSDC: 1.09 },
  cirBTC: { address: CIRBTC_ADDRESS, decimals: 8, icon: <Bitcoin size={13} className="text-orange-500" />, rateToUSDC: 65000 },
};

export default function ArcWallet({ onSwitchToBridge }: { onSwitchToBridge?: (token: 'USDC' | 'EURC') => void }) {
  const { isConnected, address: userAddress } = useAccount();
  const publicClient = usePublicClient();

  // User Balances
  const [balances, setBalances] = useState({ USDC: 0, EURC: 0, cirBTC: 0 });
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);

  const [fromAsset, setFromAsset] = useState<AssetType>('USDC');
  const [toAsset, setToAsset] = useState<AssetType>('EURC');
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [fxRate, setFxRate] = useState(0); 
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapResult, setSwapResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const { writeContractAsync } = useWriteContract();

  const fetchBalances = async () => {
    if (!publicClient || !isConnected || !userAddress) return;
    
    setIsLoadingBalances(true);
    try {
      // Fetch User Balances
      const [uUSDC, uEURC, uBTC] = await Promise.all([
        publicClient.readContract({ address: USDC_ADDRESS as `0x${string}`, abi: erc20Abi, functionName: 'balanceOf', args: [userAddress] }),
        publicClient.readContract({ address: EURC_ADDRESS as `0x${string}`, abi: erc20Abi, functionName: 'balanceOf', args: [userAddress] }),
        publicClient.readContract({ address: CIRBTC_ADDRESS as `0x${string}`, abi: erc20Abi, functionName: 'balanceOf', args: [userAddress] }),
      ]);

      setBalances({
        USDC: Number(formatUnits(uUSDC as bigint, 6)),
        EURC: Number(formatUnits(uEURC as bigint, 6)),
        cirBTC: Number(formatUnits(uBTC as bigint, 8)),
      });
    } catch (e) {
      console.error('Error fetching balances:', e);
    } finally {
      setIsLoadingBalances(false);
    }
  };

  useEffect(() => {
    fetchBalances();
    const handler = () => fetchBalances();
    window.addEventListener('arc-balance-update', handler);
    return () => window.removeEventListener('arc-balance-update', handler);
  }, [isConnected, userAddress, publicClient]);

  // Adjust rates depending on direction
  useEffect(() => {
    const rateFrom = ASSET_CONFIG[fromAsset].rateToUSDC;
    const rateTo = ASSET_CONFIG[toAsset].rateToUSDC;
    const rate = rateFrom / rateTo;
    // official swap flat fee 0.1% logic for estimate
    const feeRate = rate * 0.999;
    setFxRate(feeRate);

    if (fromAmount) {
      // FIX: dynamically change decimals based on target asset to support tiny cirBTC fractions
      const decimalCount = toAsset === 'cirBTC' ? 8 : 4;
      setToAmount((Number(fromAmount) * feeRate).toFixed(decimalCount));
    } else {
      setToAmount('');
    }
  }, [fromAsset, toAsset, fromAmount]);

  const isCirbtcPair = fromAsset === 'cirBTC' || toAsset === 'cirBTC';
  const rateLabel = isCirbtcPair ? 'Vault Estimate' : 'App Kit Rate';

  const handleSwapToggle = () => {
    setFromAsset(toAsset);
    setToAsset(fromAsset);
    setFromAmount(toAmount);
  };

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

    if (amt > balances[fromAsset]) {
      setSwapResult({ type: 'error', message: `Insufficient ${fromAsset} balance.` });
      return;
    }

    setIsSwapping(true);
    setSwapResult(null);

    try {
      if (fromAsset === 'cirBTC' || toAsset === 'cirBTC') {
        const amtWei = parseUnits(fromAmount, ASSET_CONFIG[fromAsset].decimals);
        
        // 1. Approve Vault
        const approveTx = await writeContractAsync({
          address: ASSET_CONFIG[fromAsset].address as `0x${string}`,
          abi: erc20Abi,
          functionName: 'approve',
          args: [ARC_GLOBAL_VAULT_ADDRESS as `0x${string}`, amtWei],
        });
        if (publicClient) await publicClient.waitForTransactionReceipt({ hash: approveTx });

        // 2. Execute Swap (Single-Hop Atomic)
        const swapTx = await writeContractAsync({
          address: ARC_GLOBAL_VAULT_ADDRESS as `0x${string}`,
          abi: arcVaultAbi,
          functionName: 'executeSwap',
          args: [ASSET_CONFIG[fromAsset].address as `0x${string}`, ASSET_CONFIG[toAsset].address as `0x${string}`, amtWei],
        });
        if (publicClient) await publicClient.waitForTransactionReceipt({ hash: swapTx });
      } else {
        const provider = (window as any).ethereum;
        if (!provider) throw new Error("No Web3 provider found. Please install a wallet.");
        
        const adapter = await createBrowserAdapter(provider);
        
        // Execute Swap via Arc App Kit
        await appKitSwap(adapter, String(fromAmount), fromAsset, toAsset, 'Arc_Testnet');
      }

      // Sync trigger
      await fetchBalances();
      window.dispatchEvent(new Event('arc-balance-update'));

      // Log volume for rewards
      const usdVolume = amt * ASSET_CONFIG[fromAsset].rateToUSDC;
      if (usdVolume >= 10) {
        try {
          const pointsEarned = usdVolume / 10;
          const walletLower = userAddress.toLowerCase();
          
          const { data: currentStats } = await supabase.from('user_stats').select('*').eq('wallet', walletLower);

          if (currentStats && currentStats.length > 0) {
            await supabase.from('user_stats').update({
              total_volume: Number(currentStats[0].total_volume || 0) + usdVolume,
              points: Number(currentStats[0].points || 0) + pointsEarned
            }).eq('wallet', walletLower);
          } else {
            await supabase.from('user_stats').insert({ wallet: walletLower, total_volume: usdVolume, points: pointsEarned });
          }
        } catch (dbErr) {
          console.error('Error logging points to Supabase:', dbErr);
        }
      }

      const routeLabel = isCirbtcPair ? 'Arc Global Vault' : 'App Kit';
      setSwapResult({ type: 'success', message: `Successfully swapped ${fromAmount} ${fromAsset} for ${toAsset} via ${routeLabel}!` });
      setFromAmount('');
      setToAmount('');
    } catch (err: any) {
      const rawMessage = String(err?.shortMessage || err?.message || err?.reason || 'Transaction rejected.');
      const isUnsupportedPair = /unsupported pair/i.test(rawMessage);
      setSwapResult({
        type: 'error',
        message: isUnsupportedPair
          ? 'cirBTC trading pairs are coming soon to Arc Testnet pools. Please swap USDC ↔ EURC while testnet routing is finalized.'
          : rawMessage,
      });
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
          onClick={() => { fetchBalances(); window.dispatchEvent(new Event('arc-balance-update')); }} 
          disabled={isLoadingBalances}
          className="p-3.5 hover:bg-slate-50 border border-slate-100 rounded-2xl transition-all text-slate-500 hover:text-slate-800 disabled:opacity-50"
          title="Refresh Balances"
        >
          <RefreshCw size={14} className={isLoadingBalances ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Balance Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* USDC CARD */}
        <div className="bg-gradient-to-br from-blue-600 via-blue-500 to-indigo-600 border border-blue-650 rounded-[32px] p-6 text-white shadow-xl shadow-blue-500/10 relative overflow-hidden group">
          <div className="absolute right-[-10px] bottom-[-20px] text-white/5 group-hover:scale-110 transition-transform duration-350 select-none">
            <DollarSign size={180} strokeWidth={1} />
          </div>
          <div className="flex justify-between items-center mb-6 z-10 relative">
            <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full border border-white/10">USDC</span>
            <div className="flex items-center gap-2">
              <DollarSign size={20} className="text-blue-100" />
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-blue-100 font-semibold">Available Balance</span>
            <h3 className="text-3xl font-black tracking-tight font-mono">
              ${balances.USDC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
          </div>
        </div>

        {/* EURC CARD */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 border border-slate-950 rounded-[32px] p-6 text-white shadow-xl shadow-slate-950/10 relative overflow-hidden group">
          <div className="absolute right-[-10px] bottom-[-20px] text-white/5 group-hover:scale-110 transition-transform duration-350 select-none">
            <Euro size={180} strokeWidth={1} />
          </div>
          <div className="flex justify-between items-center mb-6 z-10 relative">
            <span className="text-[10px] font-black uppercase tracking-widest bg-white/10 px-3 py-1 rounded-full border border-white/5">EURC</span>
            <div className="flex items-center gap-2">
              <Euro size={20} className="text-slate-400" />
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-slate-350 font-semibold">Available Balance</span>
            <h3 className="text-3xl font-black tracking-tight font-mono">
              €{balances.EURC.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
          </div>
        </div>

        {/* cirBTC CARD */}
        <div className="bg-gradient-to-br from-orange-500 via-orange-400 to-amber-500 border border-orange-600 rounded-[32px] p-6 text-white shadow-xl shadow-orange-500/10 relative overflow-hidden group">
          <div className="absolute right-[-10px] bottom-[-20px] text-white/10 group-hover:scale-110 transition-transform duration-350 select-none">
            <Bitcoin size={180} strokeWidth={1} />
          </div>
          <div className="flex justify-between items-center mb-6 z-10 relative">
            <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full border border-white/20 text-orange-900">cirBTC</span>
            <div className="flex items-center gap-2">
              <Bitcoin size={20} className="text-orange-100" />
            </div>
          </div>
          <div className="space-y-1 z-10 relative">
            <span className="text-xs text-orange-100 font-semibold">Available Balance</span>
            <h3 className="text-3xl font-black tracking-tight font-mono">
              {/* FIX: Set minimum fraction digits to 4 so small balances render properly */}
              ₿{balances.cirBTC.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 8 })}
            </h3>
          </div>
        </div>

      </div>

      {/* SWAP ENGINE WIDGET */}
      <div className="bg-white border border-slate-200/80 rounded-[32px] p-6 sm:p-8 shadow-sm space-y-6 max-w-xl mx-auto">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100 text-blue-600">
            <ArrowLeftRight size={18} />
          </div>
          <div>
            <h4 className="font-extrabold text-slate-800 text-sm">Arc App Kit Swap</h4>
            <p className="text-[10px] text-slate-500 font-semibold">Native routing with official Circle architecture.</p>
          </div>
        </div>

        <form onSubmit={handleSwap} className="space-y-5">
          {/* FROM ASSET BOX */}
          <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4.5 space-y-2">
            <div className="flex justify-between items-center text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
              <span>From Asset</span>
              <span className="cursor-pointer text-blue-600" onClick={() => setFromAmount(balances[fromAsset].toString())}>
                Max: {balances[fromAsset].toLocaleString(undefined, { maximumFractionDigits: ASSET_CONFIG[fromAsset].decimals === 8 ? 8 : 4 })}
              </span>
            </div>
            <div className="flex justify-between items-center gap-4">
              <input
                type="number"
                placeholder="0.00"
                step="any"
                required
                value={fromAmount}
                onChange={(e) => setFromAmount(e.target.value)}
                className="w-full bg-transparent text-2xl font-black font-mono text-slate-800 outline-none"
              />
              <select 
                value={fromAsset}
                onChange={(e) => setFromAsset(e.target.value as AssetType)}
                className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-black text-slate-700 shadow-sm outline-none cursor-pointer"
              >
                <option value="USDC">USDC</option>
                <option value="EURC">EURC</option>
                <option value="cirBTC">cirBTC</option>
              </select>
            </div>
          </div>

          {/* FLIP TOGGLE BUTTON */}
          <div className="flex justify-center -my-3 relative z-10">
            <button
              type="button"
              onClick={handleSwapToggle}
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
            <div className="flex justify-between items-center gap-4">
              <input
                type="text"
                placeholder="0.00"
                readOnly
                value={toAmount}
                className="w-full bg-transparent text-2xl font-black font-mono text-slate-400 outline-none"
              />
              <select 
                value={toAsset}
                onChange={(e) => setToAsset(e.target.value as AssetType)}
                className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-black text-slate-700 shadow-sm outline-none cursor-pointer"
              >
                <option value="USDC">USDC</option>
                <option value="EURC">EURC</option>
                <option value="cirBTC">cirBTC</option>
              </select>
            </div>
          </div>

          {/* RATE DETAILS */}
          <div className="flex justify-between items-center bg-blue-50/40 border border-blue-100 p-3 rounded-xl text-[10px] font-extrabold text-slate-600">
            <span className="flex items-center gap-1"><TrendingUp size={12} className="text-blue-500" /> {rateLabel}</span>
            <span className="font-mono text-blue-600">1 {fromAsset} ≈ {fxRate.toLocaleString(undefined, {maximumFractionDigits: 8})} {toAsset}</span>
          </div>

          {isCirbtcPair && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-800 font-semibold">
              cirBTC swaps route through the Arc Global Vault. If this pair is unavailable on current testnet liquidity pools, please use USDC ↔ EURC for now.
            </div>
          )}

          {/* SWAP ACTION BUTTON */}
          <button
            type="submit"
            disabled={isSwapping || fromAsset === toAsset}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-sm tracking-wide uppercase transition-all shadow-md shadow-blue-500/10 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSwapping ? (
              <>
                <RefreshCw size={15} className="animate-spin" />
                Executing Swap...
              </>
            ) : fromAsset === toAsset ? (
              'Invalid Pair'
            ) : (
              'Execute Swap'
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
