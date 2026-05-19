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
  const [balance, setBalance] = useState('0');
  const [tokenBalance, setTokenBalance] = useState('0');
  const [isBuy, setIsBuy] = useState(true);
  const [status, setStatus] = useState<'idle' | 'approving' | 'swapping' | 'success'>('idle');

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
    } else {
      setAmount(tokenBalance);
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

      // VIRTUAL LIQUIDITY POOL FOR DYNAMIC "MEME COIN" CHART PATTERNS
      // We use a small virtual pool so that regular trades (e.g., $10 - $100)
      // create massive, visible green and red candles just like real meme coins.
      const VIRTUAL_USDC = 100; // Small liquidity for high volatility
      const VIRTUAL_TOKENS = VIRTUAL_USDC / 0.01; // 10,000 tokens virtual supply
      const k = VIRTUAL_USDC * VIRTUAL_TOKENS;

      let currentUSDC = VIRTUAL_USDC;
      let currentTokens = VIRTUAL_TOKENS;

      swaps?.forEach(s => {
        if (s.is_buy) {
          currentUSDC += Number(s.usdc_amount);
          currentTokens -= Number(s.token_amount);
        } else {
          currentUSDC -= Number(s.usdc_amount);
          currentTokens += Number(s.token_amount);
        }
      });

      // Strict Floor Protection (Price never below 0.01)
      if (currentUSDC < VIRTUAL_USDC) currentUSDC = VIRTUAL_USDC;
      if (currentTokens > VIRTUAL_TOKENS) currentTokens = VIRTUAL_TOKENS;

      const dX = Number(val);
      if (isBuy) {
        // Buy: Input is USDC (dX), Output is Tokens
        const newUSDC = currentUSDC + dX;
        const newTokens = k / newUSDC;
        const tokensOut = currentTokens - newTokens;
        setEstimatedTokens((tokensOut).toFixed(2));
      } else {
        // Sell: Input is Tokens (dX), Output is USDC
        const newTokens = currentTokens + dX;
        const newUSDC = k / newTokens;
        let usdcOut = currentUSDC - newUSDC;
        
        // Floor protection
        if (currentUSDC - usdcOut < VIRTUAL_USDC) {
          usdcOut = currentUSDC - VIRTUAL_USDC;
        }
        
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
      alert('Please connect your wallet first!');
      return;
    }
    if (!amount || Number(amount) <= 0) return;
    
    const tokenAmountForDB = Number(estimatedTokens.replace(/,/g, ''));
    if (tokenAmountForDB <= 0) {
      alert("Error: Estimated tokens is 0. Wait for calculation.");
      return;
    }

    // CONFIG DEBUG
    alert(`SYSTEM CONFIG:\nLauncher: ${ARC_LAUNCHER_ADDRESS}\nUSDC: ${USDC_ADDRESS}\nNetwork: Arc Testnet`);

    // DEBUG ALERT
    alert(`TRADE INFO:\nToken: ${token.token_address}\nUSDC: ${amount}\nTokens: ${tokenAmountForDB.toLocaleString()}`);

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

      // Sync with Supabase (Lowercase)
      const cleanEstimate = Number(estimatedTokens.replace(/,/g, ''));
      const swapData = {
        user_address: userAddress?.toLowerCase(),
        token_address: token.token_address.toLowerCase(),
        usdc_amount: isBuy ? Number(amount) : cleanEstimate,
        token_amount: isBuy ? cleanEstimate : Number(amount),
        is_buy: isBuy,
        type: isBuy ? 'buy' : 'sell'
      };

      const { error: dbError } = await supabase.from('token_swaps').insert(swapData);
      if (dbError) alert("Database Sync Error: " + dbError.message);

      // Track user volume & points: 10 USDC Volume = 1 ARCL Point. Store in user_stats.
      try {
        if (userAddress) {
          const swapUsdcAmount = Number(isBuy ? amount : cleanEstimate);
          const pointsEarned = swapUsdcAmount / 10;
          const walletLower = userAddress.toLowerCase();

          const { data: currentStats, error: statsFetchError } = await supabase
            .from('user_stats')
            .select('*')
            .eq('wallet', walletLower)
            .single();

          if (currentStats && !statsFetchError) {
            const newVolume = Number(currentStats.total_volume || 0) + swapUsdcAmount;
            const newPoints = Number(currentStats.points || 0) + pointsEarned;
            await supabase
              .from('user_stats')
              .update({
                total_volume: newVolume,
                points: newPoints
              })
              .eq('wallet', walletLower);
          } else {
            await supabase
              .from('user_stats')
              .insert({
                wallet: walletLower,
                total_volume: swapUsdcAmount,
                points: pointsEarned
              });
          }
        }
      } catch (statsErr) {
        console.error("Error updating user stats:", statsErr);
      }

      alert(`SUCCESS! Transaction confirmed.`);

      setStatus('success');
      window.location.reload(); 

    } catch (error: any) {
      console.error(error);
      alert(error.shortMessage || error.message);
      setStatus('idle');
    }
  };

  return (
    <div className="glass-panel p-6 bg-white border border-slate-200/80">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-extrabold text-slate-800 flex items-center gap-2 text-base">
          <ArrowUpDown size={18} className="text-blue-600" />
          Trade {token.ticker}
        </h3>
        <div className="flex bg-slate-100 rounded-xl p-1 text-xs">
          <button 
            onClick={() => setIsBuy(true)}
            className={`px-4.5 py-1.5 rounded-lg transition-all cursor-pointer font-bold ${isBuy ? 'bg-green-100 text-green-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            BUY
          </button>
          <button 
            onClick={() => setIsBuy(false)}
            className={`px-4.5 py-1.5 rounded-lg transition-all cursor-pointer font-bold ${!isBuy ? 'bg-red-100 text-red-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            SELL
          </button>
        </div>
      </div>

      <div className="space-y-5">
        <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4">
          <div className="flex justify-between text-[11px] text-slate-500 font-bold mb-2.5">
            <span>{isBuy ? 'Amount in USDC' : `Amount in ${token.ticker}`}</span>
            <div className="flex items-center gap-3">
              {isBuy ? (
                <>
                  <span className="flex items-center gap-1 font-medium"><Wallet size={11} className="text-slate-400" /> {balance} USDC</span>
                  <button 
                    onClick={() => setAmount(balance)}
                    className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md border border-blue-100 hover:bg-blue-600 hover:text-white transition-all text-[10px] font-black cursor-pointer"
                  >
                    MAX BUY
                  </button>
                </>
              ) : (
                <>
                  <span className="flex items-center gap-1 font-medium"><TrendingUp size={11} className="text-slate-400" /> {tokenBalance} {token.ticker}</span>
                  <button 
                    onClick={() => setAmount(tokenBalance)}
                    className="bg-red-50 text-red-600 px-2 py-0.5 rounded-md border border-red-100 hover:bg-red-600 hover:text-white transition-all text-[10px] font-black cursor-pointer"
                  >
                    MAX SELL
                  </button>
                </>
              )}
            </div>
          </div>
          <input 
            type="number" 
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full bg-transparent text-3xl font-bold font-mono text-slate-800 outline-none placeholder:text-slate-300"
          />
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
          className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-500 text-xs hover:text-slate-800 hover:bg-slate-50 font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <Wallet size={14} className="text-slate-400" />
          Add {token.ticker} to Wallet
        </button>

        <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 text-xs text-slate-500 space-y-1.5 font-medium">
          <p className="flex justify-between">
            <span>Price Impact</span>
            <span className="text-slate-800">{'< 0.1%'}</span>
          </p>
          <p className="flex justify-between">
            <span>Estimated {isBuy ? 'Received' : 'Output'}</span>
            <span className="text-blue-600 font-extrabold">{estimatedTokens} {isBuy ? token.ticker : 'USDC'}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
