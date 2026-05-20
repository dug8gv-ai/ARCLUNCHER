'use client';

import { useState, useEffect } from 'react';
import { useAccount, usePublicClient, useWriteContract } from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Coins, Flame, Loader2, Zap, CheckCircle, RefreshCw, ArrowDownUp, Droplet } from 'lucide-react';
import { erc20Abi, parseUnits, formatUnits } from 'viem';
import { ARC_LIQUIDITY_POOL_ADDRESS, arcLiquidityPoolAbi, USDC_ADDRESS, EURC_ADDRESS } from '@/lib/arcDefiAbi';

interface SwapStep {
  title: string;
  desc: string;
  status: 'pending' | 'active' | 'success' | 'failed';
}

export default function CircleBridge() {
  const { isConnected, address: userAddress } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  // Tab: 'swap' or 'burn'
  const [activeTab, setActiveTab] = useState<'swap' | 'burn'>('swap');

  // Swap States
  const [swapDirection, setSwapDirection] = useState<'USDC_TO_EURC' | 'EURC_TO_USDC'>('USDC_TO_EURC');
  const [swapAmount, setSwapAmount] = useState('');
  const [outputAmount, setOutputAmount] = useState('');

  // Burn States
  const [burnTokenAddress, setBurnTokenAddress] = useState('');
  const [burnAmount, setBurnAmount] = useState('');

  // Wallet Balances
  const [realUsdcBalance, setRealUsdcBalance] = useState<number>(0);
  const [realEurcBalance, setRealEurcBalance] = useState<number>(0);
  const [isFetchingBalances, setIsFetchingBalances] = useState(false);

  // Pool Reserves
  const [poolUSDC, setPoolUSDC] = useState<number>(0);
  const [poolEURC, setPoolEURC] = useState<number>(0);

  // Collected Fees (Admin Only)
  const [collectedFeesUSDC, setCollectedFeesUSDC] = useState<number>(0);
  const [collectedFeesEURC, setCollectedFeesEURC] = useState<number>(0);
  const [isWithdrawingFees, setIsWithdrawingFees] = useState(false);

  // Admin Liquidity States
  const [adminUsdcAmount, setAdminUsdcAmount] = useState('');
  const [adminEurcAmount, setAdminEurcAmount] = useState('');
  const [isAdminAddingLiquidity, setIsAdminAddingLiquidity] = useState(false);
  const [isAdminRemovingLiquidity, setIsAdminRemovingLiquidity] = useState(false);

  // Transaction States
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [steps, setSteps] = useState<SwapStep[]>([]);
  const [currentStepIdx, setCurrentStepIdx] = useState<number>(-1);
  const [txSuccess, setTxSuccess] = useState(false);

  // FX Rate
  const fxRate = swapDirection === 'USDC_TO_EURC' ? 0.92 : 1.09;

  // Fetch real on-chain balances
  const fetchBalances = async () => {
    if (!userAddress || !publicClient) return;
    setIsFetchingBalances(true);
    try {
      const usdcRaw = await publicClient.readContract({
        address: USDC_ADDRESS as `0x${string}`,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [userAddress],
      });
      const eurcRaw = await publicClient.readContract({
        address: EURC_ADDRESS as `0x${string}`,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [userAddress],
      });
      setRealUsdcBalance(Number(formatUnits(usdcRaw as bigint, 6)));
      setRealEurcBalance(Number(formatUnits(eurcRaw as bigint, 6)));
    } catch (err) {
      console.error('Balance fetch error:', err);
    }
    setIsFetchingBalances(false);
  };

  // Fetch pool reserves and collected fees
  const fetchPoolReserves = async () => {
    if (!publicClient) return;
    try {
      const reserves = await publicClient.readContract({
        address: ARC_LIQUIDITY_POOL_ADDRESS as `0x${string}`,
        abi: arcLiquidityPoolAbi,
        functionName: 'getReserves',
      }) as [bigint, bigint];
      setPoolUSDC(Number(formatUnits(reserves[0], 6)));
      setPoolEURC(Number(formatUnits(reserves[1], 6)));

      const fees = await publicClient.readContract({
        address: ARC_LIQUIDITY_POOL_ADDRESS as `0x${string}`,
        abi: arcLiquidityPoolAbi,
        functionName: 'getCollectedFees',
      }) as [bigint, bigint];
      setCollectedFeesUSDC(Number(formatUnits(fees[0], 6)));
      setCollectedFeesEURC(Number(formatUnits(fees[1], 6)));
    } catch (err) {
      console.error('Pool reserves and fees error:', err);
    }
  };

  useEffect(() => {
    fetchBalances();
    fetchPoolReserves();
  }, [userAddress, publicClient]);

  // Auto-calculate output when swap amount changes
  useEffect(() => {
    if (!swapAmount || Number(swapAmount) <= 0) {
      setOutputAmount('');
      return;
    }
    const amt = Number(swapAmount);
    const estimated = amt * fxRate;
    setOutputAmount(estimated.toFixed(2));
  }, [swapAmount, swapDirection]);

  const fromToken = swapDirection === 'USDC_TO_EURC' ? 'USDC' : 'EURC';
  const toToken = swapDirection === 'USDC_TO_EURC' ? 'EURC' : 'USDC';
  const activeFromBalance = swapDirection === 'USDC_TO_EURC' ? realUsdcBalance : realEurcBalance;

  const updateStepStatus = (idx: number, status: SwapStep['status']) => {
    setSteps(prev => prev.map((s, i) => i === idx ? { ...s, status } : s));
  };

  // ========== HANDLE SWAP ==========
  const handleSwap = async () => {
    if (!isConnected || !userAddress) {
      setErrorMessage('Please connect your wallet first!');
      return;
    }
    const amt = Number(swapAmount);
    if (!swapAmount || amt <= 0) {
      setErrorMessage('Enter a valid amount');
      return;
    }
    if (amt > activeFromBalance) {
      setErrorMessage(`Insufficient ${fromToken} balance`);
      return;
    }

    setIsProcessing(true);
    setCurrentStepIdx(0);
    setErrorMessage(null);
    setTxSuccess(false);

    setSteps([
      { title: `1. Approve ${fromToken}`, desc: `Approve the Liquidity Pool to spend your ${fromToken}`, status: 'pending' },
      { title: `2. Execute Swap`, desc: `Swap ${fromToken} → ${toToken} via USDC/EURC Pool`, status: 'pending' },
      { title: `3. Confirm on Chain`, desc: `Waiting for block confirmation on Arc Chain Testnet`, status: 'pending' },
    ]);

    try {
      const tokenInAddress = swapDirection === 'USDC_TO_EURC' ? USDC_ADDRESS : EURC_ADDRESS;
      const amtWei = parseUnits(swapAmount, 6);

      // Step 1: Approve
      updateStepStatus(0, 'active');
      const approveTx = await writeContractAsync({
        address: tokenInAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: 'approve',
        args: [ARC_LIQUIDITY_POOL_ADDRESS as `0x${string}`, amtWei],
      });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: approveTx });
      }
      updateStepStatus(0, 'success');
      setCurrentStepIdx(1);

      // Step 2: Swap
      updateStepStatus(1, 'active');
      const swapFn = swapDirection === 'USDC_TO_EURC' ? 'swapUSDCtoEURC' : 'swapEURCtoUSDC';
      const swapTx = await writeContractAsync({
        address: ARC_LIQUIDITY_POOL_ADDRESS as `0x${string}`,
        abi: arcLiquidityPoolAbi,
        functionName: swapFn,
        args: [amtWei],
      });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: swapTx });
      }
      updateStepStatus(1, 'success');
      setCurrentStepIdx(2);

      // Step 3: Confirmation
      updateStepStatus(2, 'active');
      await new Promise(r => setTimeout(r, 1500));
      updateStepStatus(2, 'success');

      setTxSuccess(true);
      await fetchBalances();
      await fetchPoolReserves();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.shortMessage || err.message || 'Swap failed');
      if (currentStepIdx >= 0 && currentStepIdx < steps.length) {
        updateStepStatus(currentStepIdx, 'failed');
      }
    }
    setIsProcessing(false);
  };

  // ========== HANDLE BURN ==========
  const handleBurn = async () => {
    if (!isConnected || !userAddress) {
      setErrorMessage('Please connect your wallet first!');
      return;
    }
    if (!burnTokenAddress || !burnAmount || Number(burnAmount) <= 0) {
      setErrorMessage('Enter a valid token address and amount');
      return;
    }

    setIsProcessing(true);
    setCurrentStepIdx(0);
    setErrorMessage(null);
    setTxSuccess(false);

    setSteps([
      { title: `1. Approve Token`, desc: `Approve the burn contract to access your tokens`, status: 'pending' },
      { title: `2. Burn Tokens`, desc: `Send tokens to dead address (0xdead)`, status: 'pending' },
      { title: `3. Confirm Burn`, desc: `Waiting for block confirmation`, status: 'pending' },
    ]);

    try {
      // Determine decimals - USDC/EURC use 6, others use 18
      const isStablecoin = burnTokenAddress.toLowerCase() === USDC_ADDRESS.toLowerCase() || burnTokenAddress.toLowerCase() === EURC_ADDRESS.toLowerCase();
      const decimals = isStablecoin ? 6 : 18;
      const amtWei = parseUnits(burnAmount, decimals);

      // Step 1: Approve
      updateStepStatus(0, 'active');
      const approveTx = await writeContractAsync({
        address: burnTokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: 'approve',
        args: [ARC_LIQUIDITY_POOL_ADDRESS as `0x${string}`, amtWei],
      });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: approveTx });
      }
      updateStepStatus(0, 'success');
      setCurrentStepIdx(1);

      // Step 2: Burn
      updateStepStatus(1, 'active');
      const burnTx = await writeContractAsync({
        address: ARC_LIQUIDITY_POOL_ADDRESS as `0x${string}`,
        abi: arcLiquidityPoolAbi,
        functionName: 'burnToken',
        args: [burnTokenAddress as `0x${string}`, amtWei],
      });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: burnTx });
      }
      updateStepStatus(1, 'success');
      setCurrentStepIdx(2);

      // Step 3: Confirm
      updateStepStatus(2, 'active');
      await new Promise(r => setTimeout(r, 1500));
      updateStepStatus(2, 'success');

      setTxSuccess(true);
      await fetchBalances();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.shortMessage || err.message || 'Burn failed');
      if (currentStepIdx >= 0 && currentStepIdx < steps.length) {
        updateStepStatus(currentStepIdx, 'failed');
      }
    }
    setIsProcessing(false);
  };

  const handleWithdrawFees = async () => {
    if (!isConnected || !userAddress) return;
    setIsWithdrawingFees(true);
    setErrorMessage(null);
    try {
      const tx = await writeContractAsync({
        address: ARC_LIQUIDITY_POOL_ADDRESS as `0x${string}`,
        abi: arcLiquidityPoolAbi,
        functionName: 'withdrawFees',
      });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: tx });
      }
      setTxSuccess(true);
      await fetchPoolReserves();
      await fetchBalances();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.shortMessage || err.message || 'Fee withdrawal failed');
    }
    setIsWithdrawingFees(false);
  };

  const handleAddLiquidity = async () => {
    if (!isConnected || !userAddress) return;
    const usdcAmt = Number(adminUsdcAmount);
    const eurcAmt = Number(adminEurcAmount);
    if (usdcAmt <= 0 && eurcAmt <= 0) {
      setErrorMessage('Please enter a valid amount of USDC or EURC');
      return;
    }

    setIsProcessing(true);
    setIsAdminAddingLiquidity(true);
    setCurrentStepIdx(0);
    setErrorMessage(null);
    setTxSuccess(false);

    setSteps([
      { title: '1. Approve USDC', desc: 'Approve the pool to spend your USDC', status: 'pending' },
      { title: '2. Approve EURC', desc: 'Approve the pool to spend your EURC', status: 'pending' },
      { title: '3. Add Liquidity', desc: 'Add stablecoin reserves to the pool', status: 'pending' },
    ]);

    try {
      const usdcWei = parseUnits(adminUsdcAmount || '0', 6);
      const eurcWei = parseUnits(adminEurcAmount || '0', 6);

      // Step 1: Approve USDC (if > 0)
      updateStepStatus(0, 'active');
      if (usdcAmt > 0) {
        const approveTx = await writeContractAsync({
          address: USDC_ADDRESS as `0x${string}`,
          abi: erc20Abi,
          functionName: 'approve',
          args: [ARC_LIQUIDITY_POOL_ADDRESS as `0x${string}`, usdcWei],
        });
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash: approveTx });
        }
      }
      updateStepStatus(0, 'success');
      setCurrentStepIdx(1);

      // Step 2: Approve EURC (if > 0)
      updateStepStatus(1, 'active');
      if (eurcAmt > 0) {
        const approveTx = await writeContractAsync({
          address: EURC_ADDRESS as `0x${string}`,
          abi: erc20Abi,
          functionName: 'approve',
          args: [ARC_LIQUIDITY_POOL_ADDRESS as `0x${string}`, eurcWei],
        });
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash: approveTx });
        }
      }
      updateStepStatus(1, 'success');
      setCurrentStepIdx(2);

      // Step 3: Add Liquidity
      updateStepStatus(2, 'active');
      const addTx = await writeContractAsync({
        address: ARC_LIQUIDITY_POOL_ADDRESS as `0x${string}`,
        abi: arcLiquidityPoolAbi,
        functionName: 'addLiquidity',
        args: [usdcWei, eurcWei],
      });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: addTx });
      }
      updateStepStatus(2, 'success');

      setTxSuccess(true);
      setAdminUsdcAmount('');
      setAdminEurcAmount('');
      await fetchBalances();
      await fetchPoolReserves();
      window.dispatchEvent(new Event('storage'));
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.shortMessage || err.message || 'Add liquidity failed');
      if (currentStepIdx >= 0 && currentStepIdx < steps.length) {
        updateStepStatus(currentStepIdx, 'failed');
      }
    } finally {
      setIsProcessing(false);
      setIsAdminAddingLiquidity(false);
    }
  };

  const handleRemoveLiquidity = async () => {
    if (!isConnected || !userAddress) return;
    const usdcAmt = Number(adminUsdcAmount);
    const eurcAmt = Number(adminEurcAmount);
    if (usdcAmt <= 0 && eurcAmt <= 0) {
      setErrorMessage('Please enter a valid amount of USDC or EURC to remove');
      return;
    }

    setIsProcessing(true);
    setIsAdminRemovingLiquidity(true);
    setCurrentStepIdx(0);
    setErrorMessage(null);
    setTxSuccess(false);

    setSteps([
      { title: '1. Remove Liquidity', desc: 'Withdraw stablecoin reserves from the pool', status: 'pending' },
    ]);

    try {
      const usdcWei = parseUnits(adminUsdcAmount || '0', 6);
      const eurcWei = parseUnits(adminEurcAmount || '0', 6);

      updateStepStatus(0, 'active');
      const removeTx = await writeContractAsync({
        address: ARC_LIQUIDITY_POOL_ADDRESS as `0x${string}`,
        abi: arcLiquidityPoolAbi,
        functionName: 'removeLiquidity',
        args: [usdcWei, eurcWei],
      });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: removeTx });
      }
      updateStepStatus(0, 'success');

      setTxSuccess(true);
      setAdminUsdcAmount('');
      setAdminEurcAmount('');
      await fetchBalances();
      await fetchPoolReserves();
      window.dispatchEvent(new Event('storage'));
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.shortMessage || err.message || 'Remove liquidity failed');
      if (currentStepIdx >= 0 && currentStepIdx < steps.length) {
        updateStepStatus(currentStepIdx, 'failed');
      }
    } finally {
      setIsProcessing(false);
      setIsAdminRemovingLiquidity(false);
    }
  };

  const resetState = () => {
    setSteps([]);
    setCurrentStepIdx(-1);
    setErrorMessage(null);
    setTxSuccess(false);
    setSwapAmount('');
    setOutputAmount('');
    setBurnAmount('');
    setBurnTokenAddress('');
    setAdminUsdcAmount('');
    setAdminEurcAmount('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* LEFT: Main Panel */}
      <div className="bg-white border border-slate-200/80 rounded-[32px] p-6 shadow-sm space-y-5">

        {/* Network Badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/60 rounded-2xl px-4 py-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Arc Chain Testnet</span>
          </div>
          <button
            onClick={() => { fetchBalances(); fetchPoolReserves(); }}
            className="text-slate-400 hover:text-blue-600 transition-colors p-2 rounded-xl hover:bg-blue-50 cursor-pointer"
          >
            <RefreshCw size={14} className={isFetchingBalances ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Tab Selector: Swap / Burn */}
        <div className="flex gap-2 p-1.5 bg-slate-100 rounded-2xl">
          <button
            onClick={() => { setActiveTab('swap'); resetState(); }}
            className={`flex-1 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'swap'
                ? 'bg-white text-blue-600 shadow-sm border border-blue-200/50'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <ArrowDownUp size={12} /> Swap
          </button>
          <button
            onClick={() => { setActiveTab('burn'); resetState(); }}
            className={`flex-1 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'burn'
                ? 'bg-white text-orange-600 shadow-sm border border-orange-200/50'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Flame size={12} /> Burn Token
          </button>
        </div>

        {/* ========== SWAP TAB ========== */}
        {activeTab === 'swap' && (
          <div className="space-y-4">
            {/* Info Banner */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-3.5 flex items-start gap-2.5">
              <Zap size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
              <p className="text-[10px] text-blue-700 font-semibold leading-relaxed">
                Swap USDC ↔ EURC on Arc Chain Testnet via the on-chain liquidity pool. Flat 1 {fromToken} fee per swap applies.
              </p>
            </div>

            {/* Direction Selector */}
            <div className="space-y-1.5">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Swap Direction</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => { setSwapDirection('USDC_TO_EURC'); setSwapAmount(''); setOutputAmount(''); }}
                  className={`py-3 rounded-2xl font-black text-xs transition-all cursor-pointer border ${
                    swapDirection === 'USDC_TO_EURC'
                      ? 'bg-blue-50 text-blue-600 border-blue-200 shadow-sm'
                      : 'bg-white text-slate-400 border-slate-200 hover:border-blue-200'
                  }`}
                >
                  USDC → EURC
                </button>
                <button
                  onClick={() => { setSwapDirection('EURC_TO_USDC'); setSwapAmount(''); setOutputAmount(''); }}
                  className={`py-3 rounded-2xl font-black text-xs transition-all cursor-pointer border ${
                    swapDirection === 'EURC_TO_USDC'
                      ? 'bg-blue-50 text-blue-600 border-blue-200 shadow-sm'
                      : 'bg-white text-slate-400 border-slate-200 hover:border-blue-200'
                  }`}
                >
                  EURC → USDC
                </button>
              </div>
            </div>

            {/* Wallet Balance */}
            <div className="flex items-center justify-between bg-slate-50 border border-slate-200/60 rounded-2xl px-4 py-3">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Your {fromToken} Balance</span>
              <span className="text-sm font-black text-slate-800">
                {isFetchingBalances ? '...' : activeFromBalance.toFixed(2)} {fromToken}
              </span>
            </div>

            {/* Amount Input */}
            <div className="space-y-1.5">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Amount ({fromToken})</span>
              <div className="relative">
                <input
                  type="number"
                  value={swapAmount}
                  onChange={(e) => setSwapAmount(e.target.value)}
                  placeholder="0.00"
                  disabled={isProcessing}
                  className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-300 rounded-2xl p-4 pr-24 text-lg font-extrabold outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSwapAmount(activeFromBalance.toString())}
                    className="text-[8px] uppercase font-black px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200/50 cursor-pointer"
                  >
                    Max
                  </button>
                  <span className="text-[10px] font-black text-slate-400">{fromToken}</span>
                </div>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex justify-center">
              <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-200/50 flex items-center justify-center">
                <ArrowRight size={16} className="text-blue-500" />
              </div>
            </div>

            {/* Output */}
            <div className="space-y-1.5">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">You Receive ({toToken})</span>
              <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 text-lg font-extrabold text-slate-800">
                {outputAmount || '0.00'} <span className="text-sm text-slate-400 font-bold">{toToken}</span>
              </div>
            </div>

            {/* Rate Info */}
            <div className="bg-slate-50 border border-slate-200/60 rounded-2xl px-4 py-2.5 flex items-center justify-between text-[9px] font-bold text-slate-500">
              <span>Rate</span>
              <span>1 {fromToken} ≈ {fxRate} {toToken}</span>
            </div>

            {/* Pool Info */}
            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-2xl px-4 py-2.5 flex items-center justify-between text-[9px] font-bold">
              <div className="flex items-center gap-1.5 text-indigo-600">
                <Droplet size={10} />
                Pool Liquidity
              </div>
              <span className="text-indigo-700 font-black">{poolUSDC.toFixed(2)} USDC / {poolEURC.toFixed(2)} EURC</span>
            </div>

            {/* Admin Collected Fees Panel */}
            {userAddress?.toLowerCase() === '0x218b09a7d9ff6d69082ac605bb27029bc321b5c3' && (
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-3.5 space-y-2 animate-in slide-in-from-bottom-2 duration-200">
                <div className="flex items-center justify-between text-[9px] font-black text-emerald-800 uppercase tracking-widest">
                  <span>💼 Admin Fee Dashboard</span>
                  <span className="bg-emerald-100 px-1.5 py-0.5 rounded text-[8px] text-emerald-700 font-bold uppercase">Active</span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-700">
                  <span>Accumulated Fees:</span>
                  <span className="text-emerald-750 font-black">
                    {collectedFeesUSDC.toFixed(2)} USDC / {collectedFeesEURC.toFixed(2)} EURC
                  </span>
                </div>
                <button
                  onClick={handleWithdrawFees}
                  disabled={isWithdrawingFees || (collectedFeesUSDC === 0 && collectedFeesEURC === 0)}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-[9px] uppercase tracking-wider transition-all disabled:opacity-40 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isWithdrawingFees ? (
                    <><Loader2 size={10} className="animate-spin" /> Claiming...</>
                  ) : (
                    <>💰 Claim Collected Fees</>
                  )}
                </button>
              </div>
            )}

            {/* Admin Liquidity Panel */}
            {userAddress?.toLowerCase() === '0x218b09a7d9ff6d69082ac605bb27029bc321b5c3' && (
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-2xl p-3.5 space-y-3 animate-in slide-in-from-bottom-2 duration-200">
                <div className="flex items-center justify-between text-[9px] font-black text-purple-800 uppercase tracking-widest">
                  <span>💧 Admin Liquidity Controls</span>
                  <span className="bg-purple-100 px-1.5 py-0.5 rounded text-[8px] text-purple-700 font-bold uppercase">Admin</span>
                </div>
                
                <div className="flex gap-2">
                  <div className="flex-1 space-y-1">
                    <label className="text-[9px] font-bold text-purple-700 uppercase">USDC Amount</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={adminUsdcAmount}
                      onChange={(e) => setAdminUsdcAmount(e.target.value)}
                      className="w-full bg-white border border-purple-100 rounded-lg py-2 px-3 text-[11px] font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-400 placeholder:text-slate-400"
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <label className="text-[9px] font-bold text-purple-700 uppercase">EURC Amount</label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={adminEurcAmount}
                      onChange={(e) => setAdminEurcAmount(e.target.value)}
                      className="w-full bg-white border border-purple-100 rounded-lg py-2 px-3 text-[11px] font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-400 placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleAddLiquidity}
                    disabled={isAdminAddingLiquidity || isProcessing || (!adminUsdcAmount && !adminEurcAmount)}
                    className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-[9px] uppercase tracking-wider transition-all disabled:opacity-40 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {isAdminAddingLiquidity ? (
                      <><Loader2 size={10} className="animate-spin" /> Adding...</>
                    ) : (
                      <>➕ Add Liquidity</>
                    )}
                  </button>
                  <button
                    onClick={handleRemoveLiquidity}
                    disabled={isAdminRemovingLiquidity || isProcessing || (!adminUsdcAmount && !adminEurcAmount)}
                    className="flex-1 py-2.5 bg-pink-500 hover:bg-pink-600 text-white rounded-xl font-bold text-[9px] uppercase tracking-wider transition-all disabled:opacity-40 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {isAdminRemovingLiquidity ? (
                      <><Loader2 size={10} className="animate-spin" /> Removing...</>
                    ) : (
                      <>➖ Remove Liquidity</>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Swap Button */}
            <button
              onClick={handleSwap}
              disabled={isProcessing || !swapAmount || Number(swapAmount) <= 0 || Number(swapAmount) > activeFromBalance}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-black text-[11px] tracking-widest uppercase transition-all shadow-lg shadow-blue-500/25 cursor-pointer disabled:opacity-40 active:scale-[0.98] duration-150 flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <><Loader2 size={14} className="animate-spin" /> Processing...</>
              ) : (
                <><Coins size={14} /> Swap {fromToken} → {toToken}</>
              )}
            </button>
          </div>
        )}

        {/* ========== BURN TAB ========== */}
        {activeTab === 'burn' && (
          <div className="space-y-4">
            {/* Info Banner */}
            <div className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-100 rounded-2xl p-3.5 flex items-start gap-2.5">
              <Flame size={14} className="text-orange-500 mt-0.5 flex-shrink-0" />
              <p className="text-[10px] text-orange-700 font-semibold leading-relaxed">
                Burn any ERC-20 token on Arc Chain Testnet. Tokens are sent to the dead address (0x...dead) and permanently removed from circulation.
              </p>
            </div>

            {/* Quick Select */}
            <div className="space-y-1.5">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Quick Select Token</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setBurnTokenAddress(USDC_ADDRESS)}
                  className={`py-2.5 rounded-2xl font-black text-[10px] transition-all cursor-pointer border ${
                    burnTokenAddress.toLowerCase() === USDC_ADDRESS.toLowerCase()
                      ? 'bg-orange-50 text-orange-600 border-orange-200 shadow-sm'
                      : 'bg-white text-slate-400 border-slate-200 hover:border-orange-200'
                  }`}
                >
                  🔵 USDC
                </button>
                <button
                  onClick={() => setBurnTokenAddress(EURC_ADDRESS)}
                  className={`py-2.5 rounded-2xl font-black text-[10px] transition-all cursor-pointer border ${
                    burnTokenAddress.toLowerCase() === EURC_ADDRESS.toLowerCase()
                      ? 'bg-orange-50 text-orange-600 border-orange-200 shadow-sm'
                      : 'bg-white text-slate-400 border-slate-200 hover:border-orange-200'
                  }`}
                >
                  🟣 EURC
                </button>
              </div>
            </div>

            {/* Token Address Input */}
            <div className="space-y-1.5">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Token Contract Address</span>
              <input
                type="text"
                value={burnTokenAddress}
                onChange={(e) => setBurnTokenAddress(e.target.value)}
                placeholder="0x..."
                disabled={isProcessing}
                className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-300 rounded-2xl p-3.5 text-xs font-mono outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
              />
            </div>

            {/* Burn Amount */}
            <div className="space-y-1.5">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Amount to Burn</span>
              <input
                type="number"
                value={burnAmount}
                onChange={(e) => setBurnAmount(e.target.value)}
                placeholder="0.00"
                disabled={isProcessing}
                className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-300 rounded-2xl p-4 text-lg font-extrabold outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
              />
            </div>

            {/* Burn Button */}
            <button
              onClick={handleBurn}
              disabled={isProcessing || !burnTokenAddress || !burnAmount || Number(burnAmount) <= 0}
              className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-2xl font-black text-[11px] tracking-widest uppercase transition-all shadow-lg shadow-orange-500/25 cursor-pointer disabled:opacity-40 active:scale-[0.98] duration-150 flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <><Loader2 size={14} className="animate-spin" /> Burning...</>
              ) : (
                <><Flame size={14} /> Burn Tokens Forever 🔥</>
              )}
            </button>
          </div>
        )}

        {/* Error Message */}
        {errorMessage && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-3 text-[10px] font-bold text-red-600 flex items-center gap-2">
            ⚠️ {errorMessage}
          </div>
        )}
      </div>

      {/* RIGHT: Progress Monitor */}
      <div className="bg-white border border-slate-200/80 rounded-[32px] p-6 shadow-sm space-y-5">
        <div>
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
            {activeTab === 'swap' ? 'Swap Progress Monitor' : 'Burn Progress Monitor'}
          </h3>
          <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
            {activeTab === 'swap'
              ? 'Real-time swap tracking via USDC/EURC Liquidity Pool'
              : 'Real-time burn tracking on Arc Chain Testnet'}
          </p>
        </div>

        {/* Steps */}
        {steps.length > 0 ? (
          <div className="space-y-4">
            {steps.map((step, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`flex items-start gap-4 p-4 rounded-2xl border transition-all duration-300 ${
                  step.status === 'active'
                    ? 'bg-blue-50 border-blue-200 shadow-sm shadow-blue-100'
                    : step.status === 'success'
                    ? 'bg-emerald-50 border-emerald-200'
                    : step.status === 'failed'
                    ? 'bg-red-50 border-red-200'
                    : 'bg-slate-50 border-slate-200/60'
                }`}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {step.status === 'active' && <Loader2 size={18} className="text-blue-500 animate-spin" />}
                  {step.status === 'success' && <CheckCircle size={18} className="text-emerald-500" />}
                  {step.status === 'failed' && <span className="text-red-500 text-lg">✕</span>}
                  {step.status === 'pending' && (
                    <div className="w-[18px] h-[18px] rounded-full border-2 border-slate-300 flex items-center justify-center">
                      <span className="text-[8px] font-black text-slate-400">{idx + 1}</span>
                    </div>
                  )}
                </div>
                <div>
                  <h4 className={`text-xs font-black ${
                    step.status === 'active' ? 'text-blue-700' :
                    step.status === 'success' ? 'text-emerald-700' :
                    step.status === 'failed' ? 'text-red-700' :
                    'text-slate-500'
                  }`}>{step.title}</h4>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
            <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center">
              {activeTab === 'swap' ? <Coins size={24} className="text-slate-300" /> : <Flame size={24} className="text-slate-300" />}
            </div>
            <p className="text-xs font-bold text-slate-400">
              {activeTab === 'swap' ? 'Ready to swap USDC ↔ EURC' : 'Ready to burn tokens'}
            </p>
            <p className="text-[10px] text-slate-300 font-semibold">
              {activeTab === 'swap' ? 'Enter an amount and initiate a swap to see live progress' : 'Enter token details to start burning'}
            </p>
          </div>
        )}

        {/* Success State */}
        {txSuccess && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4 text-center space-y-2"
          >
            <div className="text-2xl">🎉</div>
            <h4 className="text-xs font-black text-emerald-700 uppercase tracking-wider">
              {activeTab === 'swap' ? 'Swap Successful!' : 'Tokens Burned!'}
            </h4>
            <p className="text-[10px] text-emerald-600 font-semibold">
              {activeTab === 'swap'
                ? `Successfully swapped ${swapAmount} ${fromToken} → ${outputAmount} ${toToken}`
                : `Successfully burned ${burnAmount} tokens to 0x...dead`}
            </p>
            <button
              onClick={resetState}
              className="mt-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider cursor-pointer hover:bg-emerald-700 transition-all"
            >
              New Transaction
            </button>
          </motion.div>
        )}

        {/* Wallet Info */}
        <div className="border-t border-slate-100 pt-4 space-y-2">
          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Your Balances</span>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-3 text-center">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">USDC</p>
              <p className="text-sm font-black text-slate-800 mt-0.5">{realUsdcBalance.toFixed(2)}</p>
            </div>
            <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-3 text-center">
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-wider">EURC</p>
              <p className="text-sm font-black text-slate-800 mt-0.5">{realEurcBalance.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
