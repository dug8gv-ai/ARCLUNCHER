'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, usePublicClient } from 'wagmi';
import { parseUnits, erc20Abi } from 'viem';
import { supabase } from '@/lib/supabase';
import { TrendingUp, ArrowUpDown, Info, Wallet, Loader2 } from 'lucide-react';

interface TradingPanelProps {
  token: any;
}

const ARC_LAUNCHER_ABI = [
  {
    "inputs": [
      {"internalType": "address", "name": "tokenAddress", "type": "address"},
      {"internalType": "uint256", "name": "usdcAmount", "type": "uint256"},
      {"internalType": "uint256", "name": "tokenAmount", "type": "uint256"},
      {"internalType": "bool", "name": "isBuy", "type": "bool"}
    ],
    "name": "swap",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

const ARC_LAUNCHER_ADDRESS = process.env.NEXT_PUBLIC_LAUNCHER_ADDRESS || '0xC3A4a3C1a30009D63F7FaCe3609eA9C5A0157c00'; 
const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS || '0x3600000000000000000000000000000000000000';

export function TradingPanel({ token }: TradingPanelProps) {
  const { isConnected, address: userAddress } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [amount, setAmount] = useState('');
  const [sliderPct, setSliderPct] = useState(0); // 0–100, drives slider position
  const [balance, setBalance] = useState('0');
  const [tokenBalance, setTokenBalance] = useState('0');
  const [isBuy, setIsBuy] = useState(true);
  const [status, setStatus] = useState<'idle' | 'approving' | 'swapping' | 'success'>('idle');
  const [premiumAlert, setPremiumAlert] = useState<{
    title: string;
    details: Array<{ label: string; value: string }>;
    type: 'config' | 'info' | 'success' | 'error';
    onClose: () => void;
  } | null>(null);

  // Helper to trigger custom styled alerts synchronously using Promises
  const triggerPremiumAlert = (
    title: string, 
    details: Array<{ label: string; value: string }>, 
    type: 'config' | 'info' | 'success' | 'error'
  ): Promise<void> => {
    return new Promise((resolve) => {
      setPremiumAlert({
        title,
        details,
        type,
        onClose: () => {
          resolve();
        }
      });
    });
  };

  const fetchBalance = async () => {
    if (!userAddress || !publicClient || !token) return;
    try {
      // 1. Fetch USDC Balance
      const bal = await publicClient.readContract({
        address: USDC_ADDRESS as `0x${string}`,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [userAddress as `0x${string}`],
      });
      const decimals = 6;
      const divisor = Math.pow(10, decimals);
      setBalance((Number(bal) / divisor).toFixed(2));

      // 2. Fetch Token Balance
      const tBal = await publicClient.readContract({
        address: token.token_address as `0x${string}`,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [userAddress as `0x${string}`],
      });
      setTokenBalance((Number(tBal) / 1e18).toFixed(2));
    } catch (e) {
      console.error(e);
    }
  };

  const handleMax = () => {
    if (isBuy) {
      setAmount(balance);
      setSliderPct(100);
    } else {
      setAmount(tokenBalance);
      setSliderPct(100);
    }
  };

  // Active balance depending on buy/sell mode
  const activeBalance = isBuy ? Number(balance) : Number(tokenBalance);

  // Set amount from a percentage click or slider drag
  const applyPercent = (pct: number) => {
    setSliderPct(pct);
    if (activeBalance <= 0) return;
    const val = ((pct / 100) * activeBalance);
    setAmount(val > 0 ? val.toFixed(6) : '');
  };

  // When user types manually — sync slider back
  const handleAmountChange = (val: string) => {
    setAmount(val);
    const num = Number(val);
    if (activeBalance > 0 && num >= 0) {
      const pct = Math.min(100, (num / activeBalance) * 100);
      setSliderPct(Math.round(pct));
    } else {
      setSliderPct(0);
    }
  };

  useEffect(() => {
    fetchBalance();
    
    // Refresh balances every 10 seconds or when user changes
    const interval = setInterval(fetchBalance, 10000);
    return () => clearInterval(interval);
  }, [userAddress, publicClient, token]);

  if (!token) return null;

  const [estimatedTokens, setEstimatedTokens] = useState('0');

  // Fetch current pool state to calculate price
  const calculateEstimate = async (val: string) => {
    if (!val || Number(val) <= 0 || !token) {
      setEstimatedTokens('0');
      return;
    }

    try {
      const { data: swaps } = await supabase
        .from('token_swaps')
        .select('usdc_amount, token_amount, is_buy')
        .eq('token_address', token.token_address.toLowerCase());

      // ── AMM BONDING CURVE — REAL MARKET PRICING ────────────────────────
      // Initial liquidity = actual USDC used when token was created
      // For example: 3 USDC initial liquidity with 1B supply = $0.000000003 per token
      //
      // Price formula: price = USDC_in_pool / tokens_in_pool
      // As buys increase USDC, price goes UP ↑
      // As sells decrease USDC, price goes DOWN ↓
      // ─────────────────────────────────────────────────────────────────────
      const INITIAL_LIQUIDITY_USDC = Number(
        token.initial_liquidity || 
        token.liquidity || 
        3  // Default: 3 USDC (real launch amount)
      );

      const totalSupply = Number(
        token.initial_supply || token.supply || 1_000_000_000
      );

      let currentUSDC   = INITIAL_LIQUIDITY_USDC;
      let currentTokens = totalSupply;

      // Replay all historical swaps to get current pool state
      swaps?.forEach(s => {
        if (s.is_buy) {
          currentUSDC   += Number(s.usdc_amount);
          currentTokens -= Number(s.token_amount);
        } else {
          currentUSDC   -= Number(s.usdc_amount);
          currentTokens += Number(s.token_amount);
        }
      });

      // Floor protection: reserves never go below initial values
      if (currentUSDC   < INITIAL_LIQUIDITY_USDC) currentUSDC   = INITIAL_LIQUIDITY_USDC;
      if (currentTokens > totalSupply)             currentTokens = totalSupply;
      if (currentTokens <= 0)                      currentTokens = 1;

      // k is computed from CURRENT pool state (post all trades)
      const k = currentUSDC * currentTokens;

      const dX = Number(val);
      if (isBuy) {
        // Buy: spend dX USDC → receive tokens
        const newUSDC   = currentUSDC + dX;
        const newTokens = k / newUSDC;
        const tokensOut = currentTokens - newTokens;
        setEstimatedTokens(Math.max(0, tokensOut).toFixed(2));
      } else {
        // Sell: spend dX tokens → receive USDC
        // Cap dX to actual wallet balance to prevent over-sell estimates
        const walletTokens = Number(tokenBalance.replace(/,/g, ''));
        const actualSell = Math.min(dX, walletTokens);

        const newTokens = currentTokens + actualSell;
        const newUSDC   = k / newTokens;
        let usdcOut = currentUSDC - newUSDC;

        // Floor: pool USDC can't drop below initial liquidity
        const maxUsdcOut = currentUSDC - INITIAL_LIQUIDITY_USDC;
        if (usdcOut > maxUsdcOut) usdcOut = maxUsdcOut;

        setEstimatedTokens(Math.max(0, usdcOut).toFixed(6));
      }

    } catch (e) {
      console.error("Error calculating estimate:", e);
    }
  };

  useEffect(() => {
    calculateEstimate(amount);
  }, [amount, isBuy, token]);

  const handleTrade = async () => {
    if (!isConnected) {
      await triggerPremiumAlert("WALLET REQUIRED", [
        { label: "Status", value: "Please connect your wallet first!" }
      ], "error");
      return;
    }
    if (!amount || Number(amount) <= 0) return;

    // On sell: cap the amount to actual wallet token balance
    if (!isBuy) {
      const walletTokens = Number(tokenBalance.replace(/,/g, ''));
      if (Number(amount) > walletTokens) {
        await triggerPremiumAlert("INSUFFICIENT BALANCE", [
          { label: "You entered", value: `${Number(amount).toLocaleString()} ${token.ticker}` },
          { label: "Your wallet balance", value: `${walletTokens.toLocaleString()} ${token.ticker}` },
          { label: "Fix", value: "Use MAX SELL to sell your exact balance." }
        ], "error");
        return;
      }
    }

    const tokenAmountForDB = Number(estimatedTokens.replace(/,/g, ''));
    if (tokenAmountForDB <= 0) {
      await triggerPremiumAlert("ESTIMATION ERROR", [
        { label: "Message", value: "Estimated output is 0. Wait for calculation." }
      ], "error");
      return;
    }

    try {
      setStatus('approving');
      
      const decimals = 6;
      let usdcAmount: bigint;
      let tokenAmountWei: bigint;

      if (isBuy) {
        // BUY: Input is USDC, Output is Tokens
        usdcAmount = parseUnits(amount, decimals);
        // Remove commas from formatted estimate string before parsing
        const cleanEstimate = estimatedTokens.replace(/,/g, '');
        tokenAmountWei = parseUnits(cleanEstimate, 18);
      } else {
        // SELL: Input is Tokens, Output is USDC
        tokenAmountWei = parseUnits(amount, 18);
        const cleanEstimate = estimatedTokens.replace(/,/g, '');
        usdcAmount = parseUnits(cleanEstimate, decimals);
      }

      if (isBuy) {
        // Approve USDC
        const approveHash = await writeContractAsync({
          address: USDC_ADDRESS as `0x${string}`,
          abi: erc20Abi,
          functionName: 'approve',
          args: [ARC_LAUNCHER_ADDRESS as `0x${string}`, usdcAmount],
        });
        await publicClient?.waitForTransactionReceipt({ hash: approveHash });
      } else {
        // Approve Tokens for Sell
        const approveHash = await writeContractAsync({
          address: token.token_address as `0x${string}`,
          abi: erc20Abi,
          functionName: 'approve',
          args: [ARC_LAUNCHER_ADDRESS as `0x${string}`, tokenAmountWei],
        });
        await publicClient?.waitForTransactionReceipt({ hash: approveHash });
      }

      setStatus('swapping');
      const swapHash = await writeContractAsync({
        address: ARC_LAUNCHER_ADDRESS as `0x${string}`,
        abi: ARC_LAUNCHER_ABI,
        functionName: 'swap',
        args: [token.token_address as `0x${string}`, usdcAmount, tokenAmountWei, isBuy],
      });


      await publicClient?.waitForTransactionReceipt({ hash: swapHash });

      // Sync with Supabase
      // BUY:  usdc_amount = USDC spent,  token_amount = tokens received (estimate)
      // SELL: usdc_amount = USDC received (estimate), token_amount = tokens sold (actual input)
      const cleanEstimate = Number(estimatedTokens.replace(/,/g, ''));
      const actualTokensSold = Number(amount); // exact tokens user entered & approved
      const swapData = {
        user_address: userAddress?.toLowerCase(),
        token_address: token.token_address.toLowerCase(),
        usdc_amount:   isBuy ? Number(amount) : cleanEstimate,
        token_amount:  isBuy ? cleanEstimate  : actualTokensSold,
        is_buy: isBuy,
        type: isBuy ? 'buy' : 'sell'
      };

      // 🛡️ SECURITY PROTOCOL: Secure Backend Routing
      const apiRes = await fetch('/api/swaps/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash: swapHash, swapData })
      });

      if (!apiRes.ok) {
        await triggerPremiumAlert("DATABASE ERROR", [
          { label: "Status", value: "Database Sync Error" },
          { label: "Detail", value: "Blockchain tx succeeded, but backend secure sync failed. Refresh to update." }
        ], 'error');
        setStatus('idle');
        return;
      }

      // Track user volume & points: 10 USDC Volume = 1 ARCL Point. Store in user_stats.
      try {
        if (userAddress) {
          const swapUsdcAmount = Number(isBuy ? amount : cleanEstimate);
          const pointsEarned = swapUsdcAmount / 10;
          const walletLower = userAddress.toLowerCase();

          const { data: existingStats, error: fetchErr } = await supabase
            .from('user_stats')
            .select('*')
            .eq('wallet', walletLower);

          if (fetchErr) {
            console.error("Fetch Stats Error:", fetchErr.message);
            await triggerPremiumAlert("POINTS FETCH ERROR", [
              { label: "Error Message", value: fetchErr.message }
            ], "error");
          }

          const currentStats = existingStats && existingStats.length > 0 ? existingStats[0] : null;

          if (currentStats) {
            const newVolume = Number(currentStats.total_volume || 0) + swapUsdcAmount;
            const newPoints = Number(currentStats.points || 0) + pointsEarned;
            const { error: updateErr } = await supabase
              .from('user_stats')
              .update({
                total_volume: newVolume,
                points: newPoints
              })
              .eq('wallet', walletLower);
            
            if (updateErr) {
              console.error("Update Stats Error:", updateErr.message);
              await triggerPremiumAlert("POINTS UPDATE ERROR", [
                { label: "Error Message", value: updateErr.message }
              ], "error");
            }
          } else {
            const { error: insertErr } = await supabase
              .from('user_stats')
              .insert({
                wallet: walletLower,
                total_volume: swapUsdcAmount,
                points: pointsEarned
              });
            
            if (insertErr) {
              console.error("Insert Stats Error:", insertErr.message);
              await triggerPremiumAlert("POINTS INSERT ERROR", [
                { label: "Error Message", value: insertErr.message }
              ], "error");
            }
          }
        }
      } catch (statsErr: any) {
        console.error("Error updating user stats:", statsErr);
        await triggerPremiumAlert("STATS CATCH ERROR", [
          { label: "Error Message", value: statsErr.message }
        ], "error");
      }

      await triggerPremiumAlert("SWAP SUCCESS", [
        { label: "Status", value: "SUCCESS! Transaction confirmed." },
        { label: "Notification", value: "Tokens swapped successfully!" }
      ], "success");

      setStatus('success');
      // Soft refresh: update balances + chart without reloading the page
      await fetchBalance();
      window.dispatchEvent(new Event('arc-balance-update'));
      setAmount('');
      setSliderPct(0);
      setTimeout(() => setStatus('idle'), 2000);

    } catch (error: any) {
      console.error(error);
      await triggerPremiumAlert("TRANSACTION REJECTED / FAILED", [
        { label: "Error Message", value: error.shortMessage || error.message }
      ], "error");
      setStatus('idle');
    }
  };

  return (
    <div className="glass-panel p-6 card">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-extrabold text-[var(--text-primary)] flex items-center gap-2 text-base">
          <ArrowUpDown size={18} className="text-[var(--accent-cyan)]" />
          Trade {token.ticker}
        </h3>
        <div className="flex bg-slate-100 rounded-xl p-1 text-xs items-center gap-0.5">
          <button 
            onClick={() => { setIsBuy(true); setAmount(''); setSliderPct(0); }}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer font-bold ${isBuy ? 'bg-green-100 text-green-700 shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
          >
            BUY
          </button>
          <button 
            onClick={() => { setIsBuy(false); setAmount(''); setSliderPct(0); }}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer font-bold ${!isBuy ? 'bg-red-100 text-red-700 shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
          >
            SELL
          </button>
          <button 
            onClick={() => {
              window.dispatchEvent(new CustomEvent('open-locker'));
            }}
            className="px-3 py-1.5 rounded-lg transition-all cursor-pointer font-bold text-[var(--accent-cyan)] hover:bg-[rgba(0,242,254,0.05)] flex items-center gap-0.5"
          >
            🔒 LOCK
          </button>
        </div>
      </div>

      <div className="space-y-5">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
          {/* Balance label + MAX button */}
          <div className="flex justify-between text-[11px] text-slate-500 font-semibold">
            <span>{isBuy ? 'Amount in USDC' : `Amount in ${token.ticker}`}</span>
            <div className="flex items-center gap-2">
              {isBuy ? (
                <span className="flex items-center gap-1">
                  <Wallet size={11} /> {balance} USDC
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <TrendingUp size={11} /> {tokenBalance} {token.ticker}
                </span>
              )}
              <button
                onClick={() => applyPercent(100)}
                className={`px-2 py-0.5 rounded-md border text-[10px] font-black cursor-pointer transition-all ${
                  isBuy
                    ? 'border-blue-200 text-blue-600 hover:bg-blue-600 hover:text-white'
                    : 'border-red-200 text-red-600 hover:bg-red-600 hover:text-white'
                }`}
              >
                {isBuy ? 'MAX BUY' : 'MAX SELL'}
              </button>
            </div>
          </div>

          {/* ── Percentage chip row ── */}
          <div className="flex items-center justify-end gap-1.5">
            {[15, 25, 50, 75].map(pct => (
              <button
                key={pct}
                onClick={() => applyPercent(pct)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer select-none ${
                  sliderPct === pct
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100 hover:text-[var(--text-secondary)]'
                }`}
              >
                {pct}%
              </button>
            ))}
            <button
              onClick={() => applyPercent(100)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer select-none ${
                sliderPct === 100
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100 hover:text-[var(--text-secondary)]'
              }`}
            >
              MAX
            </button>
          </div>

          {/* ── Amount input ── */}
          <input
            type="number"
            value={amount}
            onChange={e => handleAmountChange(e.target.value)}
            placeholder="0.00"
            className="w-full bg-[var(--bg-card)] border border-[var(--border-dim)] rounded-xl px-4 py-3 text-2xl font-bold font-mono text-[var(--text-primary)] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-900 placeholder:text-slate-300 transition-all"
          />

          {/* ── Range slider ── */}
          <div className="pt-1 space-y-1">
            <style>{`
              .arc-slider {
                -webkit-appearance: none;
                appearance: none;
                width: 100%;
                height: 5px;
                border-radius: 999px;
                background: linear-gradient(
                  to right,
                  #3b82f6 0%,
                  #3b82f6 ${sliderPct}%,
                  #e2e8f0 ${sliderPct}%,
                  #e2e8f0 100%
                );
                outline: none;
                cursor: pointer;
              }
              .arc-slider::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 18px;
                height: 18px;
                border-radius: 50%;
                background: #3b82f6;
                border: 2px solid #ffffff;
                box-shadow: 0 1px 4px rgba(59,130,246,0.4);
                cursor: pointer;
                transition: box-shadow 0.15s ease;
              }
              .arc-slider::-webkit-slider-thumb:hover {
                box-shadow: 0 0 0 4px rgba(59,130,246,0.18);
              }
              .arc-slider::-moz-range-thumb {
                width: 18px;
                height: 18px;
                border-radius: 50%;
                background: #3b82f6;
                border: 2px solid #ffffff;
                box-shadow: 0 1px 4px rgba(59,130,246,0.4);
                cursor: pointer;
              }
            `}</style>
            <input
              type="range"
              min="0"
              max="100"
              value={sliderPct}
              onChange={e => applyPercent(Number(e.target.value))}
              className="arc-slider"
            />
            {/* Tick labels */}
            <div className="flex justify-between text-[10px] text-slate-400 font-medium px-0.5 select-none">
              <span>0%</span>
              <span>25%</span>
              <span>50%</span>
              <span>75%</span>
              <span>100%</span>
            </div>
          </div>
        </div>

        <button 
          onClick={handleTrade}
          disabled={status !== 'idle'}
          className={`w-full py-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
            isBuy 
              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20' 
              : 'bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-500/20'
          } disabled:opacity-50`}
        >
          {status === 'approving' && <><Loader2 className="animate-spin" /> Approving...</>}
          {status === 'swapping' && <><Loader2 className="animate-spin" /> Swapping...</>}
          {status === 'success' && 'Trade Success!'}
          {status === 'idle' && (isBuy ? `Buy ${token.ticker}` : `Sell ${token.ticker}`)}
        </button>

        <button
          onClick={async () => {
            if (window.ethereum) {
              await window.ethereum.request({
                method: 'wallet_watchAsset',
                params: {
                  type: 'ERC20',
                  options: {
                    address: token.token_address,
                    symbol: token.ticker,
                    decimals: 18,
                    image: token.image_url,
                  },
                },
              });
            }
          }}
          className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-500 text-xs hover:text-[var(--text-secondary)] hover:bg-slate-50 font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <Wallet size={14} className="text-[var(--text-secondary)]" />
          Add {token.ticker} to Wallet
        </button>

        <div className="bg-[var(--bg-card)] border border-[var(--border-dim)] rounded-xl p-4 text-xs text-slate-500 space-y-1.5 font-medium">
          <p className="flex justify-between">
            <span>Price Impact</span>
            <span className="text-[var(--text-secondary)]">{'< 0.1%'}</span>
          </p>
          <p className="flex justify-between">
            <span>Estimated {isBuy ? 'Received' : 'Output'}</span>
            <span className="text-blue-600 font-extrabold">{estimatedTokens} {isBuy ? token.ticker : 'USDC'}</span>
          </p>
        </div>
      </div>

      {/* Premium Styled Dialog Alert Overlay */}
      {premiumAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-[var(--bg-card)]/20 transition-all duration-200 animate-in fade-in">
          <div className="bg-[var(--bg-card)]/95 border border-[var(--border-dim)] shadow-2xl rounded-[28px] p-6 max-w-sm w-full space-y-5 transform transition-all scale-100 animate-in zoom-in-95 duration-200">
            {/* Header Icon & Title */}
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg ${
                premiumAlert.type === 'success' 
                  ? 'bg-emerald-500/10 text-emerald-600 shadow-emerald-500/10' 
                  : premiumAlert.type === 'error'
                  ? 'bg-rose-500/10 text-rose-600 shadow-rose-500/10'
                  : 'bg-blue-600/10 text-[var(--accent-cyan)] shadow-blue-500/10'
              }`}>
                {premiumAlert.type === 'success' ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                ) : premiumAlert.type === 'error' ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                ) : (
                  <Info className="w-5 h-5" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-xs font-black tracking-wider text-[var(--text-primary)] uppercase">{premiumAlert.title}</h3>
                <p className="text-[9px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">ArcOmni Alert</p>
              </div>
            </div>

            {/* Details List */}
            <div className="space-y-3 bg-[var(--bg-elevated)] border border-[var(--border-dim)] rounded-2xl p-4 font-mono text-[10px] text-[var(--text-secondary)]">
              {premiumAlert.details.map((item, idx) => (
                <div key={idx} className="flex flex-col gap-0.5">
                  <span className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest">{item.label}</span>
                  <span className="text-[10px] font-bold text-[var(--text-primary)] break-all select-all">{item.value}</span>
                </div>
              ))}
            </div>

            {/* Action Button */}
            <button
              onClick={() => {
                premiumAlert.onClose();
                setPremiumAlert(null);
              }}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-xs tracking-wider uppercase transition-all shadow-lg shadow-blue-500/25 cursor-pointer active:scale-[0.98] duration-150 flex items-center justify-center"
            >
              OK
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
