'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Activity, ArrowDown, ArrowUp, BadgeDollarSign, CheckCircle2, Coins, Loader2, ShieldCheck, Sparkles, Wallet } from 'lucide-react';
import { useAccount, usePublicClient, useSignMessage, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { erc20Abi, formatUnits, parseUnits, isAddress } from 'viem';
import { CIRBTC_ADDRESS, EURC_ADDRESS, USDC_ADDRESS, ARC_DEFI_ROUTER_ADDRESS, arcDefiRouterAbi } from '@/lib/arcDefiAbi';

type AssetKey = 'USDC' | 'EURC' | 'cirBTC';

type Position = {
  amount: number;
  lastRewardBlock: number;
  claimedYield: number;
  startedAt: number;
};

type Positions = Record<AssetKey, Position | null>;

type StatusState = {
  type: 'success' | 'error' | 'info';
  message: string;
} | null;

const STORAGE_PREFIX = 'arc-yield-positions';
const BLOCK_TIME_SECONDS = 2;
const BLOCKS_PER_YEAR = (365 * 24 * 60 * 60) / BLOCK_TIME_SECONDS;

const ASSET_META: Record<AssetKey, { symbol: string; decimals: number; apy: number; color: string }> = {
  USDC: { symbol: 'USDC', decimals: 6, apy: 7.8, color: 'emerald' },
  EURC: { symbol: 'EURC', decimals: 6, apy: 6.4, color: 'violet' },
  cirBTC: { symbol: 'cirBTC', decimals: 8, apy: 9.1, color: 'amber' },
};

const ASSET_ADDRESSES: Record<AssetKey, `0x${string}`> = {
  USDC: USDC_ADDRESS as `0x${string}`,
  EURC: EURC_ADDRESS as `0x${string}`,
  cirBTC: CIRBTC_ADDRESS as `0x${string}`,
};

const EMPTY_POSITIONS: Positions = {
  USDC: null,
  EURC: null,
  cirBTC: null,
};

const formatAmount = (value: number, decimals: number) => {
  const maxFraction = decimals === 8 ? 8 : 2;
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFraction,
  });
};

const formatYield = (value: number) => {
  if (value < 0.0001) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 8 });
  }

  return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
};

const calculateReward = (position: Position, currentBlock: number, apy: number) => {
  const blocksElapsed = Math.max(0, currentBlock - position.lastRewardBlock);
  if (blocksElapsed <= 0) {
    return position.claimedYield;
  }

  const perBlockYield = (position.amount * (apy / 100)) / BLOCKS_PER_YEAR;
  return position.claimedYield + perBlockYield * blocksElapsed;
};

export default function ArcYield() {
  const { isConnected, address: userAddress } = useAccount();
  const publicClient = usePublicClient();
  const { signMessageAsync } = useSignMessage();
  const { writeContract, isPending: isWritePending } = useWriteContract();

  const [balances, setBalances] = useState<Record<AssetKey, number>>({
    USDC: 0,
    EURC: 0,
    cirBTC: 0,
  });
  const [positions, setPositions] = useState<Positions>(EMPTY_POSITIONS);
  const [selectedAsset, setSelectedAsset] = useState<AssetKey>('USDC');
  const [amountInput, setAmountInput] = useState('');
  const [currentBlock, setCurrentBlock] = useState<number>(0);
  const [approvalTxHash, setApprovalTxHash] = useState<string | null>(null);
  const { data: approvalReceipt } = useWaitForTransactionReceipt({
    hash: approvalTxHash ? (approvalTxHash as `0x${string}`) : undefined,
  });

  const loadPositions = () => {
    if (!userAddress) {
      setPositions(EMPTY_POSITIONS);
      return;
    }

    const walletKey = userAddress.toLowerCase();
    const storageKey = `${STORAGE_PREFIX}-${walletKey}`;
    const stored = localStorage.getItem(storageKey);

    if (!stored) {
      setPositions(EMPTY_POSITIONS);
      return;
    }

    try {
      const parsed = JSON.parse(stored) as Partial<Positions>;
      setPositions({
        USDC: parsed.USDC ?? null,
        EURC: parsed.EURC ?? null,
        cirBTC: parsed.cirBTC ?? null,
      });
    } catch {
      setPositions(EMPTY_POSITIONS);
    }
  };

  // Fetch on-chain lock state from ArcDefiRouter for a specific token
  const fetchOnChainLock = async (asset: AssetKey, tokenAddress: `0x${string}`) => {
    if (!publicClient || !userAddress || !isAddress(tokenAddress)) {
      return null;
    }

    try {
      const lockData = await publicClient.readContract({
        address: ARC_DEFI_ROUTER_ADDRESS as `0x${string}`,
        abi: arcDefiRouterAbi,
        functionName: 'userLocks',
        args: [userAddress, tokenAddress],
      });

      if (!lockData || lockData[0] === BigInt(0)) {
        return null;
      }

      // lockData is [amount, unlockTime]
      return {
        amount: Number(formatUnits(lockData[0] as bigint, ASSET_META[asset].decimals)),
        unlockTime: Number(lockData[1] as bigint),
      };
    } catch (error) {
      console.error('Error fetching on-chain lock', error);
      return null;
    }
  };

  const savePositions = (nextPositions: Positions) => {
    if (!userAddress) return;
    const walletKey = userAddress.toLowerCase();
    const storageKey = `${STORAGE_PREFIX}-${walletKey}`;
    localStorage.setItem(storageKey, JSON.stringify(nextPositions));
    setPositions(nextPositions);
  };

  const fetchBalances = async () => {
    if (!publicClient || !userAddress) {
      setBalances({ USDC: 0, EURC: 0, cirBTC: 0 });
      return;
    }

    try {
      const [usdcRaw, eurcRaw, cirbtcRaw] = await Promise.all([
        publicClient.readContract({
          address: ASSET_ADDRESSES.USDC,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [userAddress],
        }),
        publicClient.readContract({
          address: ASSET_ADDRESSES.EURC,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [userAddress],
        }),
        publicClient.readContract({
          address: ASSET_ADDRESSES.cirBTC,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [userAddress],
        }),
      ]);

      setBalances({
        USDC: Number(formatUnits(usdcRaw as bigint, 6)),
        EURC: Number(formatUnits(eurcRaw as bigint, 6)),
        cirBTC: Number(formatUnits(cirbtcRaw as bigint, 8)),
      });
    } catch (error) {
      console.error('Error fetching Arc Yield balances', error);
      setBalances({ USDC: 0, EURC: 0, cirBTC: 0 });
    }
  };

  const fetchCurrentBlock = async () => {
    if (!publicClient) return;
    try {
      const blockNumber = await publicClient.getBlockNumber();
      setCurrentBlock(Number(blockNumber));
    } catch (error) {
      console.error('Error fetching Arc Chain block height', error);
    }
  };

  useEffect(() => {
    loadPositions();
  }, [userAddress]);

  useEffect(() => {
    fetchBalances();
    fetchCurrentBlock();

    const balanceInterval = window.setInterval(() => {
      fetchBalances();
      fetchCurrentBlock();
    }, 15000);

    return () => window.clearInterval(balanceInterval);
  }, [publicClient, userAddress, isConnected]);

  const totalAccruedYield = useMemo(() => {
    return (Object.keys(positions) as AssetKey[]).reduce((total, asset) => {
      const position = positions[asset];
      if (!position) return total;
      return total + calculateReward(position, currentBlock || 0, ASSET_META[asset].apy);
    }, 0);
  }, [positions, currentBlock]);

  const selectedPosition = positions[selectedAsset];
  const selectedAccruedYield = selectedPosition
    ? calculateReward(selectedPosition, currentBlock || 0, selectedMeta.apy)
    : 0;

  const signAction = async (message: string) => {
    if (!signMessageAsync) {
      throw new Error('Wallet signing unavailable.');
    }

    return signMessageAsync({ message });
  };

  const handleStake = async () => {
    if (!isConnected || !userAddress) {
      setStatus({ type: 'error', message: 'Connect your wallet to stake on Arc Chain Testnet.' });
      return;
    }

    const amount = Number(amountInput);
    if (!amountInput || Number.isNaN(amount) || amount <= 0) {
      setStatus({ type: 'error', message: 'Enter a valid amount to stake.' });
      return;
    }

    if (amount > balances[selectedAsset]) {
      setStatus({
        type: 'error',
        message: `Insufficient ${selectedMeta.symbol} balance. Available: ${formatAmount(balances[selectedAsset], selectedMeta.decimals)} ${selectedMeta.symbol}`,
      });
      return;
    }

    try {
      setIsPending(true);
      const tokenAddress = ASSET_ADDRESSES[selectedAsset];
      const amountInWei = parseUnits(amount.toFixed(selectedMeta.decimals), selectedMeta.decimals);
      const lockDurationSeconds = 30 * 24 * 60 * 60; // 30 days

      setStatus({
        type: 'info',
        message: `Approving ${selectedMeta.symbol} spend on Arc Chain Testnet...`,
      });

      // 1. Approve token spend and wait for confirmation
      const approveTx = await new Promise<string>((resolve, reject) => {
        writeContract(
          {
            address: tokenAddress,
            abi: erc20Abi,
            functionName: 'approve',
            args: [ARC_DEFI_ROUTER_ADDRESS as `0x${string}`, amountInWei],
          },
          {
            onSuccess: (hash) => resolve(hash),
            onError: (error: any) => reject(error),
          }
        );
      });

      // Wait for approval to be confirmed
      await publicClient?.waitForTransactionReceipt({ hash: approveTx as `0x${string}` });

      setStatus({
        type: 'info',
        message: `Locking ${amount.toFixed(4)} ${selectedMeta.symbol} on Arc Chain Testnet for 30 days...`,
      });

      // 2. Call lock() after approval is confirmed
      const lockTx = await new Promise<string>((resolve, reject) => {
        writeContract(
          {
            address: ARC_DEFI_ROUTER_ADDRESS as `0x${string}`,
            abi: arcDefiRouterAbi,
            functionName: 'lock',
            args: [tokenAddress, amountInWei, BigInt(lockDurationSeconds)],
          },
          {
            onSuccess: (hash) => resolve(hash),
            onError: (error: any) => reject(error),
          }
        );
      });

      // Wait for lock to be confirmed
      await publicClient?.waitForTransactionReceipt({ hash: lockTx as `0x${string}` });

      setAmountInput('');
      setStatus({
        type: 'success',
        message: `✓ Locked ${amount.toFixed(4)} ${selectedMeta.symbol} for 30 days on Arc Chain Testnet.`,
      });

      // Refresh balances and positions
      setTimeout(() => {
        fetchBalances();
        fetchCurrentBlock();
        loadPositions();
      }, 2000);

      window.dispatchEvent(new Event('arc-balance-update'));
    } catch (error: any) {
      console.error('Stake error', error);
      setStatus({
        type: 'error',
        message: error?.shortMessage || error?.message || 'Unable to complete stake. Check wallet and Arc Chain Testnet connectivity.',
      });
    } finally {
      setIsPending(false);
      setApprovalTxHash(null);
    }
  };

  const handleUnstake = async () => {
    if (!selectedPosition) {
      setStatus({ type: 'error', message: `No ${selectedMeta.symbol} stake is active right now.` });
      return;
    }

    const amount = Number(amountInput);
    if (!amountInput || Number.isNaN(amount) || amount <= 0) {
      setStatus({ type: 'error', message: 'Enter a valid amount to unstake.' });
      return;
    }

    if (amount > selectedPosition.amount) {
      setStatus({
        type: 'error',
        message: `You can only unstake up to ${formatAmount(selectedPosition.amount, selectedMeta.decimals)} ${selectedMeta.symbol}`,
      });
      return;
    }

    try {
      setIsPending(true);
      const tokenAddress = ASSET_ADDRESSES[selectedAsset];

      // Call unlock() on ArcDefiRouter (unlocks all tokens for this asset)
      writeContract({
        address: ARC_DEFI_ROUTER_ADDRESS as `0x${string}`,
        abi: arcDefiRouterAbi,
        functionName: 'unlock',
        args: [tokenAddress],
      },
      {
        onSuccess: () => {
          setAmountInput('');
          setStatus({
            type: 'success',
            message: `Unlocked and withdrawn ${formatAmount(selectedPosition.amount, selectedMeta.decimals)} ${selectedMeta.symbol} from Arc Chain.`,
          });
          // Refresh balances and positions
          setTimeout(() => {
            fetchBalances();
            fetchCurrentBlock();
            loadPositions();
          }, 2000);
          window.dispatchEvent(new Event('arc-balance-update'));
        },
        onError: (error: any) => {
          console.error('Unlock error', error);
          setStatus({
            type: 'error',
            message: error?.shortMessage || error?.message || 'Failed to unlock tokens. Lock period may not be complete.',
          });
        },
      });
    } catch (error: any) {
      console.error('Unstake setup error', error);
      setStatus({
        type: 'error',
        message: error?.shortMessage || error?.message || 'Unable to initiate unstake.',
      });
    } finally {
      setIsPending(false);
    }
  };

  const handleClaim = async () => {
    if (!selectedPosition) {
      setStatus({ type: 'error', message: `You do not currently have an active ${selectedMeta.symbol} stake.` });
      return;
    }

    const claimable = selectedAccruedYield - selectedPosition.claimedYield;
    if (claimable <= 0) {
      setStatus({ type: 'error', message: `No new ${selectedMeta.symbol} rewards are available yet.` });
      return;
    }

    try {
      setIsPending(true);
      const nextPositions = { ...positions };

      nextPositions[selectedAsset] = {
        ...selectedPosition,
        claimedYield: selectedAccruedYield,
        lastRewardBlock: currentBlock || 0,
      };

      savePositions(nextPositions);
      setStatus({
        type: 'success',
        message: `Recorded ${formatYield(claimable)} ${selectedMeta.symbol} of accrued yield. Note: Real yield payouts require contract updates.`,
      });
    } catch (error: any) {
      console.error('Claim error', error);
      setStatus({
        type: 'error',
        message: error?.shortMessage || error?.message || 'Unable to process claim.',
      });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200/80 rounded-[32px] p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase font-extrabold tracking-[0.3em] text-amber-600">Arc Chain Testnet</p>
            <h2 className="text-xl font-black text-slate-900 mt-1">Yield & Staking Sanctuary</h2>
            <p className="text-xs text-slate-500 max-w-2xl mt-2 leading-relaxed">
              A human-made, wallet-signed yield layer for USDC, EURC, and cirBTC. Balances are read live from Arc Chain and the yield math is refreshed against the current block height.
            </p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-right">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-black">Total Accrued Yield</p>
            <p className="text-xl font-black text-slate-900 mt-2">{formatYield(totalAccruedYield)}</p>
            <p className="text-[10px] text-slate-500 mt-1">Current block: {currentBlock || 'syncing'}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        <div className="xl:col-span-5 space-y-6">
          <div className="bg-white border border-slate-200/80 rounded-[32px] p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] font-extrabold text-slate-500">Stake Panel</p>
                <h3 className="text-lg font-black text-slate-900 mt-2">Choose an asset, sign your intent, and track your yield.</h3>
              </div>
              <div className="rounded-full bg-amber-50 border border-amber-100 px-3 py-1 text-[10px] font-black text-amber-700 flex items-center gap-2">
                <Sparkles size={12} />
                Hand-tuned
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(ASSET_META) as AssetKey[]).map((asset) => {
                const meta = ASSET_META[asset];
                const selected = selectedAsset === asset;
                return (
                  <button
                    key={asset}
                    type="button"
                    onClick={() => setSelectedAsset(asset)}
                    className={`rounded-2xl border px-3 py-4 text-left transition-all ${
                      selected
                        ? 'border-amber-200 bg-amber-50 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="text-[10px] uppercase font-black tracking-[0.2em] text-slate-500">{meta.symbol}</div>
                    <div className="text-sm font-black text-slate-900 mt-2">{formatAmount(balances[asset], meta.decimals)} available</div>
                    <div className="text-[10px] text-slate-500 mt-1">{meta.apy}% live yield</div>
                  </button>
                );
              })}
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-[24px] p-4 space-y-3">
              <div className="flex justify-between items-center text-[10px] uppercase tracking-[0.2em] font-black text-slate-500">
                <span>Amount</span>
                <button
                  type="button"
                  onClick={() =>
                    setAmountInput(
                      balances[selectedAsset].toFixed(selectedMeta.decimals === 8 ? 8 : 2)
                    )
                  }
                  className="text-amber-700 hover:text-amber-800"
                >
                  Use max
                </button>
              </div>
              <div className="flex items-center justify-between gap-4">
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  className="w-full bg-transparent text-2xl font-black text-slate-900 outline-none"
                  placeholder="0.00"
                />
                <span className="text-sm font-bold text-slate-500">{selectedMeta.symbol}</span>
              </div>
              <p className="text-[10px] text-slate-500">
                Available wallet balance: {formatAmount(balances[selectedAsset], selectedMeta.decimals)} {selectedMeta.symbol}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={handleStake}
                disabled={isPending}
                className="rounded-2xl bg-emerald-600 text-white font-black px-4 py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isPending ? <Loader2 className="animate-spin" size={15} /> : <ArrowDown size={15} />}
                Stake
              </button>
              <button
                type="button"
                onClick={handleUnstake}
                disabled={isPending}
                className="rounded-2xl bg-slate-900 text-white font-black px-4 py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isPending ? <Loader2 className="animate-spin" size={15} /> : <ArrowUp size={15} />}
                Unstake
              </button>
              <button
                type="button"
                onClick={handleClaim}
                disabled={isPending}
                className="rounded-2xl bg-amber-500 text-slate-950 font-black px-4 py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isPending ? <Loader2 className="animate-spin" size={15} /> : <BadgeDollarSign size={15} />}
                Claim
              </button>
            </div>

            <AnimatePresence>
              {status && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className={`rounded-2xl border px-4 py-3 text-sm font-bold ${
                    status.type === 'success'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : status.type === 'error'
                        ? 'border-rose-200 bg-rose-50 text-rose-700'
                        : 'border-slate-200 bg-slate-50 text-slate-700'
                  }`}
                >
                  {status.message}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="xl:col-span-7 space-y-6">
          <div className="bg-slate-900 text-white rounded-[32px] p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-slate-300">Live Yield Console</p>
                <h3 className="text-lg font-black mt-2">Arc Chain rewards are clocked against the current testnet block height.</h3>
              </div>
              <div className="flex items-center gap-2 text-sm font-bold text-emerald-300">
                <Activity size={15} />
                sync live
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              {(Object.keys(ASSET_META) as AssetKey[]).map((asset) => {
                const meta = ASSET_META[asset];
                const position = positions[asset];
                const accrued = position ? calculateReward(position, currentBlock || 0, meta.apy) : 0;
                const claimable = position ? accrued - (position.claimedYield || 0) : 0;

                return (
                  <div key={asset} className="rounded-[24px] border border-slate-800 bg-slate-950/60 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">{meta.symbol}</p>
                        <p className="text-xl font-black mt-2">{position ? formatAmount(position.amount, meta.decimals) : '0.00'}</p>
                      </div>
                      <span className="rounded-full border border-slate-700 px-2 py-1 text-[10px] font-black text-slate-200">{meta.apy}%</span>
                    </div>

                    <div className="mt-4 space-y-1 text-[11px] text-slate-300">
                      <div className="flex justify-between">
                        <span>Accrued Yield</span>
                        <span className="font-black text-emerald-300">{formatYield(accrued)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Claimable Right Now</span>
                        <span className="font-black text-amber-300">{formatYield(claimable)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Wallet Balance</span>
                        <span className="font-black">{formatAmount(balances[asset], meta.decimals)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-[32px] p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] font-extrabold text-slate-500">Current Focus</p>
                <h3 className="text-lg font-black text-slate-900 mt-2">{selectedMeta.symbol} • {selectedPosition ? 'active stake' : 'ready to stake'}</h3>
              </div>
              <div className="rounded-full bg-slate-50 border border-slate-200 px-3 py-1 text-[10px] font-black text-slate-700 flex items-center gap-2">
                <ShieldCheck size={12} />
                Signed wallet flow
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-[24px] bg-slate-50 p-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Wallet</p>
                <p className="text-lg font-black text-slate-900 mt-2">{formatAmount(balances[selectedAsset], selectedMeta.decimals)} {selectedMeta.symbol}</p>
              </div>
              <div className="rounded-[24px] bg-slate-50 p-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Staked</p>
                <p className="text-lg font-black text-slate-900 mt-2">{selectedPosition ? formatAmount(selectedPosition.amount, selectedMeta.decimals) : '0.00'} {selectedMeta.symbol}</p>
              </div>
              <div className="rounded-[24px] bg-slate-50 p-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Accrued</p>
                <p className="text-lg font-black text-emerald-600 mt-2">{formatYield(selectedAccruedYield)} {selectedMeta.symbol}</p>
              </div>
            </div>

            <div className="mt-4 rounded-[24px] border border-dashed border-slate-300 p-4 text-sm text-slate-600 leading-relaxed">
              <div className="flex items-center gap-2 font-black text-slate-800">
                <Wallet size={14} />
                Safe wallet interaction
              </div>
              <p className="mt-2">
                All stake, unstake, and claim actions are signed through the connected wallet on Arc Chain Testnet. The yield ledger is kept local to your wallet so the swap flow stays untouched.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
