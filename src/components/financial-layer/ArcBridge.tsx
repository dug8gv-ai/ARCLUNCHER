'use client';

import { useState } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';
import { Network, ArrowRight, Loader2, CheckCircle2, AlertCircle, RefreshCw, ShieldCheck, Link2 } from 'lucide-react';
import { createBrowserAdapter, appKitBridge } from '@/lib/appKit';
import { USDC_ADDRESS } from '@/lib/arcDefiAbi';
import { formatUnits, erc20Abi } from 'viem';

const DESTINATION_CHAINS = [
  { id: 'Ethereum_Sepolia', name: 'Ethereum Sepolia', icon: '⟠' },
  { id: 'Base_Sepolia', name: 'Base Sepolia', icon: '🔵' },
  { id: 'Arbitrum_Sepolia', name: 'Arbitrum Sepolia', icon: '🔷' },
  { id: 'Optimism_Sepolia', name: 'Optimism Sepolia', icon: '🔴' }
];

export default function ArcBridge() {
  const { isConnected, address: userAddress } = useAccount();
  const publicClient = usePublicClient();
  
  const [usdcBalance, setUsdcBalance] = useState<number>(0);
  const [amount, setAmount] = useState('');
  const [destinationChain, setDestinationChain] = useState(DESTINATION_CHAINS[0].id);
  const [isBridging, setIsBridging] = useState(false);
  const [bridgeResult, setBridgeResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchBalance = async () => {
    if (!publicClient || !isConnected || !userAddress) return;
    try {
      const balance = await publicClient.readContract({
        address: USDC_ADDRESS as `0x${string}`,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [userAddress]
      });
      setUsdcBalance(Number(formatUnits(balance as bigint, 6)));
    } catch (e) {
      console.error('Error fetching USDC balance for bridge:', e);
    }
  };

  // Fetch initial balance
  useState(() => {
    fetchBalance();
  });

  const handleBridge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !userAddress) {
      setBridgeResult({ type: 'error', message: 'Please connect your wallet first.' });
      return;
    }

    const amt = Number(amount);
    if (!amount || amt <= 0) {
      setBridgeResult({ type: 'error', message: 'Enter a valid positive amount of USDC.' });
      return;
    }
    
    if (amt > usdcBalance) {
      setBridgeResult({ type: 'error', message: 'Insufficient USDC balance.' });
      return;
    }

    setIsBridging(true);
    setBridgeResult(null);

    try {
      const provider = (window as any).ethereum;
      if (!provider) throw new Error("No Web3 provider found.");

      const adapter = createBrowserAdapter(provider);

      // We use the same adapter for destination in this UI mock since user can only connect one chain at a time usually,
      // but in reality App Kit Bridge handles the CCTP attestation service.
      const result = await appKitBridge(adapter, adapter, amount, 'Arc_Testnet', destinationChain);

      setBridgeResult({ 
        type: 'success', 
        message: `Successfully initiated CCTP Bridge for ${amount} USDC to ${destinationChain.replace('_', ' ')}!` 
      });
      setAmount('');
      fetchBalance();
    } catch (err: any) {
      setBridgeResult({ type: 'error', message: err.shortMessage || err.message || 'Bridge transaction failed.' });
    } finally {
      setIsBridging(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      
      {/* Header */}
      <div className="flex items-center justify-between card rounded-3xl p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center border border-indigo-100 text-indigo-600 shadow-sm">
            <Network size={22} />
          </div>
          <div>
            <span className="text-[10px] uppercase font-extrabold tracking-widest text-indigo-600 block">Circle CCTP</span>
            <h2 className="text-xl font-black text-[var(--text-primary)] tracking-tight">Arc Native USDC Bridge</h2>
          </div>
        </div>
        <button 
          onClick={fetchBalance}
          className="p-3.5 hover:bg-[rgba(6,10,38,0.9)] border border-[var(--border-dim)] rounded-2xl transition-all text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          title="Refresh Balance"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Bridge Widget */}
        <div className="card rounded-[32px] p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center gap-2 mb-6">
            <Link2 size={16} className="text-indigo-600" />
            <h3 className="font-extrabold text-[var(--text-primary)]">Bridge Assets</h3>
          </div>
          
          <form onSubmit={handleBridge} className="space-y-6">
            
            {/* SOURCE */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-[var(--border-dim)]">
              <div className="flex justify-between items-center text-[10px] font-extrabold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
                <span>From Network</span>
                <span className="text-indigo-600">Arc Testnet</span>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-xs font-bold text-[var(--text-secondary)]">
                  <span>Asset</span>
                  <span>Native USDC</span>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full text-2xl font-black font-mono bg-transparent outline-none text-[var(--text-primary)]"
                  />
                  <button 
                    type="button" 
                    onClick={() => setAmount(usdcBalance.toString())}
                    className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-1 rounded"
                  >
                    MAX
                  </button>
                </div>
                <div className="text-[10px] font-bold text-[var(--text-secondary)]">
                  Available: ${usdcBalance.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}
                </div>
              </div>
            </div>

            <div className="flex justify-center -my-3">
              <div className="bg-[var(--bg-card)] p-2 border border-[var(--border-dim)] rounded-full shadow-sm z-10 text-indigo-600">
                <ArrowRight size={16} className="rotate-90 md:rotate-0" />
              </div>
            </div>

            {/* DESTINATION */}
            <div className="bg-indigo-50/50 rounded-2xl p-4 border border-indigo-100">
              <div className="flex justify-between items-center text-[10px] font-extrabold text-[var(--text-secondary)] uppercase tracking-wider mb-3">
                <span>To Network</span>
              </div>
              <select 
                value={destinationChain}
                onChange={(e) => setDestinationChain(e.target.value)}
                className="w-full card rounded-xl px-4 py-3 text-sm font-black text-[var(--text-primary)] shadow-sm outline-none cursor-pointer"
              >
                {DESTINATION_CHAINS.map(chain => (
                  <option key={chain.id} value={chain.id}>{chain.icon} {chain.name}</option>
                ))}
              </select>
              <div className="mt-4 flex justify-between text-xs font-bold text-[var(--text-secondary)]">
                <span>You will receive:</span>
                <span className="font-mono text-indigo-600">{amount ? amount : '0.00'} USDC</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={isBridging || !amount || Number(amount) <= 0}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-sm tracking-wide uppercase transition-all shadow-md shadow-indigo-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isBridging ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Initiating CCTP Bridge...
                </>
              ) : (
                'Bridge Native USDC'
              )}
            </button>

          </form>

          <AnimatePresence>
            {bridgeResult && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className={`p-4 rounded-xl border text-xs font-bold flex items-start gap-3 mt-4 ${
                  bridgeResult.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'
                }`}
              >
                {bridgeResult.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                <span>{bridgeResult.message}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Info Panel */}
        <div className="bg-slate-900 border border-[var(--border-dim)] rounded-[32px] p-6 sm:p-8 shadow-sm space-y-6 text-white">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck size={20} className="text-emerald-400" />
            <h3 className="font-extrabold text-white text-lg">Cross-Chain Transfer Protocol</h3>
          </div>
          <p className="text-sm text-[var(--text-secondary)] font-medium leading-relaxed">
            The Arc Network uses Circle's official CCTP infrastructure. This means your USDC is burned on the source chain and minted natively on the destination chain.
          </p>
          <div className="space-y-4">
            <div className="bg-slate-800/50 rounded-2xl p-4 border border-[var(--border-dim)]">
              <h4 className="text-xs font-bold text-slate-200 mb-1">0% Slippage</h4>
              <p className="text-[11px] text-[var(--text-secondary)]">Native CCTP transfers have absolute 1:1 parity for USDC. No liquidity pools involved.</p>
            </div>
            <div className="bg-slate-800/50 rounded-2xl p-4 border border-[var(--border-dim)]">
              <h4 className="text-xs font-bold text-slate-200 mb-1">No Wrapped Assets</h4>
              <p className="text-[11px] text-[var(--text-secondary)]">Receive pure, official USDC on the destination chain without dealing with bridged or wrapped derivatives.</p>
            </div>
            <div className="bg-slate-800/50 rounded-2xl p-4 border border-[var(--border-dim)]">
              <h4 className="text-xs font-bold text-slate-200 mb-1">Security</h4>
              <p className="text-[11px] text-[var(--text-secondary)]">Secured directly by Circle's attestation services and the Arc blockchain validators.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
