'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAccount, useSendTransaction, useWriteContract, useChainId } from 'wagmi';
import { parseUnits, parseEther, erc20Abi, isAddress } from 'viem';
import { Loader2, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { ARCSLOTS_TOKENS } from '@/lib/arcslots/arcslots.constants';

export function PaymentBox({ targetWallet }: { targetWallet: string }) {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();

  const [amount, setAmount] = useState('');
  const [token, setToken] = useState<'ARC' | 'USDC'>('ARC');
  const [isSending, setIsSending] = useState(false);

  // STRICT ARC CHAIN ENFORCEMENT
  const EXPECTED_CHAIN_ID = 5042002;
  const isCorrectNetwork = chainId === EXPECTED_CHAIN_ID;

  const isValidTarget = isAddress(targetWallet);
  const shortAddr = isValidTarget
    ? `${targetWallet.slice(0, 6)}...${targetWallet.slice(-4)}`
    : targetWallet;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) return toast.error('Connect wallet first');
    if (!isCorrectNetwork) return toast.error('Must be on Arc Testnet (5042002)');
    if (!amount || Number(amount) <= 0) return toast.error('Invalid amount');
    if (!isValidTarget) return toast.error('Invalid wallet address — cannot send to a username directly');

    try {
      setIsSending(true);
      toast.loading(`Sending ${amount} ${token}...`, { id: 'payment' });

      if (token === 'ARC') {
        const value = parseEther(amount);
        const hash = await sendTransactionAsync({
          to: targetWallet as `0x${string}`,
          value,
        });
        toast.success(`Transaction sent! Hash: ${hash.slice(0, 10)}...`, { id: 'payment' });
        // Log payment as chat message so receiver sees it in inbox
        await supabase.from('arcpay_chats').insert({
          sender_wallet: address?.toLowerCase(),
          receiver_wallet: targetWallet.toLowerCase(),
          message: `💰 Sent ${amount} ARC`,
        });
      } else if (token === 'USDC') {
        const value = parseUnits(amount, ARCSLOTS_TOKENS.USDC_DECIMALS);
        const hash = await writeContractAsync({
          address: ARCSLOTS_TOKENS.USDC_ADDRESS as `0x${string}`,
          abi: erc20Abi,
          functionName: 'transfer',
          args: [targetWallet as `0x${string}`, value]
        });
        toast.success(`USDC sent! Hash: ${hash.slice(0, 10)}...`, { id: 'payment' });
        // Log payment as chat message so receiver sees it in inbox
        await supabase.from('arcpay_chats').insert({
          sender_wallet: address?.toLowerCase(),
          receiver_wallet: targetWallet.toLowerCase(),
          message: `💰 Sent ${amount} USDC`,
        });
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
    <form onSubmit={handleSend} className="bg-slate-50 border border-slate-200/80 p-5 rounded-2xl space-y-4">
      <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">Direct Payment</h4>

      <div className="flex bg-white border border-slate-200 rounded-xl overflow-hidden focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
        <input
          type="number"
          step="0.0001"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="0.00"
          className="flex-1 bg-transparent px-4 py-3 text-slate-800 font-semibold outline-none"
        />
        <select
          value={token}
          onChange={e => setToken(e.target.value as any)}
          className="bg-slate-50 border-l border-slate-200 text-slate-700 px-4 py-3 outline-none font-bold cursor-pointer"
        >
          <option value="ARC">ARC</option>
          <option value="USDC">USDC</option>
        </select>
      </div>

      <button
        type="submit"
        disabled={isSending || !amount || !isValidTarget}
        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl flex justify-center items-center gap-2 transition-all disabled:opacity-50"
      >
        {isSending ? <Loader2 className="animate-spin" size={20} /> : (
          <>Pay {shortAddr} <ArrowRight size={18} /></>
        )}
      </button>

      {!isCorrectNetwork && (
        <p className="text-xs text-red-500 text-center font-semibold">Switch to Arc Testnet to pay</p>
      )}
    </form>
  );
}
