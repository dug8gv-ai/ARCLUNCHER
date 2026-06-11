'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CreditCard, Wallet, ShieldCheck, Plus, Copy, Check, 
  Loader2, Award, Zap, HelpCircle, CheckCircle, RefreshCw, Eye, EyeOff
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface SmartWalletData {
  address: string;
  privateKey?: string;
  provider: string;
  blockchain: string;
  state: string;
  walletId?: string;
}

export default function CircleHub() {
  const { isConnected, address: userAddress } = useAccount();

  // Active Tab inside Circle Hub
  const [activeSubTab, setActiveSubTab] = useState<'smart-wallets' | 'fiat-gateway'>('smart-wallets');

  // Smart Wallet State
  const [walletUsername, setWalletUsername] = useState('');
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [createdWallet, setCreatedWallet] = useState<SmartWalletData | null>(null);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  // Fiat Gateway State
  const [cardHolder, setCardHolder] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiryMonth, setCardExpiryMonth] = useState('');
  const [cardExpiryYear, setCardExpiryYear] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentReceipt, setPaymentReceipt] = useState<any | null>(null);

  const handleCreateSmartWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletUsername) return;

    setIsProvisioning(true);
    setCreatedWallet(null);

    try {
      const response = await fetch('/api/circle/wallet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: walletUsername }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to create wallet');
      }

      const data = await response.json();
      setCreatedWallet({
        address: data.address,
        privateKey: data.privateKey,
        provider: data.provider,
        blockchain: data.blockchain,
        state: data.state,
        walletId: data.walletId,
      });

      // Award +5 points for provisioning a smart wallet!
      if (isConnected && userAddress) {
        try {
          const walletLower = userAddress.toLowerCase();
          const { data: stats } = await supabase.from('user_stats').select('*').eq('wallet', walletLower);
          
          if (stats && stats.length > 0) {
            await supabase.from('user_stats').update({
              points: Number(stats[0].points || 0) + 5
            }).eq('wallet', walletLower);
          } else {
            await supabase.from('user_stats').insert({
              wallet: walletLower,
              points: 5,
              total_volume: 0
            });
          }
        } catch (dbErr) {
          console.error('Error logging wallet point rewards:', dbErr);
        }
      }

    } catch (err: any) {
      alert(err.message || 'Error occurred during provisioning.');
    } finally {
      setIsProvisioning(false);
    }
  };

  const handleCardCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !userAddress) {
      alert('Please connect your wallet first!');
      return;
    }

    const amt = Number(purchaseAmount);
    if (!purchaseAmount || amt <= 0) {
      alert('Please enter a valid purchase amount.');
      return;
    }

    setIsProcessingPayment(true);
    setPaymentReceipt(null);

    try {
      const response = await fetch('/api/circle/payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: purchaseAmount,
          userAddress: userAddress,
          cardDetails: {
            name: cardHolder,
            expiryMonth: cardExpiryMonth,
            expiryYear: cardExpiryYear,
          }
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to process payment');
      }

      const data = await response.json();
      setPaymentReceipt(data);

      // Inject purchased USDC into user's simulated wallet balances!
      const localUsdc = localStorage.getItem(`sim_usdc_${userAddress.toLowerCase()}`);
      const curBal = localUsdc ? Number(localUsdc) : 1000.00;
      const newBal = curBal + amt;
      localStorage.setItem(`sim_usdc_${userAddress.toLowerCase()}`, newBal.toFixed(2));

      // Trigger reward points +1 per 10 USDC purchased
      try {
        const pointsEarned = amt / 10;
        const walletLower = userAddress.toLowerCase();
        const { data: stats } = await supabase.from('user_stats').select('*').eq('wallet', walletLower);

        if (stats && stats.length > 0) {
          await supabase.from('user_stats').update({
            total_volume: Number(stats[0].total_volume || 0) + amt,
            points: Number(stats[0].points || 0) + pointsEarned
          }).eq('wallet', walletLower);
        } else {
          await supabase.from('user_stats').insert({
            wallet: walletLower,
            total_volume: amt,
            points: pointsEarned
          });
        }
      } catch (dbErr) {
        console.error('Error logging fiat payment stats:', dbErr);
      }

    } catch (err: any) {
      alert(err.message || 'Payment processing failed.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const copyToClipboard = (text: string, type: 'address' | 'key') => {
    navigator.clipboard.writeText(text);
    if (type === 'address') {
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    } else {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      
      {/* Tab Selector Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between card rounded-3xl p-5 shadow-sm gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[rgba(0,242,254,0.05)] flex items-center justify-center border border-[var(--border-dim)] text-[var(--accent-cyan)] shadow-sm shadow-blue-500/5">
            <CreditCard size={22} />
          </div>
          <div>
            <span className="text-[10px] uppercase font-extrabold tracking-widest text-[var(--accent-cyan)] block">Circle Developer Suite</span>
            <h2 className="text-xl font-black text-[var(--text-primary)] tracking-tight">Circle Web3 & Fiat Hub</h2>
          </div>
        </div>

        <div className="bg-slate-100 p-1.5 rounded-2xl flex border border-[var(--border-dim)] self-start sm:self-auto">
          <button
            onClick={() => setActiveSubTab('smart-wallets')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black tracking-wide transition-all cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'smart-wallets' 
                ? 'bg-[var(--bg-card)] text-[var(--accent-cyan)] shadow-sm border border-[var(--border-dim)]' 
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Wallet size={14} />
            Smart Wallets
          </button>
          <button
            onClick={() => setActiveSubTab('fiat-gateway')}
            className={`px-4 py-2.5 rounded-xl text-xs font-black tracking-wide transition-all cursor-pointer flex items-center gap-2 ${
              activeSubTab === 'fiat-gateway' 
                ? 'bg-[var(--bg-card)] text-[var(--accent-cyan)] shadow-sm border border-[var(--border-dim)]' 
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <CreditCard size={14} />
            Fiat Gateway
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* SMART WALLET GENERATOR PANEL */}
        {activeSubTab === 'smart-wallets' && (
          <>
            <div className="lg:col-span-6 space-y-6">
              <div className="card rounded-[32px] p-6 sm:p-8 shadow-sm space-y-6">
                <div className="border-b border-[var(--border-dim)] pb-5">
                  <h3 className="font-extrabold text-[var(--text-primary)] text-sm">Provision Smart Wallet</h3>
                  <p className="text-[10px] text-[var(--text-secondary)] font-semibold">Generate highly secure programmable Web3 wallets powered by Circle infrastructure.</p>
                </div>

                <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-secondary)] bg-[var(--bg-card)] border border-[var(--border-dim)] p-3.5 rounded-xl">
                  <Zap size={14} className="text-[var(--accent-cyan)] shrink-0" />
                  <span>Creates authentic developer-controlled SCA wallets under automated sandbox rules. Get +5 points!</span>
                </div>

                <form onSubmit={handleCreateSmartWallet} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest block">Associate Account ID</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. user_or_username"
                      value={walletUsername}
                      onChange={(e) => setWalletUsername(e.target.value)}
                      className="w-full px-4 py-3.5 bg-[var(--bg-card)] border border-[var(--border-dim)] rounded-2xl text-xs font-semibold outline-none focus:border-blue-500 focus:bg-[var(--bg-card)] transition-all"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isProvisioning}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-sm tracking-wide uppercase transition-all shadow-md shadow-blue-500/10 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isProvisioning ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Generating Smart Wallet...
                      </>
                    ) : (
                      <>
                        <Plus size={16} />
                        Deploy Smart Account
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>

            <div className="lg:col-span-6">
              <AnimatePresence mode="wait">
                {createdWallet ? (
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    className="card rounded-[32px] p-6 sm:p-8 shadow-sm space-y-6"
                  >
                    <div className="flex items-center justify-between border-b border-[var(--border-dim)] pb-5">
                      <div>
                        <h4 className="font-extrabold text-[var(--text-primary)] text-sm">Deployment Successful</h4>
                        <p className="text-[10px] text-[var(--text-secondary)] font-semibold mt-0.5">SCA Cryptographic Smart Vault</p>
                      </div>
                      <span className="bg-emerald-50 text-emerald-600 border border-emerald-100 text-[8px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                        {createdWallet.state}
                      </span>
                    </div>

                    <div className="space-y-4">
                      {/* Address Card */}
                      <div className="bg-[var(--bg-card)] border border-[var(--border-dim)] rounded-2xl p-4 space-y-2">
                        <div className="flex justify-between items-center text-[9px] font-extrabold text-[var(--text-secondary)] uppercase tracking-wider">
                          <span>Wallet Address</span>
                          <button
                            onClick={() => copyToClipboard(createdWallet.address, 'address')}
                            className="text-[var(--accent-cyan)] hover:text-[var(--accent-cyan)] flex items-center gap-1 cursor-pointer font-bold"
                          >
                            {copiedAddress ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
                            {copiedAddress ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                        <span className="text-xs font-mono font-black text-[var(--text-primary)] break-all select-all block">
                          {createdWallet.address}
                        </span>
                      </div>

                      {/* Private Key Card (if generated by fallback vault) */}
                      {createdWallet.privateKey && (
                        <div className="bg-rose-50/40 border border-rose-100 rounded-2xl p-4 space-y-2">
                          <div className="flex justify-between items-center text-[9px] font-extrabold text-rose-500 uppercase tracking-wider">
                            <span>Secret Private Key</span>
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => setShowPrivateKey(!showPrivateKey)}
                                className="text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer font-bold"
                              >
                                {showPrivateKey ? <EyeOff size={11} /> : <Eye size={11} />}
                                {showPrivateKey ? 'Hide' : 'Reveal'}
                              </button>
                              <button
                                onClick={() => copyToClipboard(createdWallet.privateKey!, 'key')}
                                className="text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer font-bold"
                              >
                                {copiedKey ? <Check size={11} className="text-green-500" /> : <Copy size={11} />}
                                {copiedKey ? 'Copied' : 'Copy'}
                              </button>
                            </div>
                          </div>
                          <span className="text-xs font-mono font-black text-[var(--text-primary)] break-all select-all block">
                            {showPrivateKey ? createdWallet.privateKey : '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••'}
                          </span>
                        </div>
                      )}

                      {/* Meta parameters */}
                      <div className="grid grid-cols-2 gap-4 text-[10px] text-[var(--text-secondary)] font-bold border-t border-[var(--border-dim)] pt-4">
                        <div className="space-y-0.5">
                          <span className="text-[var(--text-secondary)] font-medium">Provider:</span>
                          <p className="text-[var(--text-primary)] font-extrabold">{createdWallet.provider}</p>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[var(--text-secondary)] font-medium">Target Blockchain:</span>
                          <p className="text-[var(--text-primary)] font-extrabold">{createdWallet.blockchain}</p>
                        </div>
                      </div>

                    </div>
                  </motion.div>
                ) : (
                  <div className="border border-dashed border-[var(--border-dim)] rounded-[32px] p-12 text-center text-[var(--text-secondary)] space-y-3">
                    <Wallet size={36} className="mx-auto text-slate-300 animate-pulse" />
                    <div>
                      <h4 className="font-extrabold text-slate-650 text-xs">No Active Smart Account</h4>
                      <p className="text-[10px] text-[var(--text-secondary)] font-semibold mt-1">Associate an account ID to deploy a cryptographic wallet set.</p>
                    </div>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </>
        )}

        {/* FIAT CREDIT CARD GATEWAY PANEL */}
        {activeSubTab === 'fiat-gateway' && (
          <>
            <div className="lg:col-span-7 space-y-6">
              <div className="card rounded-[32px] p-6 sm:p-8 shadow-sm space-y-6">
                <div className="border-b border-[var(--border-dim)] pb-5">
                  <h3 className="font-extrabold text-[var(--text-primary)] text-sm">Credit Card Payments Gateway</h3>
                  <p className="text-[10px] text-[var(--text-secondary)] font-semibold">Buy USDC stablecoins securely using Visa/Mastercard sandbox payment routes.</p>
                </div>

                <form onSubmit={handleCardCheckout} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest block">Cardholder Name</label>
                      <input
                        type="text"
                        required
                        placeholder="John Doe"
                        value={cardHolder}
                        onChange={(e) => setCardHolder(e.target.value)}
                        className="w-full px-4 py-3 bg-[var(--bg-card)] border border-[var(--border-dim)] rounded-xl text-xs font-semibold outline-none focus:border-blue-500 focus:bg-[var(--bg-card)]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest block">Card Number</label>
                      <input
                        type="text"
                        required
                        maxLength={19}
                        placeholder="4111 2222 3333 4444"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        className="w-full px-4 py-3 bg-[var(--bg-card)] border border-[var(--border-dim)] rounded-xl text-xs font-mono outline-none focus:border-blue-500 focus:bg-[var(--bg-card)]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest block">Exp Month</label>
                      <input
                        type="text"
                        required
                        maxLength={2}
                        placeholder="12"
                        value={cardExpiryMonth}
                        onChange={(e) => setCardExpiryMonth(e.target.value)} // Exp month hook
                        className="w-full px-4 py-3 bg-[var(--bg-card)] border border-[var(--border-dim)] rounded-xl text-xs font-mono outline-none focus:border-blue-500 text-center"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest block">Exp Year</label>
                      <input
                        type="text"
                        required
                        maxLength={4}
                        placeholder="2028"
                        value={cardExpiryYear}
                        onChange={(e) => setCardExpiryYear(e.target.value)}
                        className="w-full px-4 py-3 bg-[var(--bg-card)] border border-[var(--border-dim)] rounded-xl text-xs font-mono outline-none focus:border-blue-500 text-center"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest block">CVV</label>
                      <input
                        type="password"
                        required
                        maxLength={4}
                        placeholder="•••"
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value)}
                        className="w-full px-4 py-3 bg-[var(--bg-card)] border border-[var(--border-dim)] rounded-xl text-xs font-mono outline-none focus:border-blue-500 text-center"
                      />
                    </div>
                  </div>

                  <div className="bg-[var(--bg-card)] border border-[var(--border-dim)] rounded-2xl p-4 space-y-2">
                    <span className="text-[10px] text-[var(--text-secondary)] font-extrabold uppercase tracking-wider block">Purchase Amount (USD)</span>
                    <input
                      type="number"
                      placeholder="0.00"
                      step="any"
                      required
                      value={purchaseAmount}
                      onChange={(e) => setPurchaseAmount(e.target.value)}
                      className="w-full bg-transparent text-2xl font-black font-mono text-[var(--text-primary)] outline-none placeholder:text-slate-350"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isProcessingPayment}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-sm tracking-wide uppercase transition-all shadow-md shadow-blue-500/10 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isProcessingPayment ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Authorizing payment gateway...
                      </>
                    ) : (
                      <>
                        <CreditCard size={15} />
                        Confirm Card Checkout
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>

            <div className="lg:col-span-5">
              <AnimatePresence mode="wait">
                {paymentReceipt ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-emerald-50/50 border border-emerald-100 rounded-[32px] p-6 text-center space-y-5"
                  >
                    <div className="w-12 h-12 rounded-full bg-[var(--bg-card)] border border-emerald-250 text-emerald-600 flex items-center justify-center mx-auto shadow-sm shadow-emerald-500/5">
                      <CheckCircle size={22} className="animate-bounce" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-emerald-800 text-sm">Payment Approved</h4>
                      <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">{paymentReceipt.message}</p>
                    </div>

                    <div className="bg-[var(--bg-card)] border border-emerald-200/50 rounded-2xl p-4 space-y-3.5 text-left text-[10px] font-bold text-slate-650">
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--text-secondary)]">Payment ID:</span>
                        <span className="font-mono text-[var(--text-primary)]">{paymentReceipt.paymentId.slice(0, 14)}...</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--text-secondary)]">Amount Purchased:</span>
                        <span className="text-[var(--text-primary)]">${paymentReceipt.amount} USDC</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--text-secondary)]">Auth Status:</span>
                        <span className="text-emerald-600 uppercase font-black">{paymentReceipt.status}</span>
                      </div>
                      <div className="flex justify-between items-center border-t border-[var(--border-dim)] pt-3">
                        <span className="text-[var(--text-secondary)]">Gateway Provider:</span>
                        <span className="text-[var(--text-primary)] font-extrabold">{paymentReceipt.provider}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setPaymentReceipt(null);
                        setPurchaseAmount('');
                        setCardHolder('');
                        setCardNumber('');
                        setCardExpiryMonth('');
                        setCardExpiryYear('');
                        setCardCvv('');
                      }}
                      className="bg-[var(--bg-card)] border border-emerald-250 hover:bg-emerald-100 text-emerald-700 font-extrabold text-[10px] uppercase tracking-wide px-5 py-2.5 rounded-xl transition-all cursor-pointer shadow-sm w-full"
                    >
                      New Purchase
                    </button>
                  </motion.div>
                ) : (
                  <div className="border border-dashed border-[var(--border-dim)] rounded-[32px] p-12 text-center text-[var(--text-secondary)] space-y-3">
                    <CreditCard size={36} className="mx-auto text-slate-300 animate-pulse" />
                    <div>
                      <h4 className="font-extrabold text-slate-650 text-xs">Awaiting Card Checkout</h4>
                      <p className="text-[10px] text-[var(--text-secondary)] font-semibold mt-1">Submit the Visa/Mastercard form to process dynamic USDC stablecoin routing.</p>
                    </div>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </>
        )}

      </div>

    </div>
  );
}
