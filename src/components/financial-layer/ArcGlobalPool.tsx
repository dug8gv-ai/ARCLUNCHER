'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, usePublicClient, useWriteContract } from 'wagmi';
import { motion } from 'framer-motion';
import { Layers, ShieldCheck, RefreshCw, Info, Lock, Coins } from 'lucide-react';
import { erc20Abi, parseUnits, formatUnits } from 'viem';
import { USDC_ADDRESS, EURC_ADDRESS, ARC_GLOBAL_POOL_ADDRESS, arcPoolAbi } from '@/lib/arcDefiAbi';

export function ArcGlobalPool() {
  const { isConnected, address: userAddress } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [activeTab, setActiveTab] = useState<'provide' | 'withdraw'>('provide');

  // Real on-chain pool reserves
  const [poolReserves, setPoolReserves] = useState({ usdc: 0, eurc: 0 });
  const [userStaked, setUserStaked] = useState({ usdc: 0, eurc: 0, withdrawnUsdc: 0, withdrawnEurc: 0, withdrawalStartTime: 0 });
  const [claimable, setClaimable] = useState({ usdc: 0, eurc: 0 });
  const [collectedFees, setCollectedFees] = useState({ usdc: 0, eurc: 0 });

  const [liquidityAmount, setLiquidityAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const poolAddr = ARC_GLOBAL_POOL_ADDRESS as `0x${string}`;

  // Fetch real on-chain data
  const fetchPoolData = useCallback(async () => {
    if (!publicClient) return;
    try {
      // Get reserves
      const reserveUsdc = await publicClient.readContract({
        address: poolAddr, abi: arcPoolAbi, functionName: 'reserveUSDC',
      });
      const reserveEurc = await publicClient.readContract({
        address: poolAddr, abi: arcPoolAbi, functionName: 'reserveEURC',
      });
      setPoolReserves({
        usdc: Number(formatUnits(reserveUsdc as bigint, 6)),
        eurc: Number(formatUnits(reserveEurc as bigint, 6)),
      });

      // Get collected fees
      const feesUsdc = await publicClient.readContract({
        address: poolAddr, abi: arcPoolAbi, functionName: 'collectedFeesUSDC',
      });
      const feesEurc = await publicClient.readContract({
        address: poolAddr, abi: arcPoolAbi, functionName: 'collectedFeesEURC',
      });
      setCollectedFees({
        usdc: Number(formatUnits(feesUsdc as bigint, 6)),
        eurc: Number(formatUnits(feesEurc as bigint, 6)),
      });

      // Get user stake
      if (userAddress) {
        const stake = await publicClient.readContract({
          address: poolAddr, abi: arcPoolAbi, functionName: 'userStakes', args: [userAddress],
        }) as [bigint, bigint, bigint, bigint, bigint];
        setUserStaked({
          usdc: Number(formatUnits(stake[0], 6)),
          eurc: Number(formatUnits(stake[1], 6)),
          withdrawnUsdc: Number(formatUnits(stake[2], 6)),
          withdrawnEurc: Number(formatUnits(stake[3], 6)),
          withdrawalStartTime: Number(stake[4]),
        });

        // Get claimable
        const withdrawable = await publicClient.readContract({
          address: poolAddr, abi: arcPoolAbi, functionName: 'getWithdrawable', args: [userAddress],
        }) as [bigint, bigint];
        setClaimable({
          usdc: Number(formatUnits(withdrawable[0], 6)),
          eurc: Number(formatUnits(withdrawable[1], 6)),
        });
      }
    } catch (err) {
      console.error('Error fetching pool data:', err);
    }
  }, [publicClient, userAddress, poolAddr]);

  useEffect(() => {
    fetchPoolData();
    const handler = () => fetchPoolData();
    window.addEventListener('arc-balance-update', handler);
    return () => window.removeEventListener('arc-balance-update', handler);
  }, [fetchPoolData]);

  // ========== ADD LIQUIDITY (REAL ON-CHAIN) ==========
  const handleProvide = async () => {
    if (!isConnected || !userAddress) {
      setErrorMessage('Please connect your wallet first!');
      return;
    }
    const amt = Number(liquidityAmount);
    if (!liquidityAmount || amt <= 0) {
      setErrorMessage('Enter a valid amount');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const amtWei = parseUnits(liquidityAmount, 6);

      // Approve USDC
      const approveUsdc = await writeContractAsync({
        address: USDC_ADDRESS as `0x${string}`,
        abi: erc20Abi,
        functionName: 'approve',
        args: [poolAddr, amtWei],
      });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash: approveUsdc });

      // Approve EURC
      const approveEurc = await writeContractAsync({
        address: EURC_ADDRESS as `0x${string}`,
        abi: erc20Abi,
        functionName: 'approve',
        args: [poolAddr, amtWei],
      });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash: approveEurc });

      // Add Liquidity
      const addTx = await writeContractAsync({
        address: poolAddr,
        abi: arcPoolAbi,
        functionName: 'addLiquidity',
        args: [amtWei],
      });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash: addTx });

      setLiquidityAmount('');
      setSuccessMessage(`Successfully added ${amt} USDC + ${amt} EURC to the pool!`);
      await fetchPoolData();
      window.dispatchEvent(new Event('arc-balance-update'));
    } catch (err: any) {
      setErrorMessage(err.shortMessage || err.message || 'Transaction failed');
    }
    setIsProcessing(false);
  };

  // ========== INITIATE WITHDRAWAL (25% instant) ==========
  const handleInitiateWithdrawal = async () => {
    if (!isConnected || !userAddress) {
      setErrorMessage('Please connect your wallet first!');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const tx = await writeContractAsync({
        address: poolAddr,
        abi: arcPoolAbi,
        functionName: 'initiateWithdrawal',
      });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash: tx });

      setSuccessMessage('25% Instant Release successful! The remaining 75% is now vesting at 10% per week.');
      await fetchPoolData();
      window.dispatchEvent(new Event('arc-balance-update'));
    } catch (err: any) {
      setErrorMessage(err.shortMessage || err.message || 'Withdrawal failed');
    }
    setIsProcessing(false);
  };

  // ========== CLAIM VESTED ==========
  const handleClaimVested = async () => {
    if (!isConnected || !userAddress) {
      setErrorMessage('Please connect your wallet first!');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const tx = await writeContractAsync({
        address: poolAddr,
        abi: arcPoolAbi,
        functionName: 'claimVested',
      });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash: tx });

      setSuccessMessage('Vested tokens claimed successfully!');
      await fetchPoolData();
      window.dispatchEvent(new Event('arc-balance-update'));
    } catch (err: any) {
      setErrorMessage(err.shortMessage || err.message || 'Claim failed');
    }
    setIsProcessing(false);
  };

  const hasWithdrawalStarted = userStaked.withdrawalStartTime > 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">ARC GLOBAL LP</h2>
        <p className="text-slate-500 mt-2">The Ultimate Public Liquidity Pool & Swap Protocol</p>
        <p className="text-xs text-slate-400 mt-1 font-mono">{ARC_GLOBAL_POOL_ADDRESS}</p>
      </div>

      {/* Dashboard: Live Pool Reserves */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm text-center">
          <p className="text-xs font-semibold text-slate-500 uppercase">Pool USDC</p>
          <p className="text-xl font-bold text-blue-600 mt-1">{poolReserves.usdc.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm text-center">
          <p className="text-xs font-semibold text-slate-500 uppercase">Pool EURC</p>
          <p className="text-xl font-bold text-indigo-600 mt-1">{poolReserves.eurc.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm text-center">
          <p className="text-xs font-semibold text-slate-500 uppercase">Fees USDC</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">{collectedFees.usdc.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm text-center">
          <p className="text-xs font-semibold text-slate-500 uppercase">Fees EURC</p>
          <p className="text-xl font-bold text-emerald-600 mt-1">{collectedFees.eurc.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
        </div>
      </div>

      {/* Refresh Button */}
      <div className="flex justify-end">
        <button onClick={() => fetchPoolData()} className="flex items-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-xl transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Pool Data
        </button>
      </div>

      <div className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-200/80">
        <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-6 relative">
          <motion.div
            className="absolute inset-y-1.5 w-[calc(50%-6px)] bg-white rounded-xl shadow-sm border border-slate-200"
            animate={{ left: activeTab === 'provide' ? '6px' : 'calc(50%)' }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
          <button
            onClick={() => { setActiveTab('provide'); setErrorMessage(null); setSuccessMessage(null); }}
            className={`flex-1 py-3 text-sm font-bold z-10 transition-colors ${activeTab === 'provide' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Add Liquidity
          </button>
          <button
            onClick={() => { setActiveTab('withdraw'); setErrorMessage(null); setSuccessMessage(null); }}
            className={`flex-1 py-3 text-sm font-bold z-10 transition-colors ${activeTab === 'withdraw' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Withdraw (25/10 Rule)
          </button>
        </div>

        {activeTab === 'provide' && (
          <div className="space-y-4">
            <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 mb-6">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-blue-800">
                  <strong>1:1 Provision:</strong> You must add equal amounts of USDC and EURC. Enter the amount below — both tokens will be deposited in equal ratio on-chain.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">USDC Amount</p>
                <div className="flex items-center">
                  <input
                    type="number"
                    value={liquidityAmount}
                    onChange={(e) => setLiquidityAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-transparent text-3xl font-black text-slate-900 focus:outline-none"
                  />
                  <span className="font-bold text-slate-500">USDC</span>
                </div>
              </div>

              <div className="flex justify-center -my-3 relative z-10">
                <div className="w-8 h-8 bg-white border border-slate-200 rounded-full flex items-center justify-center shadow-sm">
                  <span className="font-bold text-slate-400">+</span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 opacity-75 pointer-events-none">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">EURC Required (1:1)</p>
                <div className="flex items-center">
                  <input
                    type="text"
                    value={liquidityAmount || '0.00'}
                    readOnly
                    className="w-full bg-transparent text-3xl font-black text-slate-900 focus:outline-none"
                  />
                  <span className="font-bold text-slate-500">EURC</span>
                </div>
              </div>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
                {errorMessage}
              </div>
            )}
            {successMessage && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
                {successMessage}
              </div>
            )}

            <button
              onClick={handleProvide}
              disabled={isProcessing}
              className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isProcessing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Layers className="w-5 h-5" />}
              {isProcessing ? 'Processing On-Chain...' : 'Supply Liquidity'}
            </button>
          </div>
        )}

        {activeTab === 'withdraw' && (
          <div className="space-y-6">
            <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-indigo-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-indigo-800">
                  <p className="font-bold mb-1">The 25/10 Stability Rule</p>
                  <ul className="list-disc pl-4 space-y-1">
                    <li><strong>Instant Release:</strong> 25% of your staked liquidity is returned immediately when you initiate withdrawal.</li>
                    <li><strong>Vesting:</strong> The remaining 75% is released at 10% per week. Claim vested tokens anytime.</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-center">
                <p className="text-xs font-semibold text-slate-500 uppercase">Your Staked USDC</p>
                <p className="text-xl font-bold text-slate-900 mt-1">{userStaked.usdc.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</p>
              </div>
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-center">
                <p className="text-xs font-semibold text-slate-500 uppercase">Your Staked EURC</p>
                <p className="text-xl font-bold text-slate-900 mt-1">{userStaked.eurc.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</p>
              </div>
            </div>

            {hasWithdrawalStarted && (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-200 text-center">
                  <p className="text-xs font-semibold text-emerald-600 uppercase">Claimable USDC</p>
                  <p className="text-xl font-bold text-emerald-700 mt-1">{claimable.usdc.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</p>
                </div>
                <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-200 text-center">
                  <p className="text-xs font-semibold text-emerald-600 uppercase">Claimable EURC</p>
                  <p className="text-xl font-bold text-emerald-700 mt-1">{claimable.eurc.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</p>
                </div>
              </div>
            )}

            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
                {errorMessage}
              </div>
            )}
            {successMessage && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm">
                {successMessage}
              </div>
            )}

            {/* Show appropriate button based on withdrawal state */}
            {!hasWithdrawalStarted ? (
              <button
                onClick={handleInitiateWithdrawal}
                disabled={isProcessing || userStaked.usdc <= 0}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isProcessing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Lock className="w-5 h-5" />}
                {isProcessing ? 'Processing...' : 'Initiate Withdrawal (25% Instant)'}
              </button>
            ) : (
              <button
                onClick={handleClaimVested}
                disabled={isProcessing || (claimable.usdc <= 0 && claimable.eurc <= 0)}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isProcessing ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Coins className="w-5 h-5" />}
                {isProcessing ? 'Claiming...' : 'Claim Vested Tokens'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
