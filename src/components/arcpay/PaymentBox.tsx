'use client';

import React, { useState } from 'react';
import { useAccount, useSendTransaction, useWriteContract, useChainId } from 'wagmi';
import { parseUnits, parseEther, erc20Abi } from 'viem';
import { Loader2, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { ARCSLOTS_TOKENS } from '@/lib/arcslots/arcslots.constants';

export function PaymentBox({ targetWallet }: { targetWallet: string }) {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();

  const [amount, setAmount] = useState('');
  const [token, setToken] = useState<'ARC' | 'USDC'>('ARC');
  const [isSending, setIsSending] = useState(false);

  // STRICT ARC CHAIN ENFORCEMENT
  const EXPECTED_CHAIN_ID = 5042002;
  const isCorrectNetwork = chainId === EXPECTED_CHAIN_ID;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) return toast.error('Connect wallet first');
    if (!isCorrectNetwork) return toast.error('Must be on Arc Testnet (5042002)');
    if (!amount || Number(amount) <= 0) return toast.error('Invalid amount');

    try {
      setIsSending(true);
      toast.loading(`Sending ${token}...`, { id: 'payment' });

      if (token === 'ARC') {
        const value = parseEther(amount);
        const hash = await sendTransactionAsync({
          to: targetWallet as `0x${string}`,
          value,
        });
        toast.success(`Transaction sent! Hash: ${hash.slice(0, 10)}...`, { id: 'payment' });
      } else if (token === 'USDC') {
        const value = parseUnits(amount, ARCSLOTS_TOKENS.USDC_DECIMALS);
        const hash = await writeContractAsync({
          address: ARCSLOTS_TOKENS.USDC_ADDRESS as `0x${string}`,
          abi: erc20Abi,
          functionName: 'transfer',
          args: [targetWallet as `0x${string}`, value]
        });
        toast.success(`USDC sent! Hash: ${hash.slice(0, 10)}...`, { id: 'payment' });
      }

      setAmount('');
    } catch (error: any) {
      console.error(error);
      toast.error(error.shortMessage || error.message || 'Payment failed', { id: 'payment' });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <form onSubmit={handleSend} className="bg-[#090a12] p-5 rounded-2xl border border-slate-800 space-y-4">
      <h4 className="text-sm font-bold text-white mb-2">Direct Payment</h4>
      
      <div className="flex bg-black border border-slate-800 rounded-xl overflow-hidden focus-within:border-cyan-500 transition-colors">
        <input 
          type="number"
          step="0.0001"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="0.00"
          className="flex-1 bg-transparent px-4 py-3 text-white outline-none"
        />
        <select 
          value={token} 
          onChange={e => setToken(e.target.value as any)}
          className="bg-slate-900 border-l border-slate-800 text-white px-4 py-3 outline-none font-bold cursor-pointer"
        >
          <option value="ARC">ARC</option>
          <option value="USDC">USDC</option>
        </select>
      </div>

      <button 
        type="submit" 
        disabled={isSending || !amount}
        className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 rounded-xl flex justify-center items-center gap-2 transition-all disabled:opacity-50"
      >
        {isSending ? <Loader2 className="animate-spin" size={20} /> : (
          <>Pay {targetWallet.slice(0,4)}...{targetWallet.slice(-4)} <ArrowRight size={18} /></>
        )}
      </button>

      {!isCorrectNetwork && (
        <p className="text-xs text-red-400 text-center">Switch to Arc Testnet to pay</p>
      )}
    </form>
  );
}
