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
    <form onSubmit={handleSend} style={{ background: 'rgba(6,8,20,0.6)', border: '1px solid var(--border-dim)', padding: '16px', borderRadius: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h4 style={{ fontSize: 10, fontWeight: 900, color: 'var(--accent-cyan)', textTransform: 'uppercase', letterSpacing: 2, fontFamily: 'Orbitron, sans-serif', margin: 0 }}>Direct Payment</h4>

      {/* Amount + Token in one row */}
      <div style={{ display: 'flex', border: '1px solid rgba(0,229,255,0.3)', borderRadius: 10, overflow: 'hidden', background: 'rgba(4,6,28,0.95)' }}>
        <input
          type="number"
          step="0.0001"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="Enter amount..."
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            padding: '14px 14px',
            color: 'var(--text-primary)',
            fontFamily: 'Orbitron, sans-serif',
            fontWeight: 700,
            fontSize: 16,
            minHeight: 'unset',
          }}
        />
        <select
          value={token}
          onChange={e => setToken(e.target.value as any)}
          style={{
            background: 'rgba(6,10,38,0.95)',
            borderLeft: '1px solid rgba(0,229,255,0.2)',
            color: 'var(--accent-cyan)',
            padding: '14px 14px',
            outline: 'none',
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'Orbitron, sans-serif',
            fontSize: 12,
            letterSpacing: 1,
          }}
        >
          <option value="ARC">ARC</option>
          <option value="USDC">USDC</option>
        </select>
      </div>

      <button
        type="submit"
        disabled={isSending || !amount || !isValidTarget}
        style={{
          width: '100%',
          padding: '13px',
          background: isSending || !amount || !isValidTarget
            ? 'rgba(41,121,255,0.3)'
            : 'linear-gradient(135deg, #7c3aff, #2979ff)',
          color: '#ffffff',
          border: 'none',
          borderRadius: 10,
          fontFamily: 'Orbitron, sans-serif',
          fontWeight: 900,
          fontSize: 11,
          letterSpacing: 2,
          textTransform: 'uppercase',
          cursor: isSending || !amount || !isValidTarget ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          boxShadow: '0 0 20px rgba(124,58,255,0.35)',
          transition: 'all 0.15s',
        }}
      >
        {isSending ? <Loader2 className="animate-spin" size={16} /> : (
          <>Pay {shortAddr} <ArrowRight size={14} /></>
        )}
      </button>

      {!isCorrectNetwork && (
        <p style={{ fontSize: 11, color: '#ff1744', textAlign: 'center', fontWeight: 600, margin: 0 }}>
          Switch to Arc Testnet to pay
        </p>
      )}
    </form>
  );
}
