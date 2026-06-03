'use client';

import { useState } from 'react';
import { useAccount, useWriteContract, useChainId, usePublicClient } from 'wagmi';
import { parseUnits, erc20Abi } from 'viem';
import { ARCSLOTS_TOKENS, ARCSLOTS_ADDRESS } from '@/lib/arcslots/arcslots.constants';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const DONATE_ABI = [
  { inputs: [{ internalType: 'uint256', name: 'amount', type: 'uint256' }], name: 'donate', outputs: [], stateMutability: 'nonpayable', type: 'function' }
];

export function SlotDonate() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  
  const [amount, setAmount] = useState('5');
  const [isDonating, setIsDonating] = useState(false);

  const handleDonate = async () => {
    if (!isConnected || chainId !== 5042002) {
      toast.error("Connect to Arc Testnet to donate");
      return;
    }

    try {
      setIsDonating(true);
      const amountBN = parseUnits(amount, ARCSLOTS_TOKENS.USDC_DECIMALS);
      
      // 1. Approve USDC
      toast.loading('Approving USDC...', { id: 'donate' });
      const approveHash = await writeContractAsync({
        address: ARCSLOTS_TOKENS.USDC_ADDRESS as `0x${string}`,
        abi: erc20Abi,
        functionName: 'approve',
        args: [ARCSLOTS_ADDRESS as `0x${string}`, amountBN],
      });
      
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: approveHash, timeout: 120_000 });
      }

      // 2. Call Donate
      toast.loading('Sending donation...', { id: 'donate' });
      const donateHash = await writeContractAsync({
        address: ARCSLOTS_ADDRESS as `0x${string}`,
        abi: DONATE_ABI,
        functionName: 'donate',
        args: [amountBN],
      });

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: donateHash, timeout: 120_000 });
      }

      toast.success('Successfully boosted the jackpot!', { id: 'donate' });
    } catch (e: any) {
      toast.error(e?.message || 'Donation failed', { id: 'donate' });
    } finally {
      setIsDonating(false);
    }
  };

  return (
    <div className="relative mt-12 mb-16 group">
      <div className="absolute inset-0 bg-cyan-500/5 rounded-3xl blur-xl transition-all group-hover:bg-cyan-500/10"></div>
      <div className="relative bg-[#0d0e1c]/80 border border-[var(--border-dim)] rounded-3xl p-8 md:p-12 text-center max-w-3xl mx-auto backdrop-blur-sm">
        
        <h3 className="text-[11px] uppercase tracking-[0.3em] text-[var(--text-secondary)] font-bold mb-4">
          Boost The Jackpot
        </h3>
        
        <p className="text-[var(--text-secondary)] text-sm md:text-base mb-8 max-w-xl mx-auto leading-relaxed">
          Any wallet can grow the pool. 100% of your donation goes straight to the jackpot — no spin, no fee taken.
        </p>

        <div className="flex flex-col items-center gap-6">
          <div className="flex items-center gap-4">
            <input 
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-40 md:w-64 bg-[#090a12] border border-[var(--border-dim)] rounded-xl px-4 py-3 text-center text-2xl font-bold text-white focus:outline-none focus:border-cyan-500 transition-colors"
            />
            <span className="text-xl font-bold text-cyan-400">USDC</span>
          </div>

          <div className="flex items-center gap-2 md:gap-4 flex-wrap justify-center">
            {['1', '5', '10', '50'].map(val => (
              <button
                key={val}
                onClick={() => setAmount(val)}
                className={`px-4 py-1.5 rounded-full border text-xs font-bold transition-all ${amount === val ? 'border-cyan-400 text-cyan-400 bg-cyan-400/10' : 'border-[var(--border-dim)] text-[var(--text-secondary)] hover:border-[var(--border-dim)] hover:text-slate-300'}`}
              >
                {val} USDC
              </button>
            ))}
          </div>

          <button 
            onClick={handleDonate}
            disabled={isDonating || !amount || Number(amount) <= 0}
            className="mt-2 px-8 py-4 rounded-full border border-cyan-500/50 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 hover:border-cyan-400 font-bold tracking-widest text-sm transition-all flex items-center justify-center min-w-[240px] disabled:opacity-50"
          >
            {isDonating ? <Loader2 className="w-5 h-5 animate-spin" /> : `DONATE ${amount} USDC TO POOL`}
          </button>
        </div>

      </div>
    </div>
  );
}
