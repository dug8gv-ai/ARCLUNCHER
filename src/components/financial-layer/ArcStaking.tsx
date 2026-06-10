'use client';

import { useState } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';
import { Pickaxe, TrendingUp, ShieldCheck, Lock, Unlock, Clock, Coins, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { USDC_ADDRESS, EURC_ADDRESS, CIRBTC_ADDRESS } from '@/lib/arcDefiAbi';
import { formatUnits, erc20Abi } from 'viem';

const STAKE_OPTIONS = [
  { id: 'flexible', name: 'Flexible', duration: 'Anytime', apy: 3.5, type: 'variable' },
  { id: 'fixed-30', name: 'Fixed 30 Days', duration: '30 Days', apy: 5.0, type: 'fixed' },
  { id: 'fixed-90', name: 'Fixed 90 Days', duration: '90 Days', apy: 8.5, type: 'fixed' },
  { id: 'fixed-365', name: 'Fixed 365 Days', duration: '365 Days', apy: 12.0, type: 'fixed' }
];

const ASSETS = [
  { id: 'USDC', address: USDC_ADDRESS, decimals: 6, symbol: 'USDC' },
  { id: 'EURC', address: EURC_ADDRESS, decimals: 6, symbol: 'EURC' },
  { id: 'cirBTC', address: CIRBTC_ADDRESS, decimals: 8, symbol: 'cirBTC' }
];

export default function ArcStaking() {
  const { isConnected, address: userAddress } = useAccount();
  const publicClient = usePublicClient();

  const [balances, setBalances] = useState({ USDC: 0, EURC: 0, cirBTC: 0 });
  const [selectedAsset, setSelectedAsset] = useState(ASSETS[0]);
  const [selectedOption, setSelectedOption] = useState(STAKE_OPTIONS[0]);
  const [amount, setAmount] = useState('');
  
  const [isStaking, setIsStaking] = useState(false);
  const [stakeResult, setStakeResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Mock Active Stakes
  const [activeStakes, setActiveStakes] = useState<any[]>([]);

  const fetchBalances = async () => {
    if (!publicClient || !isConnected || !userAddress) return;
    try {
      const [uUSDC, uEURC, uBTC] = await Promise.all([
        publicClient.readContract({ address: USDC_ADDRESS as `0x${string}`, abi: erc20Abi, functionName: 'balanceOf', args: [userAddress] }),
        publicClient.readContract({ address: EURC_ADDRESS as `0x${string}`, abi: erc20Abi, functionName: 'balanceOf', args: [userAddress] }),
        publicClient.readContract({ address: CIRBTC_ADDRESS as `0x${string}`, abi: erc20Abi, functionName: 'balanceOf', args: [userAddress] }),
      ]);
      setBalances({
        USDC: Number(formatUnits(uUSDC as bigint, 6)),
        EURC: Number(formatUnits(uEURC as bigint, 6)),
        cirBTC: Number(formatUnits(uBTC as bigint, 8)),
      });
    } catch (e) {
      console.error('Error fetching balances for staking:', e);
    }
  };

  useState(() => {
    fetchBalances();
  });

  const handleStake = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !userAddress) {
      setStakeResult({ type: 'error', message: 'Please connect your wallet first.' });
      return;
    }

    const amt = Number(amount);
    if (!amount || amt <= 0) {
      setStakeResult({ type: 'error', message: 'Enter a valid amount to stake.' });
      return;
    }

    const availableBal = balances[selectedAsset.id as keyof typeof balances];
    if (amt > availableBal) {
      setStakeResult({ type: 'error', message: `Insufficient ${selectedAsset.symbol} balance.` });
      return;
    }

    setIsStaking(true);
    setStakeResult(null);

    // Mock Staking Delay for Demo (In real implementation, this would be a contract call)
    setTimeout(() => {
      setActiveStakes(prev => [
        {
          id: Math.random().toString(36).substr(2, 9),
          asset: selectedAsset.symbol,
          amount: amt,
          option: selectedOption.name,
          apy: selectedOption.apy,
          startDate: new Date().toISOString(),
          status: 'Locked'
        },
        ...prev
      ]);
      
      setStakeResult({ type: 'success', message: `Successfully staked ${amt} ${selectedAsset.symbol} on ${selectedOption.name} plan!` });
      setAmount('');
      setIsStaking(false);
    }, 1500);
  };

  const handleUnstake = (id: string) => {
    setActiveStakes(prev => prev.filter(stake => stake.id !== id));
    alert('Stake unlocked and funds returned to balance (Simulation).');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      
      {/* Header */}
      <div className="flex items-center justify-between card rounded-3xl p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 flex items-center justify-center border border-teal-100 text-teal-600 shadow-sm">
            <Pickaxe size={22} />
          </div>
          <div>
            <span className="text-[10px] uppercase font-extrabold tracking-widest text-teal-600 block">Arc Network</span>
            <h2 className="text-xl font-black text-[var(--text-primary)] tracking-tight">Yield & Staking Dashboard</h2>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Staking Form */}
        <div className="lg:col-span-5 space-y-6">
          <div className="card rounded-[32px] p-6 shadow-sm space-y-6">
            <div className="flex items-center gap-2 mb-4">
              <Lock size={16} className="text-teal-600" />
              <h3 className="font-extrabold text-[var(--text-primary)]">Stake Assets</h3>
            </div>

            <form onSubmit={handleStake} className="space-y-5">
              
              {/* Asset Selection */}
              <div className="space-y-2">
                <label className="text-[10px] font-extrabold text-[var(--text-secondary)] uppercase tracking-widest block">Select Asset</label>
                <div className="grid grid-cols-3 gap-2">
                  {ASSETS.map(asset => (
                    <button
                      type="button"
                      key={asset.id}
                      onClick={() => setSelectedAsset(asset)}
                      className={`p-3 rounded-xl border text-xs font-black transition-all ${
                        selectedAsset.id === asset.id 
                          ? 'bg-teal-50 border-teal-200 text-teal-700 shadow-sm' 
                          : 'bg-[var(--bg-card)] border-[var(--border-dim)] text-[var(--text-secondary)] hover:bg-slate-50'
                      }`}
                    >
                      {asset.symbol}
                    </button>
                  ))}
                </div>
              </div>

              {/* Amount Input */}
              <div className="bg-[rgba(6,10,38,0.9)] border border-[var(--border-dim)] rounded-2xl p-4 space-y-2">
                <div className="flex justify-between items-center text-[10px] font-extrabold text-[var(--text-secondary)] uppercase tracking-wider">
                  <span>Amount to Stake</span>
                  <span className="cursor-pointer text-teal-600" onClick={() => setAmount(balances[selectedAsset.id as keyof typeof balances].toString())}>
                    Max: {balances[selectedAsset.id as keyof typeof balances].toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <input
                    type="number"
                    placeholder="0.00"
                    step="any"
                    min="0"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-transparent text-2xl font-black font-mono text-[var(--text-primary)] outline-none"
                  />
                  <span className="text-sm font-bold text-[var(--text-secondary)]">{selectedAsset.symbol}</span>
                </div>
              </div>

              {/* Duration Options */}
              <div className="space-y-2">
                <label className="text-[10px] font-extrabold text-[var(--text-secondary)] uppercase tracking-widest block">Staking Duration</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {STAKE_OPTIONS.map(opt => (
                    <div 
                      key={opt.id}
                      onClick={() => setSelectedOption(opt)}
                      className={`cursor-pointer p-4 rounded-2xl border transition-all ${
                        selectedOption.id === opt.id
                          ? 'bg-teal-600 border-teal-700 text-white shadow-md'
                          : 'bg-[var(--bg-card)] border-[var(--border-dim)] hover:border-teal-300'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className={`text-xs font-bold ${selectedOption.id === opt.id ? 'text-teal-100' : 'text-[var(--text-secondary)]'}`}>
                          {opt.name}
                        </span>
                        {opt.type === 'fixed' ? <Lock size={12} className={selectedOption.id === opt.id ? 'text-teal-200' : 'text-[var(--text-secondary)]'} /> : <Unlock size={12} className={selectedOption.id === opt.id ? 'text-teal-200' : 'text-[var(--text-secondary)]'} />}
                      </div>
                      <div className="flex items-end gap-1">
                        <span className={`text-xl font-black ${selectedOption.id === opt.id ? 'text-white' : 'text-[var(--text-primary)]'}`}>
                          {opt.apy}%
                        </span>
                        <span className={`text-[10px] font-bold mb-1 ${selectedOption.id === opt.id ? 'text-teal-200' : 'text-[var(--text-secondary)]'}`}>APY</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isStaking || !amount || Number(amount) <= 0}
                className="w-full py-4 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl font-black text-sm tracking-wide uppercase transition-all shadow-md shadow-teal-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isStaking ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Locking Assets...
                  </>
                ) : (
                  'Stake Now'
                )}
              </button>
            </form>

            <AnimatePresence>
              {stakeResult && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className={`p-4 rounded-xl border text-xs font-bold flex items-start gap-3 mt-4 ${
                    stakeResult.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'
                  }`}
                >
                  {stakeResult.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  <span>{stakeResult.message}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Active Stakes Dashboard */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-slate-900 border border-[var(--border-dim)] rounded-[32px] p-6 sm:p-8 shadow-sm space-y-6 min-h-[400px]">
            <div className="flex items-center justify-between border-b border-[var(--border-dim)] pb-4">
              <div className="flex items-center gap-2 text-white">
                <Coins size={18} className="text-teal-400" />
                <h3 className="font-extrabold text-lg">Active Positions</h3>
              </div>
              <span className="text-xs font-bold text-[var(--text-secondary)] bg-slate-800 px-3 py-1 rounded-full">
                {activeStakes.length} Active
              </span>
            </div>

            {activeStakes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[200px] text-[var(--text-secondary)] space-y-3">
                <ShieldCheck size={32} className="text-[var(--text-primary)]" />
                <p className="text-sm font-semibold">No active staking positions.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeStakes.map(stake => (
                  <div key={stake.id} className="bg-slate-800/60 border border-[var(--border-dim)] rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-white">{stake.amount} {stake.asset}</span>
                        <span className="text-[10px] bg-teal-500/20 text-teal-400 border border-teal-500/30 px-2 py-0.5 rounded-full font-bold">
                          {stake.apy}% APY
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] font-semibold text-[var(--text-secondary)]">
                        <span className="flex items-center gap-1"><Clock size={10} /> {stake.option}</span>
                        <span>Staked: {new Date(stake.startDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => handleUnstake(stake.id)}
                      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded-xl transition-colors w-full sm:w-auto"
                    >
                      Unstake
                    </button>
                  </div>
                ))}
              </div>
            )}
            
          </div>
        </div>

      </div>
    </div>
  );
}
