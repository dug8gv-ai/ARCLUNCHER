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

      const supply = Number(token.initial_supply || token.supply || 0);
      if (supply === 0) {
        console.error("Token supply is 0 or undefined");
        return;
      }

      const supply = Number(token.initial_supply || token.supply || 1000000000);
      const initialTokens = supply; 
      const initialUSDC = supply * 0.01; // Start price at 0.01
      const k = initialUSDC * initialTokens;

      let currentUSDC = initialUSDC;
      let currentTokens = initialTokens;

      swaps?.forEach(s => {
        if (s.is_buy) {
          currentUSDC += Number(s.usdc_amount);
          currentTokens -= Number(s.token_amount);
        } else {
          currentUSDC -= Number(s.usdc_amount);
          currentTokens += Number(s.token_amount);
        }
      });

      // Ensure currentUSDC never goes below initialUSDC (Price Floor)
      if (currentUSDC < initialUSDC) currentUSDC = initialUSDC;
      if (currentTokens > initialTokens) currentTokens = initialTokens;

      const dX = Number(val);
      if (isBuy) {
        // Buy: Input is USDC (dX), Output is Tokens
        const newUSDC = currentUSDC + dX;
        const newTokens = k / newUSDC;
        const tokensOut = currentTokens - newTokens;
        setEstimatedTokens(Math.floor(tokensOut).toLocaleString());
      } else {
        // Sell: Input is Tokens (dX), Output is USDC
        const newTokens = currentTokens + dX;
        const newUSDC = k / newTokens;
        let usdcOut = currentUSDC - newUSDC;
        
        // Floor protection
        if (currentUSDC - usdcOut < initialUSDC) {
          usdcOut = currentUSDC - initialUSDC;
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

      alert(`SUCCESS! Transaction confirmed.`);
      
      // Step 4: Prompt to add token to MetaMask
      if (window.ethereum) {
        try {
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
        } catch (e) {
          console.error("User rejected adding token to wallet");
        }
      }

      setStatus('success');
      window.location.reload(); 

    } catch (error: any) {
      console.error(error);
      alert(error.shortMessage || error.message);
      setStatus('idle');
    }
  };

  return (
    <div className="glass-panel p-6 border-cyan-500/20">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-bold text-white flex items-center gap-2">
          <ArrowUpDown size={18} className="text-cyan-400" />
          Trade {token.ticker}
        </h3>
        <div className="flex bg-black/40 rounded-lg p-1 text-xs">
          <button 
            onClick={() => setIsBuy(true)}
            className={`px-4 py-1.5 rounded-md transition-all ${isBuy ? 'bg-green-500/20 text-green-400 font-bold' : 'text-gray-500'}`}
          >
            BUY
          </button>
          <button 
            onClick={() => setIsBuy(false)}
            className={`px-4 py-1.5 rounded-md transition-all ${!isBuy ? 'bg-red-500/20 text-red-400 font-bold' : 'text-gray-500'}`}
          >
            SELL
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-black/20 border border-gray-800 rounded-xl p-4">
          <div className="flex justify-between text-[10px] text-gray-500 mb-2">
            <span>{isBuy ? 'Amount in USDC' : `Amount in ${token.ticker}`}</span>
            <div className="flex items-center gap-3">
              {isBuy ? (
                <>
                  <span className="flex items-center gap-1"><Wallet size={10}/> {balance} USDC</span>
                  <button 
                    onClick={() => setAmount(balance)}
                    className="bg-green-500/10 text-green-400 px-2 py-0.5 rounded border border-green-500/20 font-black hover:bg-green-500 hover:text-black transition-all"
                  >
                    MAX BUY
                  </button>
                </>
              ) : (
                <>
                  <span className="flex items-center gap-1 text-cyan-400"><TrendingUp size={10}/> {tokenBalance} {token.ticker}</span>
                  <button 
                    onClick={() => setAmount(tokenBalance)}
                    className="bg-red-500/10 text-red-400 px-2 py-0.5 rounded border border-red-500/20 font-black hover:bg-red-500 hover:text-black transition-all"
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
            className="w-full bg-transparent text-2xl font-mono text-white outline-none"
          />
        </div>


        <button 
          onClick={handleTrade}
          disabled={status !== 'idle'}
          className={`w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 ${
            isBuy 
              ? 'bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/20' 
              : 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20'
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
          className="w-full py-2 rounded-lg border border-gray-800 text-gray-400 text-xs hover:text-white hover:border-gray-600 transition-all flex items-center justify-center gap-2"
        >
          <Wallet size={14} />
          Add {token.ticker} to Wallet
        </button>

        <div className="bg-cyan-500/5 border border-cyan-500/10 rounded-lg p-3 text-[10px] text-gray-500">
          <p className="flex justify-between mb-1">
            <span>Price Impact</span>
            <span className="text-gray-300">{'< 0.1%'}</span>
          </p>
          <p className="flex justify-between">
            <span>Estimated {isBuy ? 'Received' : 'Output'}</span>
            <span className="text-cyan-400 font-bold">{estimatedTokens} {isBuy ? token.ticker : 'USDC'}</span>
          </p>

        </div>
      </div>
    </div>
  );
}
