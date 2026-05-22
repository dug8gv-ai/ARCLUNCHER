'use client';

import { useState, useEffect } from 'react';
import { useAccount, usePublicClient, useWriteContract } from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Coins, Flame, Loader2, Zap, CheckCircle, RefreshCw, ArrowDownUp, Droplet, ShieldCheck, Info } from 'lucide-react';
import { erc20Abi, parseUnits, formatUnits } from 'viem';
import { USDC_ADDRESS, EURC_ADDRESS, ARC_DEFI_ROUTER_ADDRESS, ARC_GLOBAL_POOL_ADDRESS, arcPoolAbi } from '@/lib/arcDefiAbi';

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

  // Transaction States
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [steps, setSteps] = useState<SwapStep[]>([]);
  const [currentStepIdx, setCurrentStepIdx] = useState<number>(-1);
  const [txSuccess, setTxSuccess] = useState(false);

  // FX Rate & Tokens
  const fxRate = swapDirection === 'USDC_TO_EURC' ? 0.92 : 1.09;
  const fromToken = swapDirection === 'USDC_TO_EURC' ? 'USDC' : 'EURC';
  const toToken = swapDirection === 'USDC_TO_EURC' ? 'EURC' : 'USDC';

  // Fetch real on-chain balances
  const fetchBalances = async () => {
    if (!userAddress || !publicClient) return;
    setIsFetchingBalances(true);

    let usdcVal = 0;
    let eurcVal = 0;

    try {
      const usdcRaw = await publicClient.readContract({
        address: USDC_ADDRESS as `0x${string}`,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [userAddress],
      });
      usdcVal += Number(formatUnits(usdcRaw as bigint, 6));
    } catch (err) {
      console.error('USDC ERC20 fetch error:', err);
    }

    try {
      const eurcRaw = await publicClient.readContract({
        address: EURC_ADDRESS as `0x${string}`,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [userAddress],
      });
      eurcVal += Number(formatUnits(eurcRaw as bigint, 6));
    } catch (err) {
      console.error('EURC ERC20 fetch error:', err);
    }

    setRealUsdcBalance(usdcVal);
    setRealEurcBalance(eurcVal);
    setIsFetchingBalances(false);
  };

  useEffect(() => {
    fetchBalances();
  }, [userAddress, publicClient]);

  // Auto-calculate output when swap amount changes
  useEffect(() => {
    if (!swapAmount || Number(swapAmount) <= 0) {
      setOutputAmount('');
      return;
    }
    const amt = Number(swapAmount);
    if (amt <= 0) {
      setOutputAmount('0.00');
      return;
    }
    // Try to get on-chain estimate from pool (send amt + 2 so the contract swaps exactly amt)
    const fetchEstimate = async () => {
      if (!publicClient) {
        setOutputAmount((amt * fxRate).toFixed(2));
        return;
      }
      try {
        const estimate = await publicClient.readContract({
          address: ARC_GLOBAL_POOL_ADDRESS as `0x${string}`,
          abi: arcPoolAbi,
          functionName: 'getSwapEstimate',
          args: [swapDirection === 'USDC_TO_EURC', parseUnits(String(amt + 0.1), 6)],
        });
        setOutputAmount(Number(formatUnits(estimate as bigint, 6)).toFixed(2));
      } catch {
        setOutputAmount((amt * fxRate).toFixed(2));
      }
    };
    fetchEstimate();
  }, [swapAmount, swapDirection, fxRate, publicClient]);

  // Real balances (no localStorage offsets)
  const activeFromBalance = swapDirection === 'USDC_TO_EURC' ? realUsdcBalance : realEurcBalance;

  const updateStepStatus = (idx: number, status: SwapStep['status']) => {
    setSteps(prev => {
      const newSteps = [...prev];
      if (newSteps[idx]) newSteps[idx].status = status;
      return newSteps;
    });
  };

  // ========== HANDLE SWAP (REAL ON-CHAIN) ==========
  const handleSwap = async () => {
    if (!isConnected || !userAddress) {
      setErrorMessage('Please connect your wallet first!');
      return;
    }
    const amt = Number(swapAmount);
    if (!swapAmount || amt <= 0) {
      setErrorMessage('Amount must be greater than 0.');
      return;
    }
    const totalAmount = amt + 0.1;
    if (totalAmount > activeFromBalance) {
      setErrorMessage(`Insufficient ${fromToken} balance. You need ${totalAmount} ${fromToken} (including 0.1 fee).`);
      return;
    }


    setIsProcessing(true);
    setCurrentStepIdx(0);
    setErrorMessage(null);
    setTxSuccess(false);

    const fromAddress = swapDirection === 'USDC_TO_EURC' ? USDC_ADDRESS : EURC_ADDRESS;
    const totalAmountWei = parseUnits(String(totalAmount), 6);
    const poolAddr = ARC_GLOBAL_POOL_ADDRESS as `0x${string}`;

    setSteps([
      { title: `1. Approve ${fromToken}`, desc: `Authorizing ${fromToken} for pool`, status: 'pending' },
      { title: `2. Execute Swap`, desc: `Converting ${fromToken} → ${toToken} on-chain`, status: 'pending' },
      { title: `3. Finalize`, desc: `Confirming & refreshing balances`, status: 'pending' },
    ]);

    try {
      // Step 1: Approve the POOL contract (not the old router)
      updateStepStatus(0, 'active');
      const approveTx = await writeContractAsync({
        address: fromAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: 'approve',
        args: [poolAddr, totalAmountWei],
      });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: approveTx });
      }
      updateStepStatus(0, 'success');
      setCurrentStepIdx(1);

      // Step 2: Real on-chain swap via ArcLiquidityPool contract
      updateStepStatus(1, 'active');
      const swapFn = swapDirection === 'USDC_TO_EURC' ? 'swapUSDCtoEURC' : 'swapEURCtoUSDC';
      const swapTx = await writeContractAsync({
        address: poolAddr,
        abi: arcPoolAbi,
        functionName: swapFn,
        args: [totalAmountWei],
      });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: swapTx });
      }
      updateStepStatus(1, 'success');
      setCurrentStepIdx(2);

      // Step 3: Refresh real balances
      updateStepStatus(2, 'active');
      await fetchBalances();
      updateStepStatus(2, 'success');

      setTxSuccess(true);
      window.dispatchEvent(new Event('arc-balance-update'));
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.shortMessage || err.message || 'Swap failed');
      const failIdx = steps.findIndex(s => s.status === 'active');
      if (failIdx >= 0) {
        updateStepStatus(failIdx, 'failed');
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
      { title: `1. Burn Tokens`, desc: `Send tokens to dead address (0xdead)`, status: 'pending' },
      { title: `2. Confirm Burn`, desc: `Waiting for block confirmation`, status: 'pending' },
    ]);

    try {
      const isStablecoin = burnTokenAddress.toLowerCase() === USDC_ADDRESS.toLowerCase() || burnTokenAddress.toLowerCase() === EURC_ADDRESS.toLowerCase();
      const decimals = isStablecoin ? 6 : 18;
      const amtWei = parseUnits(burnAmount, decimals);
      const DEAD_ADDRESS = '0x000000000000000000000000000000000000dEaD';

      updateStepStatus(0, 'active');
      const burnTx = await writeContractAsync({
        address: burnTokenAddress as `0x${string}`,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [DEAD_ADDRESS, amtWei],
      });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: burnTx });
      }
      updateStepStatus(0, 'success');
      setCurrentStepIdx(1);

      updateStepStatus(1, 'active');
      await new Promise(r => setTimeout(r, 1500));
      updateStepStatus(1, 'success');

      setTxSuccess(true);
      await fetchBalances();
      window.dispatchEvent(new Event('arc-balance-update'));
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.shortMessage || err.message || 'Burn failed');
      if (currentStepIdx >= 0 && currentStepIdx < steps.length) {
        updateStepStatus(currentStepIdx, 'failed');
      }
    }
    setIsProcessing(false);
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
            onClick={() => fetchBalances()}
            className="text-slate-400 hover:text-blue-600 transition-colors p-2 rounded-xl hover:bg-blue-50 cursor-pointer"
          >
            <RefreshCw size={14} className={isFetchingBalances ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Tab Selector: Swap / Burn */}
        <div className="flex gap-2 p-1.5 bg-slate-100 rounded-2xl">
          <button
            onClick={() => { setActiveTab('swap'); resetState(); }}
            className={`flex-1 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'swap' ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <ArrowDownUp size={14} /> Native Swap
          </button>
          <button
            onClick={() => { setActiveTab('burn'); resetState(); }}
            className={`flex-1 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'burn' ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Flame size={14} /> Burn Tokens
          </button>
        </div>

        {/* -------------------- SWAP TAB -------------------- */}
        {activeTab === 'swap' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* From Asset */}
            <div className="bg-slate-50 border border-slate-200/50 rounded-3xl p-4 space-y-2">
              <div className="flex justify-between items-center px-1">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Pay With</span>
                <span className="text-[10px] font-bold text-slate-500">
                  Balance: <span className="text-slate-800 font-black">{activeFromBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <input
                    type="number"
                    value={swapAmount}
                    onChange={(e) => setSwapAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-transparent text-3xl font-black text-slate-900 outline-none placeholder-slate-300"
                  />
                  <div className="text-[10px] font-bold text-slate-400 mt-1 pl-1">
                    ~${swapAmount ? (Number(swapAmount) * (fromToken === 'USDC' ? 1 : 1.09)).toFixed(2) : '0.00'}
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-2 rounded-2xl shadow-sm">
                  <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px]">
                    {fromToken === 'USDC' ? '🔵' : '🟣'}
                  </div>
                  <span className="font-black text-slate-800 tracking-tight">{fromToken}</span>
                </div>
              </div>
            </div>

            {/* Switch Direction Button */}
            <div className="flex justify-center -my-3 relative z-10">
              <button
                onClick={() => setSwapDirection(prev => prev === 'USDC_TO_EURC' ? 'EURC_TO_USDC' : 'USDC_TO_EURC')}
                className="bg-white border border-slate-200 p-2.5 rounded-2xl shadow-sm text-slate-400 hover:text-blue-600 hover:scale-105 transition-all cursor-pointer active:scale-95"
              >
                <ArrowDownUp size={16} />
              </button>
            </div>

            {/* To Asset */}
            <div className="bg-slate-50 border border-slate-200/50 rounded-3xl p-4 space-y-2">
              <div className="flex justify-between items-center px-1">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Receive</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <input
                    type="text"
                    value={outputAmount}
                    readOnly
                    placeholder="0.00"
                    className="w-full bg-transparent text-3xl font-black text-slate-900 outline-none placeholder-slate-300 opacity-60"
                  />
                  <div className="text-[10px] font-bold text-slate-400 mt-1 pl-1">
                    ~${outputAmount ? (Number(outputAmount) * (toToken === 'USDC' ? 1 : 1.09)).toFixed(2) : '0.00'}
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-2 rounded-2xl shadow-sm">
                  <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-[10px]">
                    {toToken === 'USDC' ? '🔵' : '🟣'}
                  </div>
                  <span className="font-black text-slate-800 tracking-tight">{toToken}</span>
                </div>
              </div>
            </div>

            {/* Rate Info */}
            <div className="flex items-center justify-between px-2 text-[10px] font-bold text-slate-500 bg-slate-50 py-2 rounded-xl border border-slate-100">
              <div className="flex items-center gap-1.5"><Info size={12} /> Exchange Rate</div>
              <div>1 {fromToken} = {fxRate} {toToken}</div>
            </div>
            
            {/* Verified Alert */}
             <div className="flex flex-col gap-2 my-3">
               <div className="flex items-center justify-center gap-2 text-[9px] font-bold text-blue-500 uppercase tracking-widest bg-blue-50/50 p-2 rounded-lg border border-blue-100">
                  <ShieldCheck size={14} /> Powered by Arc App Kit Native Swap
               </div>
               <div className="flex items-start gap-2 bg-slate-50 border border-slate-200 p-3 rounded-xl">
                 <Info size={14} className="text-slate-400 mt-0.5 flex-shrink-0" />
                 <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                   <strong>Swap Fee:</strong> A flat fee of 0.1 {fromToken} is added to your swap amount.<br/>
                   <strong>Total Deducted:</strong> {swapAmount ? Number(swapAmount) + 0.1 : 0.1} {fromToken}
                 </p>
               </div>
            </div>

            <button
              onClick={handleSwap}
              disabled={isProcessing || !swapAmount || Number(swapAmount) <= 0 || (Number(swapAmount) + 0.1) > activeFromBalance}
              className="w-full py-4.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-[11px] tracking-widest uppercase transition-all shadow-lg shadow-blue-500/25 cursor-pointer disabled:opacity-40 active:scale-[0.98]"
            >
              Swap Now
            </button>
          </div>
        )}

        {/* -------------------- BURN TAB -------------------- */}
        {activeTab === 'burn' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="bg-red-50/50 border border-red-100 rounded-2xl p-4 text-center space-y-1">
              <Flame className="mx-auto text-red-500 mb-2" size={24} />
              <h4 className="text-xs font-black text-red-700 uppercase tracking-wider">Permanent Burn</h4>
              <p className="text-[10px] font-semibold text-red-500">Tokens sent here are destroyed forever (0xdead).</p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">Token Contract Address</span>
                <input
                  type="text"
                  value={burnTokenAddress}
                  onChange={(e) => setBurnTokenAddress(e.target.value)}
                  placeholder="0x..."
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 rounded-2xl p-3.5 text-xs font-mono outline-none focus:border-red-500 focus:bg-white transition-all shadow-sm"
                />
              </div>

              <div className="space-y-1">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-1">Amount to Burn</span>
                <input
                  type="number"
                  value={burnAmount}
                  onChange={(e) => setBurnAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 rounded-2xl p-3.5 text-xs font-extrabold outline-none focus:border-red-500 focus:bg-white transition-all shadow-sm"
                />
              </div>
            </div>

            <button
              onClick={handleBurn}
              disabled={isProcessing || !burnTokenAddress || !burnAmount || Number(burnAmount) <= 0}
              className="w-full py-4.5 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-[11px] tracking-widest uppercase transition-all shadow-lg shadow-red-500/25 cursor-pointer disabled:opacity-40 active:scale-[0.98]"
            >
              Confirm Burn
            </button>
          </div>
        )}

      </div>

      {/* RIGHT: Status / Summary Panel */}
      <div className="space-y-6">
        
        {/* Transaction Steps Card */}
        {steps.length > 0 && (
          <div className="bg-white border border-slate-200/80 rounded-[32px] p-6 shadow-sm">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-5 flex items-center gap-2">
              <Loader2 className={`w-4 h-4 ${isProcessing ? 'animate-spin text-blue-600' : 'text-emerald-500'}`} />
              Transaction Status
            </h4>
            
            <div className="space-y-4">
              {steps.map((step, idx) => (
                <div key={idx} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                      step.status === 'success' ? 'bg-emerald-50 border-emerald-500 text-emerald-500' :
                      step.status === 'active' ? 'bg-blue-50 border-blue-500 text-blue-600 animate-pulse' :
                      step.status === 'failed' ? 'bg-red-50 border-red-500 text-red-500' :
                      'bg-slate-50 border-slate-200 text-slate-300'
                    }`}>
                      {step.status === 'success' ? <CheckCircle size={12} strokeWidth={3} /> : 
                       step.status === 'active' ? <Loader2 size={12} className="animate-spin" /> : 
                       <span className="text-[10px] font-black">{idx + 1}</span>}
                    </div>
                    {idx < steps.length - 1 && (
                      <div className={`w-0.5 h-full my-1 rounded-full ${
                        step.status === 'success' ? 'bg-emerald-200' : 'bg-slate-100'
                      }`} />
                    )}
                  </div>
                  <div className="pb-3 pt-0.5">
                    <h5 className={`text-xs font-black ${
                      step.status === 'success' ? 'text-emerald-700' :
                      step.status === 'active' ? 'text-blue-700' :
                      step.status === 'failed' ? 'text-red-700' :
                      'text-slate-500'
                    }`}>{step.title}</h5>
                    <p className="text-[10px] text-slate-500 font-semibold mt-0.5 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {errorMessage && (
              <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-xl text-[10px] font-bold text-red-600 break-words">
                ❌ {errorMessage}
              </div>
            )}

            {txSuccess && (
              <div className="mt-4 p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-center gap-2 animate-in slide-in-from-bottom-2 duration-300">
                <CheckCircle className="text-emerald-500" size={16} />
                <span className="text-xs font-black text-emerald-700 tracking-wide uppercase">Transaction Successful!</span>
              </div>
            )}

            {(txSuccess || errorMessage) && (
              <button
                onClick={resetState}
                className="mt-4 w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all cursor-pointer"
              >
                Start New Transaction
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
