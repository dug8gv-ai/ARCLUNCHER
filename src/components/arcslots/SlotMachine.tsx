'use client';

/**
 * SlotMachine Component - Core spin trigger & transaction handler
 * Strict network validation & isolated decimal handling
 */

import { useState, useCallback } from 'react';
import { useAccount, useWriteContract, useChainId, usePublicClient } from 'wagmi';
import { parseUnits, formatUnits, decodeEventLog, erc20Abi } from 'viem';
import { ARCSLOTS_CONFIG, ARCSLOTS_TOKENS, ARCSLOTS_ADDRESS, SLOT_SYMBOLS } from '@/lib/arcslots/arcslots.constants';
import { Zap, Loader2, AlertCircle, Minus, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

interface SlotMachineProps {
  onSpinComplete?: (symbols: string[], reward: number) => void;
  disabled?: boolean;
}

export function SlotMachine({ onSpinComplete, disabled = false }: SlotMachineProps) {
  const { isConnected, address: userAddress } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [numSpins, setNumSpins] = useState(1);
  const [isSpinning, setIsSpinning] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [currentSymbols, setCurrentSymbols] = useState<string[]>(['🍒', '🍒', '🍒']);

  const ARCSLOTS_CONTRACT_ABI = [
    {
      name: 'spin',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [{ internalType: 'uint256', name: 'seed', type: 'uint256' }],
      outputs: [
        { internalType: 'uint8', name: 's1', type: 'uint8' },
        { internalType: 'uint8', name: 's2', type: 'uint8' },
        { internalType: 'uint8', name: 's3', type: 'uint8' },
        { internalType: 'bool', name: 'wonJackpot', type: 'bool' },
        { internalType: 'uint256', name: 'payout', type: 'uint256' },
        { internalType: 'uint256', name: 'cashback', type: 'uint256' },
      ],
    },
    {
      name: 'Spin',
      type: 'event',
      anonymous: false,
      inputs: [
        { indexed: true, internalType: 'address', name: 'player', type: 'address' },
        { indexed: false, internalType: 'uint8', name: 's1', type: 'uint8' },
        { indexed: false, internalType: 'uint8', name: 's2', type: 'uint8' },
        { indexed: false, internalType: 'uint8', name: 's3', type: 'uint8' },
        { indexed: false, internalType: 'uint256', name: 'payout', type: 'uint256' },
        { indexed: false, internalType: 'uint256', name: 'cashback', type: 'uint256' },
      ],
    },
  ];

  // ⚠️ CRITICAL: Network Validation (Arc Testnet ID: 5042002)
  const EXPECTED_CHAIN_ID = 5042002;
  const isCorrectNetwork = chainId === EXPECTED_CHAIN_ID;
  const isAddressConfigured = (ARCSLOTS_ADDRESS as string) !== '0x0000000000000000000000000000000000000000';

  const handleIncrement = () => setNumSpins(prev => Math.min(prev + 1, ARCSLOTS_CONFIG.MAX_SPINS_PER_TX));
  const handleDecrement = () => setNumSpins(prev => Math.max(prev - 1, 1));
  const setPreset = (val: number) => setNumSpins(val);

  const handleSpin = useCallback(async () => {
    if (!userAddress || !isConnected || !isCorrectNetwork) {
      setNetworkError('Wallet not connected or wrong network');
      return;
    }

    if (numSpins < 1 || numSpins > ARCSLOTS_CONFIG.MAX_SPINS_PER_TX) {
      toast.error(`Spins must be between 1 and ${ARCSLOTS_CONFIG.MAX_SPINS_PER_TX}`);
      return;
    }

    try {
      setIsSpinning(true);
      setNetworkError(null);

      // Start fake spin animation
      const interval = setInterval(() => {
        setCurrentSymbols([
          SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
          SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
          SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
        ]);
      }, 100);

      // Step 1: Calculate total USDC fee (6 decimals)
      const spinFeePerTx = parseUnits(ARCSLOTS_CONFIG.SPIN_FEE, ARCSLOTS_CONFIG.SPIN_FEE_USDC_DECIMALS);
      const totalFeeBN = spinFeePerTx * BigInt(numSpins);

      // Step 2: Approve USDC spending
      const approveHash = await writeContractAsync({
        address: ARCSLOTS_TOKENS.USDC_ADDRESS as `0x${string}`,
        abi: erc20Abi,
        functionName: 'approve',
        args: [ARCSLOTS_ADDRESS as `0x${string}`, totalFeeBN],
      });
      toast.loading('Approving USDC...');
      if (!publicClient) throw new Error('Network client unavailable.');
      await publicClient.waitForTransactionReceipt({ hash: approveHash, timeout: 120_000 });
      toast.success('USDC approved. Sending spin...');

      // Step 3: Call ArcSlots spin() on-chain
      const seed = BigInt(Date.now());
      const spinHash = await writeContractAsync({
        address: ARCSLOTS_ADDRESS as `0x${string}`,
        abi: ARCSLOTS_CONTRACT_ABI,
        functionName: 'spin',
        args: [seed], // Just passing 1 spin seed for now based on smart contract
      });
      toast.loading('Spin submitted to ArcSlots contract...');
      const receipt = await publicClient.waitForTransactionReceipt({ hash: spinHash, timeout: 120_000 });
      
      clearInterval(interval);

      // Step 4: Parse Spin Event from Receipt
      let onChainSymbols: string[] = ["🍒", "🍒", "🍒"];
      let payout = BigInt(0);
      let won = false;
      let cashback = BigInt(0);

      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: ARCSLOTS_CONTRACT_ABI,
            data: log.data,
            topics: log.topics,
          });
          if (decoded.eventName === 'Spin') {
            const args = decoded.args as any;
            onChainSymbols = [
              SLOT_SYMBOLS[args.s1 % SLOT_SYMBOLS.length],
              SLOT_SYMBOLS[args.s2 % SLOT_SYMBOLS.length],
              SLOT_SYMBOLS[args.s3 % SLOT_SYMBOLS.length]
            ];
            payout = args.payout;
            cashback = args.cashback;
            won = payout > BigInt(0);
          }
        } catch (e) {}
      }

      setCurrentSymbols(onChainSymbols);

      if (won) {
        const formattedPayout = formatUnits(payout, ARCSLOTS_TOKENS.USDC_DECIMALS);
        toast.success(`Jackpot! Won ${formattedPayout} USDC!`);
        onSpinComplete?.(onChainSymbols, Number(formattedPayout));
      } else {
        const formattedCashback = formatUnits(cashback, ARCSLOTS_TOKENS.USDC_DECIMALS);
        toast.success(`Better luck next time! 50% Cashback received: ${formattedCashback} USDC`, { icon: '💸' });
        onSpinComplete?.(onChainSymbols, 0);
      }
    } catch (error: any) {
      const errorMsg = error?.message || 'Unknown error occurred';
      setNetworkError(errorMsg);
      toast.error(errorMsg);
      console.error('Spin error:', error);
    } finally {
      setIsSpinning(false);
    }
  }, [numSpins, userAddress, isConnected, isCorrectNetwork, writeContractAsync, onSpinComplete]);

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="relative p-6 md:p-12 rounded-[3rem] bg-[#0d0e1c] border border-yellow-500/20 shadow-[0_0_50px_rgba(250,204,21,0.15)]">
        
        {/* Top Badge */}
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-6 py-1.5 bg-gradient-to-r from-yellow-300 to-cyan-300 rounded-full text-black font-black text-sm uppercase tracking-widest shadow-lg shadow-yellow-500/20">
          ArcSlots
        </div>

        {/* Reels */}
        <div className="flex items-center justify-center gap-4 md:gap-8 mb-10 mt-4">
          {currentSymbols.map((sym, i) => (
            <div key={i} className="w-24 h-32 md:w-40 md:h-52 bg-[#090a12] border-2 border-yellow-500/60 rounded-2xl flex items-center justify-center text-5xl md:text-8xl shadow-[inset_0_0_30px_rgba(250,204,21,0.15),0_0_30px_rgba(250,204,21,0.3)] transition-all duration-300 relative overflow-hidden">
              <div className={`transition-transform duration-100 ${isSpinning ? 'animate-bounce' : ''}`}>
                {sym}
              </div>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="max-w-md mx-auto space-y-6">
          
          {/* Minus / Input / Plus */}
          <div className="flex items-center justify-center gap-4">
            <button onClick={handleDecrement} disabled={isSpinning || disabled} className="w-12 h-12 rounded-full border border-slate-700 bg-[#0f1021] flex items-center justify-center text-slate-400 hover:text-white hover:border-slate-500 transition-colors disabled:opacity-50">
              <Minus size={20} />
            </button>
            <div className="w-32 h-12 rounded-xl border border-slate-700 bg-[#0f1021] flex items-center justify-center font-bold text-xl text-white">
              {numSpins}
            </div>
            <button onClick={handleIncrement} disabled={isSpinning || disabled} className="w-12 h-12 rounded-full border border-slate-700 bg-[#0f1021] flex items-center justify-center text-slate-400 hover:text-white hover:border-slate-500 transition-colors disabled:opacity-50">
              <Plus size={20} />
            </button>
          </div>

          {/* Multipliers */}
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {[1, 5, 10, 25, 100].map((val) => (
              <button 
                key={val}
                onClick={() => setPreset(val)}
                disabled={isSpinning || disabled}
                className={`px-5 py-1.5 rounded-full border text-xs font-bold transition-all ${numSpins === val ? 'border-yellow-400 text-yellow-400 bg-yellow-400/10' : 'border-yellow-500/30 text-yellow-500/70 hover:border-yellow-400 hover:text-yellow-400'}`}
              >
                {val}x
              </button>
            ))}
          </div>

          {/* Spin Button */}
          <button
            onClick={handleSpin}
            disabled={isSpinning || disabled || !isConnected || !isCorrectNetwork}
            className="w-full relative group overflow-hidden rounded-2xl p-[1px] disabled:opacity-50 disabled:cursor-not-allowed transition-transform active:scale-95"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-300 to-cyan-400 blur-sm group-hover:blur-md transition-all"></div>
            <div className="relative w-full bg-gradient-to-r from-yellow-200 to-cyan-300 py-5 rounded-2xl flex items-center justify-center gap-3">
              {isSpinning ? (
                <Loader2 className="w-6 h-6 animate-spin text-black" />
              ) : (
                <span className="text-black font-black text-xl tracking-wider">
                  SPIN {numSpins}x • {(parseFloat(ARCSLOTS_CONFIG.SPIN_FEE) * numSpins).toFixed(1)} USDC
                </span>
              )}
            </div>
          </button>

          {/* Error Message */}
          {networkError && (
            <div className="text-center text-red-400 text-sm font-semibold flex items-center justify-center gap-2">
              <AlertCircle size={16} /> {networkError}
            </div>
          )}

          {/* Footer Text */}
          <p className="text-[10px] text-center uppercase tracking-widest text-slate-500 font-bold mt-4">
            10% CASHBACK ON EVERY LOSING SPIN - JACKPOT WHEN POOL ≥ 1 USDC
          </p>

        </div>
      </div>
    </div>
  );
}
