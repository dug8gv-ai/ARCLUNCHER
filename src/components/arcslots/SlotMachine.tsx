'use client';

/**
 * SlotMachine Component - Core spin trigger & transaction handler
 * Strict network validation & isolated decimal handling
 */

import { useState, useCallback } from 'react';
import { useAccount, useSendTransaction, useWriteContract, useChainId } from 'wagmi';
import { parseUnits, erc20Abi } from 'viem';
import { confirmSpin } from '@/lib/arcslots/arcslots.functions';
import { ARCSLOTS_CONFIG, ARCSLOTS_TOKENS, ARCSLOTS_ADDRESS, SLOT_SYMBOLS } from '@/lib/arcslots/arcslots.constants';
import { Zap, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface SlotMachineProps {
  onSpinComplete?: (symbols: string[], reward: number) => void;
  disabled?: boolean;
}

export function SlotMachine({ onSpinComplete, disabled = false }: SlotMachineProps) {
  const { isConnected, address: userAddress } = useAccount();
  const chainId = useChainId();
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();

  const [numSpins, setNumSpins] = useState('1');
  const [isSpinning, setIsSpinning] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [lastSymbols, setLastSymbols] = useState<string[]>([]);

  // ⚠️ CRITICAL: Network Validation (Arc Testnet ID: 5042002)
  const EXPECTED_CHAIN_ID = 5042002;
  const isCorrectNetwork = chainId === EXPECTED_CHAIN_ID;

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center p-8 rounded-lg bg-slate-900 border border-slate-700">
        <p className="text-amber-400">Please connect your wallet to spin</p>
      </div>
    );
  }

  if (!isCorrectNetwork) {
    return (
      <div className="flex flex-col items-center gap-4 p-6 rounded-lg bg-red-950 border border-red-700">
        <AlertCircle className="w-6 h-6 text-red-500" />
        <div className="text-center">
          <p className="text-red-200 font-semibold">Wrong Network</p>
          <p className="text-red-400 text-sm mt-1">Please switch to Arc Testnet (Chain ID: 5042002)</p>
        </div>
      </div>
    );
  }

  /**
   * Handle single or batch spin transaction
   * Manages USDC payment (6 decimals) separately from ARC rewards (18 decimals)
   */
  const handleSpin = useCallback(async () => {
    if (!userAddress || !isConnected || !isCorrectNetwork) {
      setNetworkError('Wallet not connected or wrong network');
      return;
    }

    const spinCount = parseInt(numSpins, 10);
    if (spinCount < 1 || spinCount > ARCSLOTS_CONFIG.MAX_SPINS_PER_TX) {
      toast.error(`Spins must be between 1 and ${ARCSLOTS_CONFIG.MAX_SPINS_PER_TX}`);
      return;
    }

    try {
      setIsSpinning(true);
      setNetworkError(null);

      // Step 1: Calculate total USDC fee (6 decimals) using parseUnits
      const spinFeePerTx = parseUnits(ARCSLOTS_CONFIG.SPIN_FEE, ARCSLOTS_CONFIG.SPIN_FEE_USDC_DECIMALS);
      const totalFeeBN = spinFeePerTx * BigInt(spinCount);

      // Step 2: Approve USDC spending
      const approveTx = await writeContractAsync({
        address: ARCSLOTS_TOKENS.USDC_ADDRESS as `0x${string}`,
        abi: erc20Abi,
        functionName: 'approve',
        args: [ARCSLOTS_ADDRESS as `0x${string}`, totalFeeBN],
      });

      toast.loading('Approving USDC...');

      // Step 3: Generate spin results (random symbols)
      const symbols = Array.from({ length: 3 }, () =>
        SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)]
      );
      setLastSymbols(symbols);

      // Step 4: Record spin on-chain with ArcSlots contract
      const spinTx = await sendTransactionAsync({
        to: ARCSLOTS_ADDRESS as `0x${string}`,
        data: '0x', // Placeholder: normally encodes spin function call
        value: BigInt(0),
      });

      toast.success('Spin recorded! Processing results...');

      // Step 5: Confirm spin in database
      const result = await confirmSpin(
        userAddress,
        spinCount,
        spinTx,
        symbols
      );

      toast.success(`Won ${result.arc_reward} ARC! Multiplier: ${result.multiplier}x`);
      onSpinComplete?.(symbols, result.arc_reward);
    } catch (error: any) {
      const errorMsg = error?.message || 'Unknown error occurred';
      setNetworkError(errorMsg);
      toast.error(errorMsg);
      console.error('Spin error:', error);
    } finally {
      setIsSpinning(false);
    }
  }, [numSpins, userAddress, isConnected, isCorrectNetwork, sendTransactionAsync, writeContractAsync, onSpinComplete]);

  return (
    <div className="w-full max-w-md mx-auto p-6 rounded-xl bg-gradient-to-b from-slate-800 via-slate-900 to-black border border-cyan-500/20 shadow-2xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
            ArcSlots
          </h2>
          <p className="text-slate-400 text-sm mt-2">Spin for ARC rewards</p>
        </div>

        {/* Last Results */}
        {lastSymbols.length > 0 && (
          <div className="flex justify-center gap-2 p-4 bg-slate-800 rounded-lg border border-green-500/30">
            {lastSymbols.map((sym, i) => (
              <div key={i} className="text-4xl animate-bounce" style={{ animationDelay: `${i * 0.1}s` }}>
                {sym}
              </div>
            ))}
          </div>
        )}

        {/* Spin Count Input */}
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-slate-300">
            Number of Spins
          </label>
          <input
            type="number"
            min="1"
            max={ARCSLOTS_CONFIG.MAX_SPINS_PER_TX}
            value={numSpins}
            onChange={(e) => setNumSpins(e.target.value)}
            disabled={isSpinning || disabled}
            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
          />
          <p className="text-xs text-slate-400">
            Fee: {(parseFloat(ARCSLOTS_CONFIG.SPIN_FEE) * parseInt(numSpins || '1', 10)).toFixed(2)} USDC
          </p>
        </div>

        {/* Error Display */}
        {networkError && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-950 border border-red-700/50">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-xs text-red-300">{networkError}</p>
          </div>
        )}

        {/* Spin Button */}
        <button
          onClick={handleSpin}
          disabled={isSpinning || disabled || !isConnected || !isCorrectNetwork}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 font-semibold text-white rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-cyan-500/30"
        >
          {isSpinning ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Spinning...
            </>
          ) : (
            <>
              <Zap className="w-5 h-5" />
              Spin Now
            </>
          )}
        </button>

        {/* Info Footer */}
        <div className="text-xs text-slate-500 text-center border-t border-slate-700 pt-4">
          <p>✓ Arc Testnet Ready | {userAddress?.slice(0, 6)}...{userAddress?.slice(-4)}</p>
        </div>
      </div>
    </div>
  );
}
