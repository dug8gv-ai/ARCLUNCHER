'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Activity, ArrowDown, ArrowUp, BadgeDollarSign, Clock, Loader2, ShieldCheck, Sparkles, Wallet } from 'lucide-react';
import { useAccount, usePublicClient, useWriteContract } from 'wagmi';
import { erc20Abi, formatUnits, parseUnits, isAddress } from 'viem';
import { CIRBTC_ADDRESS, EURC_ADDRESS, USDC_ADDRESS, ARC_DEFI_ROUTER_ADDRESS, arcDefiRouterAbi } from '@/lib/arcDefiAbi';

type AssetKey = 'USDC' | 'EURC' | 'cirBTC';

type OnChainPosition = {
  amount: number;       // tokens locked on-chain
  unlockTime: number;   // unix timestamp when unlock is allowed
  stakedAt: number;     // block number when staked (for yield calc)
};

type StatusState = { type: 'success' | 'error' | 'info'; message: string } | null;

const BLOCK_TIME_SECONDS = 2;
const BLOCKS_PER_YEAR = (365 * 24 * 60 * 60) / BLOCK_TIME_SECONDS;
const LOCK_DURATION_SECONDS = 7 * 24 * 60 * 60; // 1 week

const ASSET_META: Record<AssetKey, { symbol: string; decimals: number; apy: number }> = {
  USDC:   { symbol: 'USDC',   decimals: 6, apy: 7.8 },
  EURC:   { symbol: 'EURC',   decimals: 6, apy: 6.4 },
  cirBTC: { symbol: 'cirBTC', decimals: 8, apy: 9.1 },
};

const ASSET_ADDRESSES: Record<AssetKey, `0x${string}`> = {
  USDC:   USDC_ADDRESS   as `0x${string}`,
  EURC:   EURC_ADDRESS   as `0x${string}`,
  cirBTC: CIRBTC_ADDRESS as `0x${string}`,
};

const EMPTY_POSITIONS: Record<AssetKey, OnChainPosition | null> = {
  USDC: null, EURC: null, cirBTC: null,
};

const fmt = (value: number, decimals: number) =>
  value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: decimals === 8 ? 8 : 2 });

const fmtYield = (value: number) =>
  value < 0.0001
    ? value.toLocaleString(undefined, { maximumFractionDigits: 8 })
    : value.toLocaleString(undefined, { maximumFractionDigits: 4 });

// Yield accrued since staking started (block-based)
const calcYield = (pos: OnChainPosition, currentBlock: number, apy: number) => {
  const blocksElapsed = Math.max(0, currentBlock - pos.stakedAt);
  const perBlock = (pos.amount * (apy / 100)) / BLOCKS_PER_YEAR;
  return perBlock * blocksElapsed;
};

// Time remaining until unlock
const timeUntilUnlock = (unlockTime: number): string => {
  const now = Math.floor(Date.now() / 1000);
  const diff = unlockTime - now;
  if (diff <= 0) return 'Unlockable now';
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  if (d > 0) return `${d}d ${h}h remaining`;
  if (h > 0) return `${h}h ${m}m remaining`;
  return `${m}m remaining`;
};

export default function ArcYield() {
  const { isConnected, address: userAddress } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [balances,     setBalances]     = useState<Record<AssetKey, number>>({ USDC: 0, EURC: 0, cirBTC: 0 });
  const [positions,    setPositions]    = useState<Record<AssetKey, OnChainPosition | null>>(EMPTY_POSITIONS);
  const [selectedAsset, setSelectedAsset] = useState<AssetKey>('USDC');
  const [amountInput,  setAmountInput]  = useState('');
  const [currentBlock, setCurrentBlock] = useState<number>(0);
  const [isPending,    setIsPending]    = useState(false);
  const [status,       setStatus]       = useState<StatusState>(null);

  const selectedMeta     = ASSET_META[selectedAsset];
  const selectedPosition = positions[selectedAsset];

  // ── ON-CHAIN DATA FETCH ──────────────────────────────────────────────────

  // Read real lock state from ArcDefiRouter for all 3 assets
  const fetchPositions = async () => {
    if (!publicClient || !userAddress) { setPositions(EMPTY_POSITIONS); return; }
    const next: Record<AssetKey, OnChainPosition | null> = { USDC: null, EURC: null, cirBTC: null };
    for (const asset of Object.keys(ASSET_META) as AssetKey[]) {
      const tokenAddr = ASSET_ADDRESSES[asset];
      if (!isAddress(tokenAddr)) continue;
      try {
        const lockData = await publicClient.readContract({
          address: ARC_DEFI_ROUTER_ADDRESS as `0x${string}`,
          abi: arcDefiRouterAbi,
          functionName: 'userLocks',
          args: [userAddress, tokenAddr],
        }) as [bigint, bigint];

        const amount = Number(formatUnits(lockData[0], ASSET_META[asset].decimals));
        const unlockTime = Number(lockData[1]);

        if (amount > 0) {
          // stakedAt: we store in localStorage only the block number when staked
          // so yield can be calculated. This is the only localStorage usage — not for amounts.
          const stakeKey = `arc_stake_block_${userAddress.toLowerCase()}_${asset}`;
          const storedBlock = Number(localStorage.getItem(stakeKey) || currentBlock || 0);
          next[asset] = { amount, unlockTime, stakedAt: storedBlock };
        }
      } catch (e) { console.error('fetchPositions error', asset, e); }
    }
    setPositions(next);
  };

  const fetchBalances = async () => {
    if (!publicClient || !userAddress) { setBalances({ USDC: 0, EURC: 0, cirBTC: 0 }); return; }
    try {
      const [u, e, c] = await Promise.all([
        publicClient.readContract({ address: ASSET_ADDRESSES.USDC,   abi: erc20Abi, functionName: 'balanceOf', args: [userAddress] }),
        publicClient.readContract({ address: ASSET_ADDRESSES.EURC,   abi: erc20Abi, functionName: 'balanceOf', args: [userAddress] }),
        publicClient.readContract({ address: ASSET_ADDRESSES.cirBTC, abi: erc20Abi, functionName: 'balanceOf', args: [userAddress] }),
      ]);
      setBalances({
        USDC:   Number(formatUnits(u as bigint, 6)),
        EURC:   Number(formatUnits(e as bigint, 6)),
        cirBTC: Number(formatUnits(c as bigint, 8)),
      });
    } catch (e) { console.error('fetchBalances error', e); }
  };

  const fetchBlock = async () => {
    if (!publicClient) return;
    try { setCurrentBlock(Number(await publicClient.getBlockNumber())); } catch (e) { console.error(e); }
  };

  const refreshAll = async () => {
    await Promise.all([fetchBalances(), fetchBlock()]);
    await fetchPositions();
  };

  useEffect(() => { refreshAll(); }, [userAddress, isConnected]);

  useEffect(() => {
    const id = window.setInterval(refreshAll, 15000);
    return () => window.clearInterval(id);
  }, [publicClient, userAddress]);

  // Total yield across all active positions
  const totalAccruedYield = useMemo(() => {
    return (Object.keys(positions) as AssetKey[]).reduce((sum, asset) => {
      const pos = positions[asset];
      return pos ? sum + calcYield(pos, currentBlock, ASSET_META[asset].apy) : sum;
    }, 0);
  }, [positions, currentBlock]);

  const selectedYield = selectedPosition ? calcYield(selectedPosition, currentBlock, selectedMeta.apy) : 0;

  // ── HANDLERS ────────────────────────────────────────────────────────────

  const handleStake = async () => {
    if (!isConnected || !userAddress || !publicClient) {
      setStatus({ type: 'error', message: 'Connect your wallet first.' }); return;
    }
    const amount = Number(amountInput);
    if (!amount || amount <= 0) { setStatus({ type: 'error', message: 'Enter a valid amount.' }); return; }
    if (amount > balances[selectedAsset]) {
      setStatus({ type: 'error', message: `Insufficient ${selectedMeta.symbol}. Available: ${fmt(balances[selectedAsset], selectedMeta.decimals)}` }); return;
    }

    try {
      setIsPending(true);
      setStatus({ type: 'info', message: `Step 1/2 — Approving ${selectedMeta.symbol}...` });

      const tokenAddr  = ASSET_ADDRESSES[selectedAsset];
      const amountWei  = parseUnits(amount.toFixed(selectedMeta.decimals), selectedMeta.decimals);
      const lockSecs   = BigInt(LOCK_DURATION_SECONDS);

      // 1. Approve
      const approveTx = await writeContractAsync({
        address: tokenAddr,
        abi: erc20Abi,
        functionName: 'approve',
        args: [ARC_DEFI_ROUTER_ADDRESS as `0x${string}`, amountWei],
      });
      await publicClient.waitForTransactionReceipt({ hash: approveTx });

      setStatus({ type: 'info', message: `Step 2/2 — Locking ${amount} ${selectedMeta.symbol} for 1 week...` });

      // 2. Lock on-chain
      const lockTx = await writeContractAsync({
        address: ARC_DEFI_ROUTER_ADDRESS as `0x${string}`,
        abi: arcDefiRouterAbi,
        functionName: 'lock',
        args: [tokenAddr, amountWei, lockSecs],
      });
      await publicClient.waitForTransactionReceipt({ hash: lockTx });

      // Save current block for yield calculation (only metadata, not amounts)
      const stakeKey = `arc_stake_block_${userAddress.toLowerCase()}_${selectedAsset}`;
      localStorage.setItem(stakeKey, String(currentBlock));

      setAmountInput('');
      setStatus({ type: 'success', message: `✓ Staked ${amount} ${selectedMeta.symbol} on-chain. Unlockable in 1 week.` });
      setTimeout(refreshAll, 3000);
      window.dispatchEvent(new Event('arc-balance-update'));
    } catch (err: any) {
      setStatus({ type: 'error', message: err?.shortMessage || err?.message || 'Stake failed.' });
    } finally { setIsPending(false); }
  };

  const handleUnstake = async () => {
    if (!selectedPosition) { setStatus({ type: 'error', message: `No active ${selectedMeta.symbol} stake.` }); return; }

    // Check 1-week lock
    const now = Math.floor(Date.now() / 1000);
    if (now < selectedPosition.unlockTime) {
      setStatus({ type: 'error', message: `Still locked. ${timeUntilUnlock(selectedPosition.unlockTime)}` }); return;
    }

    try {
      setIsPending(true);
      setStatus({ type: 'info', message: `Unlocking ${selectedMeta.symbol} from contract...` });

      const unlockTx = await writeContractAsync({
        address: ARC_DEFI_ROUTER_ADDRESS as `0x${string}`,
        abi: arcDefiRouterAbi,
        functionName: 'unlock',
        args: [ASSET_ADDRESSES[selectedAsset]],
      });
      await publicClient!.waitForTransactionReceipt({ hash: unlockTx });

      // Clear stake block from localStorage
      localStorage.removeItem(`arc_stake_block_${userAddress!.toLowerCase()}_${selectedAsset}`);

      setAmountInput('');
      setStatus({ type: 'success', message: `✓ ${fmt(selectedPosition.amount, selectedMeta.decimals)} ${selectedMeta.symbol} returned to your wallet.` });
      setTimeout(refreshAll, 3000);
      window.dispatchEvent(new Event('arc-balance-update'));
    } catch (err: any) {
      setStatus({ type: 'error', message: err?.shortMessage || err?.message || 'Unstake failed. Lock period may not be complete.' });
    } finally { setIsPending(false); }
  };

  // Claim is informational only (no yield contract yet) — records locally
  const handleClaim = async () => {
    if (!selectedPosition || selectedYield <= 0) {
      setStatus({ type: 'error', message: 'No yield to claim yet.' }); return;
    }
    setStatus({ type: 'info', message: `${fmtYield(selectedYield)} ${selectedMeta.symbol} yield recorded. On-chain yield payouts require a rewards contract upgrade.` });
  };

  // ── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 animate-in fade-in duration-200">

      {/* Header */}
      <div className="card rounded-[32px] p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[10px] uppercase font-extrabold tracking-[0.3em] text-amber-600">Arc Chain Testnet</p>
            <h2 className="text-xl font-black text-[var(--text-primary)] mt-1">Yield & Staking Sanctuary</h2>
            <p className="text-xs text-[var(--text-secondary)] max-w-2xl mt-2 leading-relaxed">
              Real on-chain staking — tokens are locked in the ArcDefiRouter contract for 1 week. Balances and lock state are read live from Arc Chain.
            </p>
          </div>
          <div className="bg-[var(--bg-card)] border border-[var(--border-dim)] rounded-2xl px-4 py-3 text-right">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-secondary)] font-black">Total Accrued Yield</p>
            <p className="text-xl font-black text-[var(--text-primary)] mt-2">{fmtYield(totalAccruedYield)}</p>
            <p className="text-[10px] text-[var(--text-secondary)] mt-1">Block: {currentBlock || 'syncing...'}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">

        {/* LEFT — Stake Panel */}
        <div className="xl:col-span-5 space-y-6">
          <div className="card rounded-[32px] p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] font-extrabold text-[var(--text-secondary)]">Stake Panel</p>
                <h3 className="text-lg font-black text-[var(--text-primary)] mt-2">Choose an asset and lock it on-chain for 1 week.</h3>
              </div>
              <div className="rounded-full bg-amber-50 border border-amber-100 px-3 py-1 text-[10px] font-black text-amber-700 flex items-center gap-2">
                <Sparkles size={12} /> Live
              </div>
            </div>

            {/* Asset selector */}
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(ASSET_META) as AssetKey[]).map(asset => {
                const meta = ASSET_META[asset];
                const pos  = positions[asset];
                const now  = Math.floor(Date.now() / 1000);
                const locked = pos && pos.unlockTime > now;
                return (
                  <button key={asset} type="button" onClick={() => setSelectedAsset(asset)}
                    className={`rounded-2xl border px-3 py-4 text-left transition-all ${selectedAsset === asset ? 'border-amber-200 bg-amber-50 shadow-sm' : 'border-[var(--border-dim)] bg-[var(--bg-card)] hover:border-[var(--border-dim)]'}`}>
                    <div className="text-[10px] uppercase font-black tracking-[0.2em] text-[var(--text-secondary)]">{meta.symbol}</div>
                    <div className="text-sm font-black text-[var(--text-primary)] mt-2">{fmt(balances[asset], meta.decimals)} available</div>
                    <div className="text-[10px] text-[var(--text-secondary)] mt-1">{meta.apy}% APY</div>
                    {pos && <div className={`text-[9px] font-black mt-1 ${locked ? 'text-amber-600' : 'text-emerald-600'}`}>{locked ? '🔒 Locked' : '✓ Unlockable'}</div>}
                  </button>
                );
              })}
            </div>

            {/* Amount input */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-dim)] rounded-[24px] p-4 space-y-3">
              <div className="flex justify-between items-center text-[10px] uppercase tracking-[0.2em] font-black text-[var(--text-secondary)]">
                <span>Amount</span>
                <button type="button" onClick={() => setAmountInput(balances[selectedAsset].toFixed(selectedMeta.decimals === 8 ? 8 : 2))} className="text-amber-700 hover:text-amber-800">Use max</button>
              </div>
              <div className="flex items-center gap-4">
                <input type="number" step="any" min="0" value={amountInput} onChange={e => setAmountInput(e.target.value)}
                  className="w-full bg-transparent text-2xl font-black text-[var(--text-primary)] outline-none" placeholder="0.00" />
                <span className="text-sm font-bold text-[var(--text-secondary)]">{selectedMeta.symbol}</span>
              </div>
              <p className="text-[10px] text-[var(--text-secondary)]">
                Wallet: {fmt(balances[selectedAsset], selectedMeta.decimals)} {selectedMeta.symbol}
                {selectedPosition && (
                  <span className="ml-2 text-amber-600 font-bold">
                    • Staked: {fmt(selectedPosition.amount, selectedMeta.decimals)} • {timeUntilUnlock(selectedPosition.unlockTime)}
                  </span>
                )}
              </p>
            </div>

            {/* Lock duration info */}
            <div className="flex items-center gap-2 bg-[rgba(0,242,254,0.05)] border border-[var(--border-dim)] rounded-2xl px-4 py-3 text-[10px] font-bold text-[var(--accent-cyan)]">
              <Clock size={13} /> Tokens are locked on-chain for <span className="font-black">1 week</span>. Unstake anytime after the lock expires.
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button type="button" onClick={handleStake} disabled={isPending || !!selectedPosition}
                className="rounded-2xl bg-emerald-600 text-white font-black px-4 py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-emerald-700 transition-all">
                {isPending ? <Loader2 className="animate-spin" size={15} /> : <ArrowDown size={15} />} Stake
              </button>
              <button type="button" onClick={handleUnstake} disabled={isPending || !selectedPosition}
                className="rounded-2xl bg-[var(--bg-card)] border border-[var(--border-dim)] text-[var(--text-primary)] font-black px-4 py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-[var(--bg-elevated)] transition-all">
                {isPending ? <Loader2 className="animate-spin" size={15} /> : <ArrowUp size={15} />} Unstake
              </button>
              <button type="button" onClick={handleClaim} disabled={isPending || !selectedPosition}
                className="rounded-2xl bg-amber-500 text-slate-950 font-black px-4 py-3 text-sm flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-amber-400 transition-all">
                {isPending ? <Loader2 className="animate-spin" size={15} /> : <BadgeDollarSign size={15} />} Claim
              </button>
            </div>

            <AnimatePresence>
              {status && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                  className={`rounded-2xl border px-4 py-3 text-sm font-bold ${status.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : status.type === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-[var(--border-dim)] bg-slate-50 text-[var(--text-primary)]'}`}>
                  {status.message}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* RIGHT — Live Console */}
        <div className="xl:col-span-7 space-y-6">
          <div className="bg-[var(--bg-card)] rounded-[32px] p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-dim)] pb-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--text-secondary)]">Live Staking Console</p>
                <h3 className="text-lg font-black mt-2 text-[var(--text-primary)]">On-chain lock state read directly from ArcDefiRouter.</h3>
              </div>
              <div className="flex items-center gap-2 text-sm font-bold text-emerald-300"><Activity size={15} /> live</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              {(Object.keys(ASSET_META) as AssetKey[]).map(asset => {
                const meta = ASSET_META[asset];
                const pos  = positions[asset];
                const now  = Math.floor(Date.now() / 1000);
                const accrued = pos ? calcYield(pos, currentBlock, meta.apy) : 0;
                const locked  = pos && pos.unlockTime > now;
                return (
                  <div key={asset} className="rounded-[24px] border border-[var(--border-dim)] bg-[var(--bg-elevated)] p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-secondary)]">{meta.symbol}</p>
                        <p className="text-xl font-black mt-2">{pos ? fmt(pos.amount, meta.decimals) : '0.00'}</p>
                      </div>
                      <span className="rounded-full border border-[var(--border-dim)] px-2 py-1 text-[10px] font-black text-slate-200">{meta.apy}%</span>
                    </div>
                    <div className="mt-4 space-y-1 text-[11px] text-[var(--text-secondary)]">
                      <div className="flex justify-between"><span>Accrued Yield</span><span className="font-black text-emerald-400">{fmtYield(accrued)}</span></div>
                      <div className="flex justify-between"><span>Lock Status</span><span className={`font-black ${locked ? 'text-amber-500' : pos ? 'text-emerald-500' : 'text-[var(--text-secondary)]'}`}>{pos ? (locked ? timeUntilUnlock(pos.unlockTime) : 'Unlockable') : 'Not staked'}</span></div>
                      <div className="flex justify-between"><span>Wallet Balance</span><span className="font-black text-[var(--text-primary)]">{fmt(balances[asset], meta.decimals)}</span></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Current Focus */}
          <div className="card rounded-[32px] p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] font-extrabold text-[var(--text-secondary)]">Current Focus</p>
                <h3 className="text-lg font-black text-[var(--text-primary)] mt-2">{selectedMeta.symbol} • {selectedPosition ? 'active stake' : 'ready to stake'}</h3>
              </div>
              <div className="rounded-full bg-[var(--bg-card)] border border-[var(--border-dim)] px-3 py-1 text-[10px] font-black text-[var(--text-primary)] flex items-center gap-2">
                <ShieldCheck size={12} /> On-chain lock
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-[24px] bg-[var(--bg-elevated)] border border-[var(--border-dim)] p-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-secondary)]">Wallet</p>
                <p className="text-lg font-black text-[var(--text-primary)] mt-2">{fmt(balances[selectedAsset], selectedMeta.decimals)} {selectedMeta.symbol}</p>
              </div>
              <div className="rounded-[24px] bg-[var(--bg-elevated)] border border-[var(--border-dim)] p-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-secondary)]">Staked (On-Chain)</p>
                <p className="text-lg font-black text-[var(--text-primary)] mt-2">{selectedPosition ? fmt(selectedPosition.amount, selectedMeta.decimals) : '0.00'} {selectedMeta.symbol}</p>
              </div>
              <div className="rounded-[24px] bg-[var(--bg-elevated)] border border-[var(--border-dim)] p-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-secondary)]">Accrued Yield</p>
                <p className="text-lg font-black text-emerald-600 mt-2">{fmtYield(selectedYield)} {selectedMeta.symbol}</p>
              </div>
            </div>
            {selectedPosition && (
              <div className={`mt-4 rounded-[24px] border px-4 py-3 text-xs font-bold flex items-center gap-2 ${Math.floor(Date.now() / 1000) < selectedPosition.unlockTime ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                <Clock size={13} />
                {Math.floor(Date.now() / 1000) < selectedPosition.unlockTime
                  ? `Locked until ${new Date(selectedPosition.unlockTime * 1000).toLocaleString()} — ${timeUntilUnlock(selectedPosition.unlockTime)}`
                  : 'Lock period complete — you can unstake now!'}
              </div>
            )}
            <div className="mt-4 rounded-[24px] border border-dashed border-[var(--border-dim)] p-4 text-sm text-[var(--text-secondary)] leading-relaxed">
              <div className="flex items-center gap-2 font-black text-[var(--text-primary)]"><Wallet size={14} /> Real on-chain staking</div>
              <p className="mt-2">Tokens are transferred to the ArcDefiRouter contract on stake. After 1 week, call Unstake to get them back. Yield is calculated off-chain based on block height.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
