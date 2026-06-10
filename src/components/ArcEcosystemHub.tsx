'use client';

import React, { useState, useEffect } from 'react';
import { useAccount, usePublicClient, useWalletClient, useWatchContractEvent, useWriteContract, useReadContract } from 'wagmi';
import { formatUnits, parseUnits, erc20Abi } from 'viem';
import { Activity, Globe, Zap, Clock, ArrowRightLeft, Loader2, TrendingUp, CheckCircle, Search, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';

import { 
  ECOSYSTEM_USDC_ADDRESS, 
  ECOSYSTEM_EURC_ADDRESS, 
  ECOSYSTEM_CRBTC_ADDRESS,
  ECOSYSTEM_FACTORY_ADDRESS,
  ECOSYSTEM_ROUTER_ADDRESS,
  ecosystemFactoryAbi,
  ecosystemRouterAbi
} from '@/lib/arcEcosystemAbi';

// Mock data structures until real events flow in
type TokenDeployment = {
  address: string;
  name: string;
  ticker: string;
  timestamp: number;
  volume: number;
  isNew?: boolean;
};

type SwapTx = {
  hash: string;
  isBuy: boolean;
  ticker: string;
  amount: number;
  volume: number;
  timestamp: number;
};

export function ArcEcosystemHub() {
  const { isConnected, address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { writeContractAsync } = useWriteContract();

  // State
  const [tokens, setTokens] = useState<TokenDeployment[]>([]);
  const [swaps, setSwaps] = useState<SwapTx[]>([]);
  const [totalCumulativeVolume, setTotalCumulativeVolume] = useState(0);
  const [selectedToken, setSelectedToken] = useState<TokenDeployment | null>(null);

  // Swap Panel State
  const [swapAmount, setSwapAmount] = useState('');
  const [baseAnchor, setBaseAnchor] = useState<'USDC' | 'EURC' | 'crBTC'>('USDC');
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapDirection, setSwapDirection] = useState<'BUY' | 'SELL'>('BUY'); // BUY = Anchor -> Token, SELL = Token -> Anchor

  // Event Listeners (using wagmi hooks)
  useWatchContractEvent({
    address: ECOSYSTEM_FACTORY_ADDRESS as `0x${string}`,
    abi: ecosystemFactoryAbi,
    eventName: 'TokenCreated',
    onLogs(logs) {
      logs.forEach(log => {
        const { tokenAddress, name, ticker, timestamp } = log.args;
        if (tokenAddress && name && ticker && timestamp) {
          const newToken: TokenDeployment = {
            address: tokenAddress,
            name,
            ticker,
            timestamp: Number(timestamp) * 1000,
            volume: 0,
            isNew: true
          };
          setTokens(prev => [newToken, ...prev]);
          toast.success(`New Token Deployed: ${ticker}`, { icon: '🚀' });
        }
      });
    },
  });

  useWatchContractEvent({
    address: ECOSYSTEM_ROUTER_ADDRESS as `0x${string}`,
    abi: ecosystemRouterAbi,
    eventName: 'Swap',
    onLogs(logs) {
      logs.forEach(log => {
        const { amountIn, amountOut, isBuy, tokenIn, tokenOut } = log.args;
        if (amountIn && amountOut && isBuy !== undefined) {
          const volume = Number(formatUnits(isBuy ? amountIn : amountOut, 18)); // Mock decimals
          const newSwap: SwapTx = {
            hash: log.transactionHash,
            isBuy,
            ticker: 'UNKNOWN', // Will match against token list in a real app
            amount: Number(formatUnits(amountIn, 18)),
            volume: volume,
            timestamp: Date.now()
          };
          setSwaps(prev => [newSwap, ...prev].slice(0, 50));
          setTotalCumulativeVolume(prev => prev + volume);
        }
      });
    },
  });

  // Mock initial data population
  useEffect(() => {
    setTokens([
      { address: '0x123...456', name: 'Arc AI', ticker: 'ARCAI', timestamp: Date.now() - 3600000, volume: 14500.50 },
      { address: '0xabc...def', name: 'Nexus Node', ticker: 'NEXUS', timestamp: Date.now() - 7200000, volume: 8200.00 },
      { address: '0x789...012', name: 'Quantum Yield', ticker: 'QY', timestamp: Date.now() - 86400000, volume: 450.25 },
    ]);
    
    setSwaps([
      { hash: '0xaa...bb', isBuy: true, ticker: 'ARCAI', amount: 500, volume: 500, timestamp: Date.now() - 10000 },
      { hash: '0xcc...dd', isBuy: false, ticker: 'NEXUS', amount: 1200, volume: 1200, timestamp: Date.now() - 45000 },
      { hash: '0xee...ff', isBuy: true, ticker: 'QY', amount: 50, volume: 50, timestamp: Date.now() - 120000 },
    ]);
    
    setTotalCumulativeVolume(23150.75);
  }, []);

  // Remove "new" highlight after a few seconds
  useEffect(() => {
    if (tokens.some(t => t.isNew)) {
      const timer = setTimeout(() => {
        setTokens(prev => prev.map(t => ({ ...t, isNew: false })));
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [tokens]);

  const handleSwapExecute = async () => {
    if (!isConnected) return toast.error("Please connect your wallet");
    if (!selectedToken) return toast.error("Select a token first");
    if (!swapAmount || Number(swapAmount) <= 0) return toast.error("Enter a valid amount");

    setIsSwapping(true);
    try {
      let anchorAddress = ECOSYSTEM_USDC_ADDRESS;
      let decimals = 6;
      if (baseAnchor === 'EURC') { anchorAddress = ECOSYSTEM_EURC_ADDRESS; decimals = 6; }
      if (baseAnchor === 'crBTC') { anchorAddress = ECOSYSTEM_CRBTC_ADDRESS; decimals = 8; }

      const tokenIn = swapDirection === 'BUY' ? anchorAddress : selectedToken.address;
      const tokenOut = swapDirection === 'BUY' ? selectedToken.address : anchorAddress;
      const amountInWei = parseUnits(swapAmount, swapDirection === 'BUY' ? decimals : 18);

      // 1. Approve
      toast.loading("Approving...", { id: 'swap-toast' });
      const approveTx = await writeContractAsync({
        address: tokenIn as `0x${string}`,
        abi: erc20Abi,
        functionName: 'approve',
        args: [ECOSYSTEM_ROUTER_ADDRESS as `0x${string}`, amountInWei],
      });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash: approveTx });

      // 2. Swap
      toast.loading("Executing Swap...", { id: 'swap-toast' });
      const swapTx = await writeContractAsync({
        address: ECOSYSTEM_ROUTER_ADDRESS as `0x${string}`,
        abi: ecosystemRouterAbi,
        functionName: 'swapExactTokensForTokens',
        args: [tokenIn as `0x${string}`, tokenOut as `0x${string}`, amountInWei, BigInt(0)],
      });
      
      if (publicClient) {
         await publicClient.waitForTransactionReceipt({ hash: swapTx });
      }

      toast.success("Swap Executed Successfully!", { id: 'swap-toast' });
      setSwapAmount('');
    } catch (e: any) {
      console.error(e);
      toast.error(e.shortMessage || e.message || "Swap failed", { id: 'swap-toast' });
    } finally {
      setIsSwapping(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="space-y-8"
    >
      {/* Header Matrix */}
      <div className="card rounded-[32px] p-6 sm:p-8 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden border border-[var(--border-dim)] bg-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-blue-50 to-transparent rounded-full -mr-20 -mt-20 blur-3xl" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-2xl bg-blue-50 text-[var(--accent-cyan)] shadow-sm">
              <Globe size={28} className="animate-pulse" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-[var(--text-primary)] tracking-tight">Arc Ecosystem Hub</h2>
              <p className="text-sm text-[var(--text-secondary)] font-medium flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Live Testnet Deployment & Routing Terminal
              </p>
            </div>
          </div>
        </div>

        <div className="relative z-10 bg-slate-50 border border-slate-200 rounded-2xl p-5 flex items-center gap-6 shadow-sm min-w-[280px]">
          <div>
            <p className="text-[10px] font-black uppercase text-[var(--text-secondary)] tracking-widest mb-1">Global Ecosystem Vol</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-[var(--text-primary)]">${totalCumulativeVolume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span className="text-xs font-bold text-emerald-500 flex items-center"><TrendingUp size={12} className="mr-0.5" /> Live</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Token Terminal & Swaps (8 cols) */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Feature A: Live Token Deployment Terminal */}
          <div className="card rounded-[24px] shadow-sm border border-[var(--border-dim)] overflow-hidden bg-white">
            <div className="p-5 border-b border-[var(--border-dim)] bg-slate-50/50 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Zap size={18} className="text-amber-500" />
                <h3 className="font-extrabold text-[var(--text-primary)] text-lg">Live Deployments</h3>
              </div>
              <div className="text-[10px] font-bold px-2 py-1 bg-amber-100 text-amber-700 rounded uppercase tracking-widest flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span> Listening
              </div>
            </div>
            <div className="p-0 overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-[10px] uppercase text-[var(--text-secondary)] bg-slate-50 border-b border-[var(--border-dim)]">
                  <tr>
                    <th className="px-6 py-4 font-black tracking-widest">Asset</th>
                    <th className="px-6 py-4 font-black tracking-widest">Contract</th>
                    <th className="px-6 py-4 font-black tracking-widest">Deployed</th>
                    <th className="px-6 py-4 font-black tracking-widest">Volume</th>
                    <th className="px-6 py-4 font-black tracking-widest text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {tokens.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-10 text-center text-[var(--text-secondary)] font-medium">
                          <Loader2 size={24} className="mx-auto mb-2 animate-spin text-slate-300" />
                          Waiting for new deployments...
                        </td>
                      </tr>
                    ) : (
                      tokens.map((token, idx) => (
                        <motion.tr 
                          key={token.address + idx}
                          initial={{ opacity: 0, backgroundColor: 'rgba(245, 158, 11, 0.1)' }}
                          animate={{ opacity: 1, backgroundColor: token.isNew ? 'rgba(245, 158, 11, 0.05)' : 'transparent' }}
                          transition={{ duration: 0.5 }}
                          className={`border-b border-[var(--border-dim)] hover:bg-slate-50 transition-colors group cursor-pointer ${selectedToken?.address === token.address ? 'bg-blue-50/50' : ''}`}
                          onClick={() => setSelectedToken(token)}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center font-bold text-xs text-indigo-700 border border-indigo-200">
                                {token.ticker.substring(0, 2)}
                              </div>
                              <div>
                                <div className="font-extrabold text-[var(--text-primary)]">{token.name}</div>
                                <div className="text-[10px] font-bold text-[var(--text-secondary)] tracking-widest">{token.ticker}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 font-mono text-xs text-[var(--text-secondary)]">
                            {token.address.substring(0, 6)}...{token.address.substring(token.address.length - 4)}
                          </td>
                          <td className="px-6 py-4 text-xs font-semibold text-[var(--text-secondary)]">
                            {new Date(token.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-bold text-[var(--text-primary)]">${token.volume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${selectedToken?.address === token.address ? 'bg-[var(--accent-cyan)] text-white shadow-md shadow-blue-500/20' : 'bg-slate-100 text-[var(--text-secondary)] group-hover:bg-slate-200'}`}>
                              {selectedToken?.address === token.address ? 'Selected' : 'Trade'}
                            </button>
                          </td>
                        </motion.tr>
                      ))
                    )}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </div>

          {/* Feature B: Live Transaction Matrix */}
          <div className="card rounded-[24px] shadow-sm border border-[var(--border-dim)] overflow-hidden bg-white">
            <div className="p-5 border-b border-[var(--border-dim)] bg-slate-50/50 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Activity size={18} className="text-emerald-500" />
                <h3 className="font-extrabold text-[var(--text-primary)] text-lg">Global Swap Stream</h3>
              </div>
            </div>
            <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
              <AnimatePresence>
                {swaps.length === 0 ? (
                  <div className="text-center py-10 text-[var(--text-secondary)] font-medium">
                    <Loader2 size={24} className="mx-auto mb-2 animate-spin text-slate-300" />
                    Listening for swaps...
                  </div>
                ) : (
                  swaps.map((swap, idx) => (
                    <motion.div
                      key={swap.hash + idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center justify-between p-3 rounded-xl border border-[var(--border-dim)] bg-slate-50/50 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${swap.isBuy ? 'bg-emerald-100 text-emerald-600 border border-emerald-200' : 'bg-rose-100 text-rose-600 border border-rose-200'}`}>
                          {swap.isBuy ? 'BUY' : 'SELL'}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-[var(--text-primary)]">
                            {swap.isBuy ? (
                              <span><span className="text-emerald-600">🟩 Bought</span> {swap.amount.toLocaleString()} <span className="font-black text-xs">{swap.ticker}</span></span>
                            ) : (
                              <span><span className="text-rose-600">🟥 Sold</span> {swap.amount.toLocaleString()} <span className="font-black text-xs">{swap.ticker}</span></span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-mono text-[var(--text-secondary)]">{swap.hash.substring(0, 10)}...</span>
                            <span className="text-[10px] text-[var(--text-secondary)]">•</span>
                            <span className="text-[10px] text-[var(--text-secondary)] font-medium">{new Date(swap.timestamp).toLocaleTimeString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-[var(--text-primary)]">${swap.volume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        <div className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">Vol</div>
                      </div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>

        </div>

        {/* Right Column: Execution Panel (4 cols) */}
        <div className="lg:col-span-4">
          <div className="sticky top-8 space-y-6">
            
            {/* Feature C: Integrated Buy/Sell Fast Routing Panel */}
            <div className="card rounded-[24px] shadow-sm border border-[var(--border-dim)] overflow-hidden bg-white p-6 relative">
              <h3 className="font-extrabold text-[var(--text-primary)] text-lg mb-6 flex items-center gap-2">
                <ArrowRightLeft size={18} className="text-[var(--accent-cyan)]" /> Fast Routing
              </h3>

              {!selectedToken ? (
                <div className="text-center py-12 px-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
                  <Search size={32} className="mx-auto text-slate-300 mb-3" />
                  <p className="text-sm font-bold text-[var(--text-secondary)]">Select a token from the terminal to trade.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Token Info Block */}
                  <div className="flex items-center gap-3 p-4 rounded-2xl bg-blue-50/50 border border-blue-100">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center font-bold text-sm text-indigo-700">
                      {selectedToken.ticker.substring(0, 2)}
                    </div>
                    <div>
                      <div className="font-black text-[var(--text-primary)]">{selectedToken.name} <span className="text-xs text-[var(--text-secondary)] ml-1">{selectedToken.ticker}</span></div>
                      <div className="text-[10px] font-mono text-[var(--text-secondary)]">{selectedToken.address.substring(0, 8)}...{selectedToken.address.substring(selectedToken.address.length - 6)}</div>
                    </div>
                  </div>

                  {/* Mode Toggle */}
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button 
                      onClick={() => setSwapDirection('BUY')}
                      className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${swapDirection === 'BUY' ? 'bg-white text-emerald-600 shadow-sm border border-emerald-100' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                      BUY
                    </button>
                    <button 
                      onClick={() => setSwapDirection('SELL')}
                      className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${swapDirection === 'SELL' ? 'bg-white text-rose-600 shadow-sm border border-rose-100' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                    >
                      SELL
                    </button>
                  </div>

                  {/* Anchor Selection */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Pay With Anchor</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['USDC', 'EURC', 'crBTC'].map((anchor) => (
                        <button
                          key={anchor}
                          onClick={() => setBaseAnchor(anchor as any)}
                          className={`py-2 rounded-xl text-xs font-bold border transition-all ${baseAnchor === anchor ? 'bg-[rgba(0,242,254,0.05)] border-[var(--accent-cyan)] text-[var(--accent-cyan)] shadow-sm shadow-blue-500/10' : 'bg-white border-[var(--border-dim)] text-[var(--text-secondary)] hover:border-slate-300'}`}
                        >
                          {anchor}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Amount Input */}
                  <div className="space-y-2 relative">
                    <div className="flex justify-between items-end">
                      <label className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Amount ({swapDirection === 'BUY' ? baseAnchor : selectedToken.ticker})</label>
                      <span className="text-[10px] font-semibold text-[var(--text-secondary)] cursor-pointer hover:text-[var(--accent-cyan)]">Balance: 0.00</span>
                    </div>
                    <div className="relative">
                      <input 
                        type="number" 
                        value={swapAmount}
                        onChange={(e) => setSwapAmount(e.target.value)}
                        placeholder="0.0"
                        className="w-full bg-slate-50 border border-[var(--border-dim)] rounded-xl px-4 py-3.5 text-lg font-bold outline-none focus:border-[var(--accent-cyan)] transition-colors pr-16"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-[var(--text-secondary)] bg-white px-2 py-1 rounded-lg border border-slate-200">
                        {swapDirection === 'BUY' ? baseAnchor : selectedToken.ticker}
                      </div>
                    </div>
                  </div>

                  {/* Details Block */}
                  <div className="bg-slate-50 rounded-xl p-3 space-y-2 border border-slate-100">
                    <div className="flex justify-between text-xs">
                      <span className="text-[var(--text-secondary)] font-medium">Est. Output</span>
                      <span className="font-bold text-[var(--text-primary)]">-- {swapDirection === 'BUY' ? selectedToken.ticker : baseAnchor}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[var(--text-secondary)] font-medium">Price Impact</span>
                      <span className="font-bold text-emerald-500">&lt; 0.01%</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[var(--text-secondary)] font-medium">Network Fee</span>
                      <span className="font-bold text-[var(--text-primary)]">~ $0.002</span>
                    </div>
                  </div>

                  {/* Execute Button */}
                  <button 
                    onClick={handleSwapExecute}
                    disabled={isSwapping || !swapAmount || Number(swapAmount) <= 0}
                    className={`w-full py-4 rounded-xl text-sm font-black tracking-wider uppercase transition-all shadow-lg flex items-center justify-center gap-2 ${
                      isSwapping || !swapAmount || Number(swapAmount) <= 0
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                        : swapDirection === 'BUY' 
                          ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/25' 
                          : 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/25'
                    }`}
                  >
                    {isSwapping ? (
                      <><Loader2 size={18} className="animate-spin" /> Routing...</>
                    ) : (
                      <>Execute {swapDirection}</>
                    )}
                  </button>

                </div>
              )}
            </div>

            {/* Quick Stats Panel */}
            <div className="card rounded-[24px] shadow-sm border border-[var(--border-dim)] overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white relative">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Globe size={80} />
              </div>
              <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4">Network Status</h4>
              <div className="space-y-4 relative z-10">
                <div>
                  <div className="text-[10px] text-slate-400 font-bold">Anchors Online</div>
                  <div className="font-black flex gap-2 mt-1">
                    <span className="px-2 py-1 bg-slate-700/50 rounded text-xs text-blue-300">USDC</span>
                    <span className="px-2 py-1 bg-slate-700/50 rounded text-xs text-blue-300">EURC</span>
                    <span className="px-2 py-1 bg-slate-700/50 rounded text-xs text-orange-300">crBTC</span>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-bold">RPC Latency</div>
                  <div className="font-black text-emerald-400 text-lg flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> 12ms
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
        
      </div>
    </motion.div>
  );
}
