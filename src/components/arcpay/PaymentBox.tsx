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
  const [paymentMessage, setPaymentMessage] = useState('');
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
          message: paymentMessage ? `💰 Sent ${amount} ARC: ${paymentMessage}` : `💰 Sent ${amount} ARC`,
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
          message: paymentMessage ? `💰 Sent ${amount} USDC: ${paymentMessage}` : `💰 Sent ${amount} USDC`,
        });
      }

      setAmount('');
      setPaymentMessage('');
    } catch (error: any) {
      console.error(error);
      toast.error(error.shortMessage || error.message || 'Payment failed', { id: 'payment' });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <form onSubmit={handleSend} className="bg-[var(--bg-input)] border border-[var(--border-dim)] p-5 rounded-2xl flex flex-col gap-4 shadow-sm">
      <h4 className="text-[10px] font-black text-[var(--accent-gold-2)] uppercase tracking-wider font-sans m-0">Direct Payment</h4>

      {/* Amount + Token in one row */}
      <div className="flex border border-[var(--border-dim)] rounded-xl overflow-hidden bg-white focus-within:border-[var(--accent-gold)] transition-colors">
        <input
          type="number"
          step="0.0001"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="Enter amount..."
          className="flex-1 bg-transparent border-none outline-none px-4 py-3 text-[var(--text-primary)] font-sans font-bold text-base min-h-unset"
          style={{ minHeight: 'unset' }}
        />
        <select
          value={token}
          onChange={e => setToken(e.target.value as any)}
          className="bg-[var(--bg-elevated)] border-l border-[var(--border-dim)] text-[var(--text-primary)] px-4 py-3 outline-none font-bold cursor-pointer font-sans text-xs tracking-wider"
        >
          <option value="ARC" className="bg-white text-gray-800">ARC</option>
          <option value="USDC" className="bg-white text-gray-800">USDC</option>
        </select>
      </div>

      <button
        type="submit"
        disabled={isSending || !amount || !isValidTarget}
        className={`w-full py-3.5 rounded-xl font-sans font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer ${
          isSending || !amount || !isValidTarget
            ? 'bg-amber-500/35 text-white cursor-not-allowed'
            : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-amber-500/10'
        }`}
      >
        {isSending ? <Loader2 className="animate-spin" size={16} /> : (
          <>Pay {shortAddr} <ArrowRight size={14} /></>
        )}
      </button>

      {!isCorrectNetwork && (
        <p className="text-[11px] text-red-500 text-center font-bold m-0 animate-pulse">
          Switch to Arc Testnet to pay
        </p>
      )}
    </form>
  );
}
