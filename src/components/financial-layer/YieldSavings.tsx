'use client';

import { useState, useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, ArrowDown, ArrowUp, ShieldCheck, DollarSign, Coins, Clock, ArrowLeftRight, Percent } from 'lucide-react';

const APY_USDC = 0.085; // 8.5% APY
const APY_EURC = 0.062; // 6.2% APY
const SECONDS_IN_YEAR = 365 * 24 * 60 * 60;

export default function YieldSavings() {
  const { isConnected, address: userAddress } = useAccount();

  // Active vault states
  const [activeTab, setActiveTab] = useState<'USDC' | 'EURC'>('USDC');

  // Wallet balances
  const [walletUsdc, setWalletUsdc] = useState<number>(0);
  const [walletEurc, setWalletEurc] = useState<number>(0);

  // Vault balances
  const [vaultUsdc, setVaultUsdc] = useState<number>(0);
  const [vaultEurc, setVaultEurc] = useState<number>(0);

  // Interest earned
  const [interestUsdc, setInterestUsdc] = useState<number>(0);
  const [interestEurc, setInterestEurc] = useState<number>(0);

  // Transaction form states
  const [txType, setTxType] = useState<'deposit' | 'withdraw'>('deposit');
  const [amountInput, setAmountInput] = useState<string>('');

  // Refs for tracking values in the tick interval
  const vaultUsdcRef = useRef<number>(0);
  const vaultEurcRef = useRef<number>(0);
  const interestUsdcRef = useRef<number>(0);
  const interestEurcRef = useRef<number>(0);

  // Initialize and load states from localStorage
  const loadVaultData = () => {
    if (!userAddress) return;
    const wallet = userAddress.toLowerCase();

    // 1. Wallet balances
    const wUsdc = localStorage.getItem(`sim_usdc_${wallet}`);
    const wEurc = localStorage.getItem(`sim_eurc_${wallet}`);
    const walletUsdcVal = wUsdc ? Number(wUsdc) : 1000.00;
    const walletEurcVal = wEurc ? Number(wEurc) : 500.00;
    setWalletUsdc(walletUsdcVal);
    setWalletEurc(walletEurcVal);

    // If these keys are not set, initialize them
    if (!wUsdc) localStorage.setItem(`sim_usdc_${wallet}`, '1000.00');
    if (!wEurc) localStorage.setItem(`sim_eurc_${wallet}`, '500.00');

    // 2. Vault balances
    const vUsdc = localStorage.getItem(`vault_usdc_${wallet}`);
    const vEurc = localStorage.getItem(`vault_eurc_${wallet}`);
    const vaultUsdcVal = vUsdc ? Number(vUsdc) : 0;
    const vaultEurcVal = vEurc ? Number(vEurc) : 0;
    setVaultUsdc(vaultUsdcVal);
    setVaultEurc(vaultEurcVal);
    vaultUsdcRef.current = vaultUsdcVal;
    vaultEurcRef.current = vaultEurcVal;

    // 3. Saved Interest Earned
    const iUsdc = localStorage.getItem(`vault_interest_usdc_${wallet}`);
    const iEurc = localStorage.getItem(`vault_interest_eurc_${wallet}`);
    let interestUsdcVal = iUsdc ? Number(iUsdc) : 0;
    let interestEurcVal = iEurc ? Number(iEurc) : 0;

    // 4. Time offset calculation
    const lastUpdate = localStorage.getItem(`vault_last_update_${wallet}`);
    const now = Date.now();

    if (lastUpdate && now > Number(lastUpdate)) {
      const elapsedSeconds = (now - Number(lastUpdate)) / 1000;
      
      // Calculate accrued interest during elapsed time
      if (vaultUsdcVal > 0) {
        const accruedUsdc = vaultUsdcVal * APY_USDC * (elapsedSeconds / SECONDS_IN_YEAR);
        interestUsdcVal += accruedUsdc;
      }
      if (vaultEurcVal > 0) {
        const accruedEurc = vaultEurcVal * APY_EURC * (elapsedSeconds / SECONDS_IN_YEAR);
        interestEurcVal += accruedEurc;
      }
    }

    setInterestUsdc(interestUsdcVal);
    setInterestEurc(interestEurcVal);
    interestUsdcRef.current = interestUsdcVal;
    interestEurcRef.current = interestEurcVal;

    // Update last update timestamp
    localStorage.setItem(`vault_last_update_${wallet}`, now.toString());
    localStorage.setItem(`vault_interest_usdc_${wallet}`, interestUsdcVal.toFixed(10));
    localStorage.setItem(`vault_interest_eurc_${wallet}`, interestEurcVal.toFixed(10));
  };

  useEffect(() => {
    if (isConnected && userAddress) {
      loadVaultData();
    }
  }, [isConnected, userAddress]);

  // Sync balance changes from other modules
  useEffect(() => {
    const handleStorageChange = () => {
      if (!userAddress) return;
      const wallet = userAddress.toLowerCase();
      const wUsdc = localStorage.getItem(`sim_usdc_${wallet}`);
      const wEurc = localStorage.getItem(`sim_eurc_${wallet}`);
      if (wUsdc) setWalletUsdc(Number(wUsdc));
      if (wEurc) setWalletEurc(Number(wEurc));
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [userAddress]);

  // Real-time ticking interval (every 100ms for hyper-smooth interest buildup)
  useEffect(() => {
    if (!isConnected || !userAddress) return;
    const wallet = userAddress.toLowerCase();
    const tickIntervalMs = 100;
    const tickSeconds = tickIntervalMs / 1000;

    const timer = setInterval(() => {
      const currentNow = Date.now();
      let updated = false;

      if (vaultUsdcRef.current > 0) {
        const increment = vaultUsdcRef.current * APY_USDC * (tickSeconds / SECONDS_IN_YEAR);
        interestUsdcRef.current += increment;
        setInterestUsdc(interestUsdcRef.current);
        updated = true;
      }

      if (vaultEurcRef.current > 0) {
        const increment = vaultEurcRef.current * APY_EURC * (tickSeconds / SECONDS_IN_YEAR);
        interestEurcRef.current += increment;
        setInterestEurc(interestEurcRef.current);
        updated = true;
      }

      if (updated) {
        // Save current progress every tick or throttled. We save to keep persistent states.
        localStorage.setItem(`vault_interest_usdc_${wallet}`, interestUsdcRef.current.toFixed(10));
        localStorage.setItem(`vault_interest_eurc_${wallet}`, interestEurcRef.current.toFixed(10));
        localStorage.setItem(`vault_last_update_${wallet}`, currentNow.toString());
      } else {
        // Just update timestamp even if idle
        localStorage.setItem(`vault_last_update_${wallet}`, currentNow.toString());
      }
    }, tickIntervalMs);

    return () => clearInterval(timer);
  }, [isConnected, userAddress]);

  // Handle deposit or withdrawal
  const handleVaultAction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !userAddress) {
      alert('Connect your wallet first.');
      return;
    }

    const amt = Number(amountInput);
    if (!amountInput || amt <= 0 || isNaN(amt)) {
      alert('Please enter a valid positive amount.');
      return;
    }

    const wallet = userAddress.toLowerCase();
    const activeBalance = activeTab === 'USDC' ? walletUsdc : walletEurc;
    const activeVault = activeTab === 'USDC' ? vaultUsdc : vaultEurc;

    if (txType === 'deposit') {
      if (amt > activeBalance) {
        alert(`Insufficient balance. Available: ${activeBalance} ${activeTab}`);
        return;
      }

      const newWalletBal = Number((activeBalance - amt).toFixed(2));
      const newVaultBal = Number((activeVault + amt).toFixed(2));

      // Update state & refs
      if (activeTab === 'USDC') {
        setWalletUsdc(newWalletBal);
        setVaultUsdc(newVaultBal);
        vaultUsdcRef.current = newVaultBal;
        localStorage.setItem(`sim_usdc_${wallet}`, newWalletBal.toString());
        localStorage.setItem(`vault_usdc_${wallet}`, newVaultBal.toString());
      } else {
        setWalletEurc(newWalletBal);
        setVaultEurc(newVaultBal);
        vaultEurcRef.current = newVaultBal;
        localStorage.setItem(`sim_eurc_${wallet}`, newWalletBal.toString());
        localStorage.setItem(`vault_eurc_${wallet}`, newVaultBal.toString());
      }

      alert(`Successfully deposited ${amt} ${activeTab} into your high-yield yield vault!`);
    } else {
      // Withdrawal
      if (amt > activeVault) {
        alert(`Insufficient vault balance. Available: ${activeVault} ${activeTab}`);
        return;
      }

      const newWalletBal = Number((activeBalance + amt).toFixed(2));
      const newVaultBal = Number((activeVault - amt).toFixed(2));

      // Update state & refs
      if (activeTab === 'USDC') {
        setWalletUsdc(newWalletBal);
        setVaultUsdc(newVaultBal);
        vaultUsdcRef.current = newVaultBal;
        localStorage.setItem(`sim_usdc_${wallet}`, newWalletBal.toString());
        localStorage.setItem(`vault_usdc_${wallet}`, newVaultBal.toString());
      } else {
        setWalletEurc(newWalletBal);
        setVaultEurc(newVaultBal);
        vaultEurcRef.current = newVaultBal;
        localStorage.setItem(`sim_eurc_${wallet}`, newWalletBal.toString());
        localStorage.setItem(`vault_eurc_${wallet}`, newVaultBal.toString());
      }

      alert(`Successfully withdrew ${amt} ${activeTab} from your yield vault to your active wallet balance!`);
    }

    // Set last update and trigger global storage event
    localStorage.setItem(`vault_last_update_${wallet}`, Date.now().toString());
    window.dispatchEvent(new Event('storage'));
    setAmountInput('');
  };

  const handleMaxAmount = () => {
    const activeBalance = activeTab === 'USDC' ? walletUsdc : walletEurc;
    const activeVault = activeTab === 'USDC' ? vaultUsdc : vaultEurc;
    if (txType === 'deposit') {
      setAmountInput(activeBalance.toString());
    } else {
      setAmountInput(activeVault.toString());
    }
  };

  // Yield calculations for projections
  const currentVaultBalance = activeTab === 'USDC' ? vaultUsdc : vaultEurc;
  const currentInterestEarned = activeTab === 'USDC' ? interestUsdc : interestEurc;
  const activeApy = activeTab === 'USDC' ? APY_USDC : APY_EURC;

  const dailyEarnings = currentVaultBalance * activeApy / 365;
  const monthlyEarnings = currentVaultBalance * activeApy / 12;
  const yearlyEarnings = currentVaultBalance * activeApy;

  return (
    <div className="space-y-6">
      
      {/* Tab Selectors */}
      <div className="flex gap-2 p-1 bg-slate-100 border border-slate-200/50 rounded-2xl">
        <button
          type="button"
          onClick={() => {
            setActiveTab('USDC');
            setAmountInput('');
          }}
          className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer ${
            activeTab === 'USDC' ? 'bg-white text-blue-600 shadow-sm border border-slate-200/40' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          💵 USDC Staking Vault (8.5% APY)
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('EURC');
            setAmountInput('');
          }}
          className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer ${
            activeTab === 'EURC' ? 'bg-white text-blue-600 shadow-sm border border-slate-200/40' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          🇪🇺 EURC Staking Vault (6.2% APY)
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Real-time Ticker Card */}
        <div className="md:col-span-7 bg-slate-900 border border-slate-850 rounded-[32px] p-6 sm:p-8 text-white relative overflow-hidden shadow-xl flex flex-col justify-between min-h-[300px]">
          {/* Subtle neon glowing backdrops */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/10 rounded-full blur-[80px] pointer-events-none -z-10" />
          <div className="absolute bottom-0 left-0 w-36 h-36 bg-indigo-500/10 rounded-full blur-[60px] pointer-events-none -z-10" />

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="bg-blue-500/20 text-blue-300 border border-blue-500/20 text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                <ShieldCheck size={11} /> Secured Smart Yield
              </span>
              <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1"><Clock size={12} /> Compounding Live</span>
            </div>

            <div className="space-y-1.5 pt-4">
              <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest block">Total Yield Earned</span>
              
              {/* Giant Digital Counter */}
              <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-blue-400 flex items-baseline gap-1">
                <span>{currentInterestEarned.toFixed(8)}</span>
                <span className="text-sm text-slate-400 font-extrabold">{activeTab}</span>
              </div>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 gap-4 border-t border-slate-800 pt-6 mt-6">
            <div className="space-y-1">
              <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider block">My Staked Balance</span>
              <span className="text-lg font-black text-slate-100 font-mono">
                {currentVaultBalance.toFixed(2)} {activeTab}
              </span>
            </div>
            <div className="space-y-1 text-right">
              <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider block">Estimated Annual APY</span>
              <span className="text-lg font-black text-emerald-400 flex items-center justify-end gap-0.5">
                <Percent size={14} className="mt-0.5" /> {(activeApy * 100).toFixed(1)}%
              </span>
            </div>
          </div>

        </div>

        {/* Action Panel */}
        <div className="md:col-span-5 bg-white border border-slate-200/80 rounded-[32px] p-6 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex gap-2 p-1 bg-slate-50 border border-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setTxType('deposit');
                  setAmountInput('');
                }}
                className={`flex-1 py-2 rounded-lg font-extrabold text-[10px] uppercase tracking-wider transition-all cursor-pointer ${
                  txType === 'deposit' ? 'bg-white text-blue-600 shadow-sm border border-slate-200/20' : 'text-slate-400'
                }`}
              >
                <ArrowDown size={11} className="inline mr-1" /> Deposit
              </button>
              <button
                type="button"
                onClick={() => {
                  setTxType('withdraw');
                  setAmountInput('');
                }}
                className={`flex-1 py-2 rounded-lg font-extrabold text-[10px] uppercase tracking-wider transition-all cursor-pointer ${
                  txType === 'withdraw' ? 'bg-white text-blue-600 shadow-sm border border-slate-200/20' : 'text-slate-400'
                }`}
              >
                <ArrowUp size={11} className="inline mr-1" /> Withdraw
              </button>
            </div>

            <form onSubmit={handleVaultAction} className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[9px] font-black text-slate-450 uppercase tracking-widest block">
                    {txType === 'deposit' ? 'Stake Amount' : 'Withdraw Amount'}
                  </label>
                  <span className="text-[9px] text-slate-400 font-bold">
                    Available: {txType === 'deposit' ? (activeTab === 'USDC' ? walletUsdc : walletEurc) : (activeTab === 'USDC' ? vaultUsdc : vaultEurc)} {activeTab}
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="0.00"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    className="w-full pl-4 pr-16 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold outline-none focus:border-blue-500 focus:bg-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={handleMaxAmount}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-black text-blue-600 hover:bg-blue-50 border border-blue-200/30 px-2 py-1.5 rounded-lg transition-all cursor-pointer"
                  >
                    MAX
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-4.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs tracking-wide uppercase transition-all shadow-md shadow-blue-500/10 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {txType === 'deposit' ? <ArrowDown size={13} /> : <ArrowUp size={13} />}
                {txType === 'deposit' ? 'Confirm Deposit' : 'Confirm Withdrawal'}
              </button>
            </form>
          </div>

          <div className="border-t border-slate-100 pt-4 mt-4 text-[9.5px] font-bold text-slate-400 leading-normal flex items-start gap-2">
            <TrendingUp className="text-emerald-500 shrink-0 mt-0.5" size={13} />
            <span>
              Yield compounds continuously in real-time. Depositing stablecoins removes them from your active wallet, securing them inside the smart sandbox vault.
            </span>
          </div>
        </div>

      </div>

      {/* Projections Section */}
      <div className="bg-white border border-slate-200/80 rounded-[32px] p-6 sm:p-8 shadow-sm space-y-4">
        <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1"><TrendingUp size={15} className="text-blue-550" /> Wealth Generation Forecast</h3>
        <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Estimated earnings projected based on your current vault balance. Actual gains accumulate dynamically every second.</p>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="bg-slate-50 border border-slate-200/50 p-4.5 rounded-2xl flex flex-col justify-between">
            <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider block">Daily Est. Reward</span>
            <span className="text-base font-black text-slate-800 font-mono mt-1.5">
              +{dailyEarnings.toFixed(4)} {activeTab}
            </span>
          </div>
          <div className="bg-slate-50 border border-slate-200/50 p-4.5 rounded-2xl flex flex-col justify-between">
            <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider block">Monthly Est. Reward</span>
            <span className="text-base font-black text-slate-800 font-mono mt-1.5">
              +{monthlyEarnings.toFixed(2)} {activeTab}
            </span>
          </div>
          <div className="bg-slate-50 border border-slate-200/50 p-4.5 rounded-2xl flex flex-col justify-between">
            <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider block">Yearly Est. Reward</span>
            <span className="text-base font-black text-emerald-600 font-mono mt-1.5">
              +{yearlyEarnings.toFixed(2)} {activeTab}
            </span>
          </div>
        </div>
      </div>

    </div>
  );
}
