'use client';

import React, { useReducer, useEffect, useRef, useCallback, useState } from 'react';
import { useAccount, useWriteContract, usePublicClient } from 'wagmi';
import { parseUnits, erc20Abi } from 'viem';
import { toast } from 'react-hot-toast';
import {
  TrendingUp, TrendingDown, Clock, Zap, Link2,
  ChevronDown, ChevronUp, Coins, Activity, BarChart2,
  CheckCircle2, Loader2, RefreshCw,
} from 'lucide-react';
import { PREDICTION_MARKET_ADDRESS, predictionMarketAbi } from '@/lib/predictionMarketAbi';
import { supabase } from '@/lib/supabase';

// ─── Arc Chain Testnet Asset Registry ─────────────────────────────────────────
const ARC_ASSETS = [
  {
    symbol:   'USDC'  as const,
    label:    'USDC',
    address:  '0x0421250fDAb679469Cc2CE7b822CdFe98075B5C3' as `0x${string}`,
    decimals: 6,
    icon:     '💵',
    pill:     'bg-blue-600 text-white border-blue-600',
    idle:     'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100',
  },
  {
    symbol:   'EURC'  as const,
    label:    'EURC',
    address:  '0x7a829f075d97f48A1100bE2390f7A667Bd3B43C0' as `0x${string}`,
    decimals: 6,
    icon:     '💶',
    pill:     'bg-indigo-600 text-white border-indigo-600',
    idle:     'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100',
  },
  {
    symbol:   'crBTC' as const,
    label:    'crBTC',
    address:  '0x3231F3bDE983570F7317CbC66b56D83431D58B9C' as `0x${string}`,
    decimals: 8,
    icon:     '₿',
    pill:     'bg-orange-500 text-white border-orange-500',
    idle:     'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100',
  },
] as const;

type AssetSymbol = typeof ARC_ASSETS[number]['symbol'];
type Mode = 'task' | 'binary';
type ResolutionType = 'Oracle Trigger' | 'Community Consensus';
type Direction = 'UP' | 'DOWN' | null;

// ─── Unified pool state ───────────────────────────────────────────────────────
interface PoolState {
  mode:            Mode;
  assetSymbol:     AssetSymbol;
  settlementAsset: `0x${string}`;
  // Task fields
  taskTitle:       string;
  resolutionType:  ResolutionType;
  oracleEndpoint:  string;
  expiryTimestamp: string;
  // Binary fields
  betAmount:       string;
  direction:       Direction;
  strikePrice:     number;
  totalUpPool:     number;
  totalDownPool:   number;
  secondsLeft:     number;      // 5-min countdown
  roundActive:     boolean;
  myBets:          { direction: Direction; amount: number; strikePrice: number; settled: boolean; won: boolean | null }[];
}

type PoolAction =
  | { type: 'SET_MODE';           payload: Mode }
  | { type: 'SET_ASSET';          payload: AssetSymbol }
  | { type: 'SET_TASK_TITLE';     payload: string }
  | { type: 'SET_RESOLUTION';     payload: ResolutionType }
  | { type: 'SET_ORACLE';         payload: string }
  | { type: 'SET_EXPIRY';         payload: string }
  | { type: 'SET_BET_AMOUNT';     payload: string }
  | { type: 'SET_DIRECTION';      payload: Direction }
  | { type: 'SET_STRIKE';         payload: number }
  | { type: 'LOCK_BET';           payload: { direction: Direction; amount: number; strike: number } }
  | { type: 'TICK';               payload: number }         // secondsLeft decrement
  | { type: 'START_ROUND';        payload: { strike: number } }
  | { type: 'SETTLE_ROUND';       payload: { finalPrice: number } }
  | { type: 'RESET_TASK' };

const ROUND_SECONDS = 300; // 5 minutes

function getAsset(sym: AssetSymbol) {
  return ARC_ASSETS.find(a => a.symbol === sym)!;
}

const INIT: PoolState = {
  mode:            'binary',
  assetSymbol:     'USDC',
  settlementAsset: ARC_ASSETS[0].address,
  taskTitle:       '',
  resolutionType:  'Community Consensus',
  oracleEndpoint:  '',
  expiryTimestamp: '',
  betAmount:       '',
  direction:       null,
  strikePrice:     0,
  totalUpPool:     0,
  totalDownPool:   0,
  secondsLeft:     ROUND_SECONDS,
  roundActive:     false,
  myBets:          [],
};

function poolReducer(state: PoolState, action: PoolAction): PoolState {
  switch (action.type) {
    case 'SET_MODE':
      return { ...state, mode: action.payload };
    case 'SET_ASSET': {
      const asset = getAsset(action.payload);
      return { ...state, assetSymbol: action.payload, settlementAsset: asset.address };
    }
    case 'SET_TASK_TITLE':
      return { ...state, taskTitle: action.payload };
    case 'SET_RESOLUTION':
      return {
        ...state,
        resolutionType: action.payload,
        oracleEndpoint: action.payload === 'Community Consensus' ? '' : state.oracleEndpoint,
      };
    case 'SET_ORACLE':
      return { ...state, oracleEndpoint: action.payload };
    case 'SET_EXPIRY':
      return { ...state, expiryTimestamp: action.payload };
    case 'SET_BET_AMOUNT':
      return { ...state, betAmount: action.payload };
    case 'SET_DIRECTION':
      return { ...state, direction: action.payload };
    case 'SET_STRIKE':
      return { ...state, strikePrice: action.payload };
    case 'LOCK_BET': {
      const { direction, amount, strike } = action.payload;
      const upDelta   = direction === 'UP'   ? amount : 0;
      const downDelta = direction === 'DOWN'  ? amount : 0;
      return {
        ...state,
        totalUpPool:   state.totalUpPool   + upDelta,
        totalDownPool: state.totalDownPool + downDelta,
        myBets: [...state.myBets, { direction, amount, strikePrice: strike, settled: false, won: null }],
        betAmount: '',
        direction: null,
      };
    }
    case 'START_ROUND':
      return { ...state, roundActive: true, secondsLeft: ROUND_SECONDS, strikePrice: action.payload.strike, totalUpPool: 0, totalDownPool: 0 };
    case 'TICK':
      return { ...state, secondsLeft: Math.max(0, action.payload) };
    case 'SETTLE_ROUND': {
      const { finalPrice } = action.payload;
      const priceWentUp = finalPrice >= state.strikePrice;
      const settledBets = state.myBets.map(b => {
        if (b.settled) return b;
        const won = b.direction === 'UP' ? priceWentUp : !priceWentUp;
        return { ...b, settled: true, won };
      });
      return { ...state, roundActive: false, secondsLeft: ROUND_SECONDS, myBets: settledBets };
    }
    case 'RESET_TASK':
      return { ...state, taskTitle: '', resolutionType: 'Community Consensus', oracleEndpoint: '', expiryTimestamp: '' };
    default:
      return state;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}
function quickExpiry(hours: number): string {
  const d   = new Date(Date.now() + hours * 3_600_000);
  const p   = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ─── Mock price ticker (replace with real Pyth/Chainlink feed) ───────────────
function useMockPrice(base = 67_500) {
  const [price, setPrice] = useState(base);
  useEffect(() => {
    const id = setInterval(() => {
      setPrice(p => +(p + (Math.random() - 0.49) * 120).toFixed(2));
    }, 1500);
    return () => clearInterval(id);
  }, []);
  return price;
}

// ─── Component ────────────────────────────────────────────────────────────────
interface BinaryTradingWizardProps {
  onTaskCreated?: () => void;
}

export function BinaryTradingWizard({ onTaskCreated }: BinaryTradingWizardProps) {
  const { isConnected, address } = useAccount();
  const publicClient             = usePublicClient();
  const { writeContractAsync }   = useWriteContract();

  const [pool, dispatch]   = useReducer(poolReducer, INIT);
  const [submitting, setSubmitting] = useState(false);
  const [prevPrice, setPrevPrice]   = useState(0);

  const livePrice = useMockPrice(67_500);
  const priceUp   = livePrice >= prevPrice;
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  // Update strike + prev price on tick
  useEffect(() => {
    if (!pool.roundActive) dispatch({ type: 'SET_STRIKE', payload: livePrice });
    setPrevPrice(livePrice);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [livePrice]);

  // 5-minute countdown when round is active
  useEffect(() => {
    if (pool.roundActive) {
      timerRef.current = setInterval(() => {
        dispatch({ type: 'TICK', payload: pool.secondsLeft - 1 });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool.roundActive]);

  // Auto-settle when timer hits 0
  useEffect(() => {
    if (pool.roundActive && pool.secondsLeft === 0) {
      dispatch({ type: 'SETTLE_ROUND', payload: { finalPrice: livePrice } });
      const upWon = livePrice >= pool.strikePrice;
      toast[upWon ? 'success' : 'error'](
        upWon ? '🟢 UP wins this round!' : '🔴 DOWN wins this round!'
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool.secondsLeft, pool.roundActive]);

  // ── Place binary bet ────────────────────────────────────────────────────────
  const handlePlaceBet = useCallback(async () => {
    if (!isConnected || !address) { toast.error('Connect wallet first'); return; }
    if (!pool.direction)          { toast.error('Choose UP or DOWN');     return; }
    const amount = parseFloat(pool.betAmount);
    if (!amount || amount <= 0)   { toast.error('Enter valid amount');    return; }

    const asset = getAsset(pool.assetSymbol);

    setSubmitting(true);
    const tid = toast.loading(`Placing ${pool.direction} bet...`);
    try {
      const amountWei = parseUnits(pool.betAmount, asset.decimals);

      // Approve token
      const approveTx = await writeContractAsync({
        address:      asset.address,
        abi:          erc20Abi,
        functionName: 'approve',
        args:         [PREDICTION_MARKET_ADDRESS as `0x${string}`, amountWei],
      });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash: approveTx });

      // Log bet to Supabase
      await supabase.from('prediction_history').insert({
        wallet:      address.toLowerCase(),
        action_type: 'BINARY_BET',
        market_id:   null,
        details: {
          direction:      pool.direction,
          amount:         amount,
          strikePrice:    pool.strikePrice,
          asset:          pool.assetSymbol,
          settlementAddr: pool.settlementAsset,
        },
      });

      dispatch({ type: 'LOCK_BET', payload: { direction: pool.direction, amount, strike: pool.strikePrice } });
      if (!pool.roundActive) dispatch({ type: 'START_ROUND', payload: { strike: pool.strikePrice } });

      toast.success(`${pool.direction} bet locked! Strike: $${pool.strikePrice.toLocaleString()}`, { id: tid });
    } catch (err: any) {
      toast.error(err.shortMessage || err.message || 'Bet failed', { id: tid });
    } finally {
      setSubmitting(false);
    }
  }, [pool, isConnected, address, publicClient, writeContractAsync]);

  // ── Create parametric task ──────────────────────────────────────────────────
  const handleCreateTask = useCallback(async () => {
    if (!isConnected || !address) { toast.error('Connect wallet first'); return; }
    if (pool.taskTitle.trim().length < 5) { toast.error('Question must be ≥ 5 chars'); return; }
    if (!pool.expiryTimestamp)             { toast.error('Set expiry date');             return; }

    const epochSec = BigInt(Math.floor(new Date(pool.expiryTimestamp).getTime() / 1000));
    const asset    = getAsset(pool.assetSymbol);

    setSubmitting(true);
    const tid = toast.loading('Deploying market on-chain...');
    try {
      const tx = await writeContractAsync({
        address:      PREDICTION_MARKET_ADDRESS as `0x${string}`,
        abi:          predictionMarketAbi,
        functionName: 'createMarket',
        args:         [pool.taskTitle, '', epochSec, asset.address],
      });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash: tx });

      await supabase.from('prediction_history').insert({
        wallet:      address.toLowerCase(),
        action_type: 'CREATE_MARKET',
        market_id:   null,
        details: {
          title:          pool.taskTitle,
          resolutionType: pool.resolutionType,
          oracleEndpoint: pool.oracleEndpoint || null,
          assetSymbol:    pool.assetSymbol,
          settlementAddr: pool.settlementAsset,
          expiryEpoch:    Number(epochSec),
        },
      });

      toast.success('Market deployed!', { id: tid });
      dispatch({ type: 'RESET_TASK' });
      onTaskCreated?.();
    } catch (err: any) {
      toast.error(err.shortMessage || err.message || 'Deploy failed', { id: tid });
    } finally {
      setSubmitting(false);
    }
  }, [pool, isConnected, address, publicClient, writeContractAsync, onTaskCreated]);

  // ── Derived values ──────────────────────────────────────────────────────────
  const totalPool    = pool.totalUpPool + pool.totalDownPool;
  const upPct        = totalPool > 0 ? (pool.totalUpPool   / totalPool) * 100 : 50;
  const downPct      = totalPool > 0 ? (pool.totalDownPool / totalPool) * 100 : 50;
  const currentAsset = getAsset(pool.assetSymbol);
  const timerPct     = (pool.secondsLeft / ROUND_SECONDS) * 100;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">

      {/* ── Top header + mode switcher ── */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center flex-shrink-0">
          <BarChart2 className="text-white" size={15} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-black text-slate-800">Prediction Wizard</h3>
          <p className="text-[10px] text-slate-400 font-medium">Arc Chain Testnet</p>
        </div>
        {/* Mode tabs */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
          {(['binary', 'task'] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => dispatch({ type: 'SET_MODE', payload: m })}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                pool.mode === m
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {m === 'binary' ? '⚡ 5-Min Trade' : '📋 Create Task'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Asset selector ── */}
      <div className="flex gap-2 px-5 pt-4">
        {ARC_ASSETS.map(a => (
          <button
            key={a.symbol}
            onClick={() => dispatch({ type: 'SET_ASSET', payload: a.symbol })}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border text-xs font-bold transition-all ${
              pool.assetSymbol === a.symbol ? a.pill : a.idle
            }`}
          >
            <span>{a.icon}</span>{a.label}
          </button>
        ))}
      </div>

      <div className="p-5 space-y-5">

        {/* ══════════════ MODE B — BINARY TRADING ══════════════ */}
        {pool.mode === 'binary' && (
          <div className="space-y-4 animate-in fade-in duration-200">

            {/* Live price ticker */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              {/* Chart placeholder */}
              <div className="h-32 bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center relative">
                <div className="absolute inset-0 flex items-end px-4 pb-3 gap-px">
                  {Array.from({ length: 40 }).map((_, i) => {
                    const h = 20 + Math.abs(Math.sin(i * 0.4 + 1)) * 60;
                    return (
                      <div
                        key={i}
                        className={`flex-1 rounded-sm transition-all ${i > 36 ? (priceUp ? 'bg-emerald-400' : 'bg-red-400') : 'bg-blue-200'}`}
                        style={{ height: `${h}%` }}
                      />
                    );
                  })}
                </div>
                <div className="relative z-10 text-center">
                  <Activity size={16} className="text-blue-400 mx-auto mb-1" />
                  <p className="text-[10px] font-bold text-slate-400">BTC/USD Live Feed</p>
                </div>
              </div>
              {/* Price bar */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-white border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Strike</span>
                  <span className="text-sm font-black text-slate-700">
                    ${pool.strikePrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className={`flex items-center gap-1 text-sm font-black ${priceUp ? 'text-emerald-600' : 'text-red-500'}`}>
                  {priceUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  ${livePrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                {/* 5-min timer */}
                <div className="flex items-center gap-1.5">
                  <Clock size={12} className={pool.roundActive ? 'text-amber-500 animate-pulse' : 'text-slate-300'} />
                  <span className={`text-sm font-black tabular-nums ${pool.roundActive ? 'text-amber-600' : 'text-slate-400'}`}>
                    {fmtTime(pool.secondsLeft)}
                  </span>
                </div>
              </div>
              {/* Timer progress bar */}
              {pool.roundActive && (
                <div className="h-1 bg-slate-100">
                  <div
                    className="h-full bg-amber-400 transition-all duration-1000"
                    style={{ width: `${timerPct}%` }}
                  />
                </div>
              )}
            </div>

            {/* UP / DOWN buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => dispatch({ type: 'SET_DIRECTION', payload: 'UP' })}
                className={`py-4 rounded-xl font-black text-sm flex flex-col items-center gap-1 border-2 transition-all ${
                  pool.direction === 'UP'
                    ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-200'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100'
                }`}
              >
                <TrendingUp size={20} />
                UP 🟩
                <span className="text-[10px] font-semibold opacity-75">
                  Pool: {currentAsset.symbol} {pool.totalUpPool.toFixed(2)}
                </span>
              </button>
              <button
                onClick={() => dispatch({ type: 'SET_DIRECTION', payload: 'DOWN' })}
                className={`py-4 rounded-xl font-black text-sm flex flex-col items-center gap-1 border-2 transition-all ${
                  pool.direction === 'DOWN'
                    ? 'bg-red-500 border-red-500 text-white shadow-lg shadow-red-200'
                    : 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
                }`}
              >
                <TrendingDown size={20} />
                DOWN 🟥
                <span className="text-[10px] font-semibold opacity-75">
                  Pool: {currentAsset.symbol} {pool.totalDownPool.toFixed(2)}
                </span>
              </button>
            </div>

            {/* Pool balance bars */}
            {totalPool > 0 && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] font-bold">
                  <span className="text-emerald-600">UP {upPct.toFixed(0)}% — {pool.totalUpPool.toFixed(2)}</span>
                  <span className="text-red-500">DOWN {downPct.toFixed(0)}% — {pool.totalDownPool.toFixed(2)}</span>
                </div>
                <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-100">
                  <div className="bg-emerald-400 transition-all duration-500" style={{ width: `${upPct}%` }} />
                  <div className="bg-red-400 transition-all duration-500"   style={{ width: `${downPct}%` }} />
                </div>
                <p className="text-[10px] text-slate-400 text-center font-medium">
                  Total locked: {totalPool.toFixed(2)} {currentAsset.symbol}
                </p>
              </div>
            )}

            {/* Bet amount input */}
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="number"
                  value={pool.betAmount}
                  onChange={e => dispatch({ type: 'SET_BET_AMOUNT', payload: e.target.value })}
                  placeholder={`Amount in ${currentAsset.symbol}`}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 placeholder:text-slate-300"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                  {currentAsset.symbol}
                </span>
              </div>
              <button
                onClick={handlePlaceBet}
                disabled={submitting || !pool.direction || !pool.betAmount}
                className={`px-4 py-3 rounded-xl font-black text-sm flex items-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  pool.direction === 'UP'
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                    : pool.direction === 'DOWN'
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {submitting ? <Loader2 className="animate-spin" size={16} /> : <Zap size={16} />}
                Bet
              </button>
            </div>

            {/* Contract address */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Settlement Contract</p>
              <p className="text-[10px] font-mono text-slate-600 break-all">{currentAsset.address}</p>
            </div>

            {/* My bets */}
            {pool.myBets.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">My Bets This Round</p>
                {pool.myBets.map((b, i) => (
                  <div key={i} className="flex items-center justify-between py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold">
                    <span className={b.direction === 'UP' ? 'text-emerald-600 font-black' : 'text-red-500 font-black'}>
                      {b.direction === 'UP' ? '🟩 UP' : '🟥 DOWN'} @ ${b.strikePrice.toLocaleString()}
                    </span>
                    <span className="text-slate-600">{b.amount} {currentAsset.symbol}</span>
                    {b.settled
                      ? <span className={b.won ? 'text-emerald-600 font-black' : 'text-red-500 font-black'}>
                          {b.won ? '✓ WIN' : '✗ LOSS'}
                        </span>
                      : <span className="text-amber-500 font-bold flex items-center gap-1">
                          <RefreshCw size={10} className="animate-spin" /> Live
                        </span>
                    }
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══════════════ MODE A — TASK CREATOR ══════════════ */}
        {pool.mode === 'task' && (
          <div className="space-y-4 animate-in fade-in duration-200">

            {/* Task title */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Prediction Question <span className="text-red-400">*</span>
              </label>
              <textarea
                rows={2}
                value={pool.taskTitle}
                onChange={e => dispatch({ type: 'SET_TASK_TITLE', payload: e.target.value })}
                placeholder='"Will BTC hit $80k before Friday?"'
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 outline-none resize-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 placeholder:text-slate-300 transition-all"
              />
              <p className="text-[10px] text-slate-400 mt-1">{pool.taskTitle.length} chars — min 5</p>
            </div>

            {/* Resolution type */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                Resolution Method
              </label>
              <div className="flex gap-2">
                {(['Oracle Trigger', 'Community Consensus'] as ResolutionType[]).map(rt => (
                  <button
                    key={rt}
                    onClick={() => dispatch({ type: 'SET_RESOLUTION', payload: rt })}
                    className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      pool.resolutionType === rt
                        ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {rt === 'Oracle Trigger' ? '⚡ ' : '🗳️ '}{rt}
                  </button>
                ))}
              </div>
            </div>

            {/* Oracle endpoint — conditional */}
            {pool.resolutionType === 'Oracle Trigger' && (
              <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Link2 size={11} /> Oracle Feed ID
                  <span className="text-[9px] normal-case font-medium text-slate-400">(Pyth / Chainlink)</span>
                </label>
                <input
                  type="text"
                  value={pool.oracleEndpoint}
                  onChange={e => dispatch({ type: 'SET_ORACLE', payload: e.target.value })}
                  placeholder="0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 placeholder:text-slate-300 transition-all"
                />
              </div>
            )}

            {/* Expiry */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Clock size={11} /> Expiry <span className="text-red-400">*</span>
              </label>
              <input
                type="datetime-local"
                value={pool.expiryTimestamp}
                onChange={e => dispatch({ type: 'SET_EXPIRY', payload: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
              />
              <div className="flex gap-1.5 mt-2">
                {[['1h',1],['6h',6],['24h',24],['7d',168]].map(([l, h]) => (
                  <button
                    key={l}
                    onClick={() => dispatch({ type: 'SET_EXPIRY', payload: quickExpiry(Number(h)) })}
                    className="text-[10px] font-bold px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-all"
                  >
                    +{l}
                  </button>
                ))}
              </div>
              {pool.expiryTimestamp && (
                <p className="text-[10px] text-slate-400 mt-1.5">
                  Epoch: <span className="font-mono font-bold text-slate-600">
                    {Math.floor(new Date(pool.expiryTimestamp).getTime() / 1000)}
                  </span>
                </p>
              )}
            </div>

            {/* Settlement asset display */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                <Coins size={9} /> Settlement Asset Bound
              </p>
              <p className="text-xs font-black text-slate-700 mb-0.5">{currentAsset.icon} {currentAsset.symbol}</p>
              <p className="text-[10px] font-mono text-slate-500 break-all">{currentAsset.address}</p>
            </div>

            {/* Deploy button */}
            <button
              onClick={handleCreateTask}
              disabled={submitting || pool.taskTitle.trim().length < 5 || !pool.expiryTimestamp}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black text-sm transition-all flex items-center justify-center gap-2"
            >
              {submitting
                ? <><Loader2 className="animate-spin" size={16} /> Deploying...</>
                : <><Zap size={16} /> Deploy Prediction Market</>
              }
            </button>

            {!isConnected && (
              <p className="text-[11px] text-center text-slate-400 font-semibold">Connect wallet to deploy</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
