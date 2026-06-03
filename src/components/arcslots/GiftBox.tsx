'use client';

/**
 * GiftBox Component - Claim modal for pending cashback & jackpots
 * Self-contained transactional state, no page refresh required
 */

import { useState, useCallback } from 'react';
import { useAccount, useSendTransaction } from 'wagmi';
import { parseEther } from 'viem';
import { getPendingPayouts, claimJackpot } from '@/lib/arcslots/arcslots.functions';
import { ARCSLOTS_CONFIG, ARCSLOTS_TREASURY_ADDRESS } from '@/lib/arcslots/arcslots.constants';
import { Gift, Loader2, CheckCircle2, AlertCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface GiftBoxProps {
  isOpen: boolean;
  onClose: () => void;
  onClaimSuccess?: () => void;
}

interface PendingPayout {
  payout_id: string;
  amount_arc: number;
  claimed: boolean;
  created_at: string;
}

export function GiftBox({ isOpen, onClose, onClaimSuccess }: GiftBoxProps) {
  const { address: userAddress } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();

  const [pendingPayouts, setPendingPayouts] = useState<PendingPayout[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimedPayouts, setClaimedPayouts] = useState<Set<string>>(new Set());

  // Load pending payouts when modal opens
  const loadPayouts = useCallback(async () => {
    if (!userAddress || !isOpen) return;

    try {
      setIsLoading(true);
      const payouts = await getPendingPayouts(userAddress);
      setPendingPayouts(payouts as PendingPayout[]);
    } catch (error: any) {
      toast.error('Failed to load pending payouts');
      console.error('Load payouts error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userAddress, isOpen]);

  // Auto-load on open
  useState(() => {
    if (isOpen) loadPayouts();
  });

  /**
   * Claim a single payout via blockchain transaction
   */
  const handleClaimPayout = useCallback(
    async (payoutId: string, amount: number) => {
      if (!userAddress) {
        toast.error('Wallet not connected');
        return;
      }

      try {
        if (!ARCSLOTS_TREASURY_ADDRESS || ARCSLOTS_TREASURY_ADDRESS === '0x0000000000000000000000000000000000000000') {
          throw new Error('Treasury address is not configured for claim fee payment.');
        }

        setClaimingId(payoutId);

        // Send native ARC claim fee to the treasury address
        const claimTx = await sendTransactionAsync({
          to: ARCSLOTS_TREASURY_ADDRESS as `0x${string}`,
          value: parseEther(ARCSLOTS_CONFIG.CLAIM_FEE),
        });

        toast.loading('Recording claim on-chain...');

        // Confirm in database
        const result = await claimJackpot(userAddress, payoutId, claimTx);

        toast.success(`Claimed ${result.net_amount.toFixed(2)} ARC (net)`);
        setClaimedPayouts((prev) => new Set([...prev, payoutId]));
        onClaimSuccess?.();

        // Refresh payouts list
        setTimeout(() => loadPayouts(), 1000);
      } catch (error: any) {
        toast.error(error?.message || 'Failed to claim payout');
        console.error('Claim error:', error);
      } finally {
        setClaimingId(null);
      }
    },
    [userAddress, sendTransactionAsync, onClaimSuccess, loadPayouts]
  );

  const totalPending = pendingPayouts.reduce((sum, p) => sum + p.amount_arc, 0);
  const remainingPayouts = pendingPayouts.filter((p) => !claimedPayouts.has(p.payout_id));

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="w-full max-w-md rounded-xl bg-gradient-to-b from-slate-800 via-slate-900 to-black border border-cyan-500/20 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-[var(--border-dim)]">
            <div className="flex items-center gap-3">
              <Gift className="w-6 h-6 text-yellow-400" />
              <div>
                <h2 className="text-xl font-bold text-white">Pending Rewards</h2>
                <p className="text-xs text-[var(--text-secondary)] mt-1">Claim your ARC tokens</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-slate-700 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-[var(--text-secondary)]" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4 max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
              </div>
            ) : remainingPayouts.length === 0 && pendingPayouts.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-[var(--text-secondary)]">No pending payouts yet</p>
                <p className="text-xs text-[var(--text-secondary)] mt-2">Keep spinning to earn rewards!</p>
              </div>
            ) : remainingPayouts.length === 0 ? (
              <div className="flex items-center gap-3 p-4 rounded-lg bg-green-950 border border-green-700">
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                <p className="text-sm text-green-300">All payouts claimed! 🎉</p>
              </div>
            ) : (
              remainingPayouts.map((payout) => (
                <div
                  key={payout.payout_id}
                  className="p-4 rounded-lg bg-slate-700/50 border border-[var(--border-dim)] hover:border-cyan-500/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-semibold text-white">
                        {payout.amount_arc.toFixed(2)} ARC
                      </p>
                      <p className="text-xs text-[var(--text-secondary)] mt-1">
                        {new Date(payout.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {claimedPayouts.has(payout.payout_id) && (
                      <CheckCircle2 className="w-5 h-5 text-green-400" />
                    )}
                  </div>

                  {!claimedPayouts.has(payout.payout_id) && (
                    <button
                      onClick={() => handleClaimPayout(payout.payout_id, payout.amount_arc)}
                      disabled={claimingId === payout.payout_id}
                      className="w-full px-3 py-2 text-sm font-semibold text-white rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {claimingId === payout.payout_id ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Claiming...
                        </span>
                      ) : (
                        'Claim Now'
                      )}
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer Summary */}
          {pendingPayouts.length > 0 && (
            <div className="p-6 border-t border-[var(--border-dim)] bg-slate-800/50">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-[var(--text-secondary)] uppercase font-semibold tracking-wider">Total Pending</p>
                  <p className="text-2xl font-bold text-cyan-300 mt-1">
                    {totalPending.toFixed(2)}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">ARC</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text-secondary)] uppercase font-semibold tracking-wider">Remaining</p>
                  <p className="text-2xl font-bold text-white mt-1">
                    {remainingPayouts.length}
                  </p>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">Claims</p>
                </div>
              </div>
            </div>
          )}

          {/* Close Button */}
          <div className="p-4 border-t border-[var(--border-dim)]">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 text-sm font-semibold text-slate-300 rounded-lg border border-[var(--border-dim)] hover:border-[var(--border-dim)] hover:text-white transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
