'use client';

import { useState } from 'react';
import { useAccount, useWriteContract, usePublicClient } from 'wagmi';
import { parseUnits, erc20Abi } from 'viem';
import { supabase } from '@/lib/supabase';
import { Loader2, ArrowUpDown, Wallet } from 'lucide-react';

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

const ARC_LAUNCHER_ADDRESS = process.env.NEXT_PUBLIC_LAUNCHER_ADDRESS || '';
const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS || '0x3600000000000000000000000000000000000000';

export function TradingPanel({ token }: TradingPanelProps) {
  const { isConnected, address: userAddress } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [amount, setAmount] = useState('');
  const [balance, setBalance] = useState('0');
  const [isBuy, setIsBuy] = useState(true);
  const [status, setStatus] = useState<'idle' | 'approving' | 'swapping' | 'success'>('idle');

  const fetchBalance = async () => {
    if (!userAddress || !publicClient) return;
    try {
      const bal = await publicClient.readContract({
        address: USDC_ADDRESS as `0x${string}`,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [userAddress as `0x${string}`],
      });
      setBalance((Number(bal) / 1000000).toFixed(2));
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchBalance();
    
    // Refresh balance every 10 seconds or when user changes
    const interval = setInterval(fetchBalance, 10000);
    return () => clearInterval(interval);
  }, [userAddress, publicClient]);

  if (!token) return null;

  const handleTrade = async () => {
    if (!isConnected) return alert("Please connect wallet");
    if (!amount || isNaN(Number(amount))) return alert("Enter valid amount");

    try {
      setStatus('approving');
      const usdcAmount = parseUnits(amount, 6);
      const tokenAmount = parseUnits((Number(amount) * 1000).toString(), 18); // Mock price: 1 USDC = 1000 Tokens for now

      if (isBuy) {
        // Approve USDC for Buying
        const approveHash = await writeContractAsync({
          address: USDC_ADDRESS as `0x${string}`,
          abi: erc20Abi,
          functionName: 'approve',
          args: [ARC_LAUNCHER_ADDRESS as `0x${string}`, usdcAmount],
        });
        await publicClient?.waitForTransactionReceipt({ hash: approveHash });
      }

      setStatus('swapping');
      const swapHash = await writeContractAsync({
        address: ARC_LAUNCHER_ADDRESS as `0x${string}`,
        abi: ARC_LAUNCHER_ABI,
        functionName: 'swap',
        args: [token.token_address as `0x${string}`, usdcAmount, tokenAmount, isBuy],
      });

      await publicClient?.waitForTransactionReceipt({ hash: swapHash });

      // Sync with Supabase
      await supabase.from('token_swaps').insert({
        user_address: userAddress,
        token_address: token.token_address,
        usdc_amount: Number(amount),
        token_amount: Number(amount) * 1000,
        is_buy: isBuy
      });

      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
      setAmount('');

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
          <div className="flex justify-between text-xs text-gray-500 mb-2">
            <span>Amount in USDC</span>
            <span className="flex items-center gap-1"><Wallet size={12}/> Balance: {balance} USDC</span>
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

        <div className="bg-cyan-500/5 border border-cyan-500/10 rounded-lg p-3 text-[10px] text-gray-500">
          <p className="flex justify-between mb-1">
            <span>Price Impact</span>
            <span className="text-gray-300">{'< 0.1%'}</span>
          </p>
          <p className="flex justify-between">
            <span>Estimated Received</span>
            <span className="text-cyan-400 font-bold">{Number(amount) * 1000} {token.ticker}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
