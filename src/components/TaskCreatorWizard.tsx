'use client';

import React, { useReducer, useCallback } from 'react';
import { useAccount, useWriteContract, usePublicClient } from 'wagmi';
import { parseUnits, erc20Abi } from 'viem';
import { toast } from 'react-hot-toast';
import { Zap, Clock, Link2, ChevronRight, Coins, CheckCircle2, Loader2 } from 'lucide-react';
import { PREDICTION_MARKET_ADDRESS, predictionMarketAbi } from '@/lib/predictionMarketAbi';
import { supabase } from '@/lib/supabase';

// ─── Arc Chain Testnet Asset Registry ─────────────────────────────────────────
const ARC_ASSETS = [
  {
    symbol:  'USDC',
    label:   'USDC',
    address: '0x0421250fDAb679469Cc2CE7b822CdFe98075B5C3' as `0x${string}`,
    decimals: 6,
    icon:    '💵',
    color:   'bg-blue-50 border-blue-300 text-blue-700',
    active:  'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-200',
  },
  {
    symbol:  'EURC',
    label:   'EURC',
    address: '0x7a829f075d97f48A1100bE2390f7A667Bd3B43C0' as `0x${string}`,
    decimals: 6,
    icon:    '💶',
    color:   'bg-indigo-50 border-indigo-300 text-indigo-700',
    active:  'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-200',
  },
  {
    symbol:  'crBTC',
    label:   'crBTC',
    address: '0x3231F3bDE983570F7317CbC66b56D83431D58B9C' as `0x${string}`,
    decimals: 8,
    icon:    '₿',
    color:   'bg-orange-50 border-orange-300 text-orange-700',
    active:  'bg-orange-500 border-orange-500 text-white shadow-md shadow-orange-200',
  },
] as const;

type AssetSymbol = typeof ARC_ASSETS[number]['symbol'];

// ─── Reducer state ─────────────────────────────────────────────────────────────
type ResolutionType = 'Oracle Trigger' | 'Community Consensus';

interface TaskConfigState {
  taskTitle:        string;
  resolutionType:   ResolutionType;
  oracleEndpoint:   string;           // only active when resolutionType === 'Oracle Trigger'
  expiryTimestamp:  string;           // datetime-local string → converted to epoch on submit
  settlementAsset:  `0x${string}`;   // bound to ARC_ASSETS address
  assetSymbol:      AssetSymbol;
  step:             1 | 2;            // wizard step
}

type TaskAction =
  | { type: 'SET_TITLE';          payload: string }
  | { type: 'SET_RESOLUTION';     payload: ResolutionType }
  | { type: 'SET_ORACLE';         payload: string }
  | { type: 'SET_EXPIRY';         payload: string }
  | { type: 'SELECT_ASSET';       payload: AssetSymbol }
  | { type: 'SET_STEP';           payload: 1 | 2 }
  | { type: 'RESET' };

const INITIAL_STATE: TaskConfigState = {
  taskTitle:       '',
  resolutionType:  'Community Consensus',
  oracleEndpoint:  '',
  expiryTimestamp: '',
  settlementAsset: ARC_ASSETS[0].address,
  assetSymbol:     'USDC',
  step:            1,
};

function taskReducer(state: TaskConfigState, action: TaskAction): TaskConfigState {
  switch (action.type) {
    case 'SET_TITLE':
      return { ...state, taskTitle: action.payload };
    case 'SET_RESOLUTION':
      return {
        ...state,
        resolutionType: action.payload,
        // Clear oracle endpoint when switching away from Oracle Trigger
        oracleEndpoint: action.payload === 'Community Consensus' ? '' : state.oracleEndpoint,
      };
    case 'SET_ORACLE':
      return { ...state, oracleEndpoint: action.payload };
    case 'SET_EXPIRY':
      return { ...state, expiryTimestamp: action.payload };
    case 'SELECT_ASSET': {
      const asset = ARC_ASSETS.find(a => a.symbol === action.payload)!;
      return { ...state, assetSymbol: action.payload, settlementAsset: asset.address };
    }
    case 'SET_STEP':
      return { ...state, step: action.payload };
    case 'RESET':
      return INITIAL_STATE;
    default:
      return state;
  }
}

// ─── Quick expiry helper ────────────────────────────────────────────────────────
function quickExpiry(hours: number): string {
  const d   = new Date(Date.now() + hours * 3_600_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface TaskCreatorWizardProps {
  onSuccess?: () => void;   // callback to refresh parent market list
}

// ─── Component ────────────────────────────────────────────────────────────────
export function TaskCreatorWizard({ onSuccess }: TaskCreatorWizardProps) {
  const { isConnected, address } = useAccount();
  const publicClient             = usePublicClient();
  const { writeContractAsync }   = useWriteContract();

  const [cfg, dispatch] = useReducer(taskReducer, INITIAL_STATE);
  const [submitting, setSubmitting] = React.useState(false);

  // ── Validation ──────────────────────────────────────────────────────────────
  const step1Valid = cfg.taskTitle.trim().length >= 5 && cfg.expiryTimestamp !== '';
  const step2Valid = cfg.settlementAsset.length > 0;

  // ── Step 1 → 2 ─────────────────────────────────────────────────────────────
  const advanceToStep2 = useCallback(() => {
    if (!step1Valid) { toast.error('Fill question (≥5 chars) and expiry date'); return; }
    dispatch({ type: 'SET_STEP', payload: 2 });
  }, [step1Valid]);

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!isConnected || !address) { toast.error('Connect wallet first'); return; }
    if (!step1Valid || !step2Valid) { toast.error('Complete all required fields'); return; }

    const epochSeconds = BigInt(Math.floor(new Date(cfg.expiryTimestamp).getTime() / 1000));
    const asset        = ARC_ASSETS.find(a => a.symbol === cfg.assetSymbol)!;

    setSubmitting(true);
    const tid = toast.loading('Creating prediction market...');

    try {
      // 1. Write contract — createMarket(title, imageUrl, expiry, tokenAddress)
      const txHash = await writeContractAsync({
        address:      PREDICTION_MARKET_ADDRESS as `0x${string}`,
        abi:          predictionMarketAbi,
        functionName: 'createMarket',
        args: [
          cfg.taskTitle,
          '',                        // no image from wizard — blank
          epochSeconds,
          cfg.settlementAsset,       // ← rigidly bound to selected asset address
        ],
      });

      toast.loading('Waiting for confirmation...', { id: tid });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash: txHash });

      // 2. Log to Supabase
      await supabase.from('prediction_history').insert({
        wallet:      address.toLowerCase(),
        action_type: 'CREATE_MARKET',
        market_id:   null,
        details: {
          title:           cfg.taskTitle,
          resolutionType:  cfg.resolutionType,
          oracleEndpoint:  cfg.oracleEndpoint || null,
          settlementAsset: cfg.settlementAsset,
          assetSymbol:     cfg.assetSymbol,
          expiryEpoch:     Number(epochSeconds),
        },
      });

      toast.success('Market created!', { id: tid });
      dispatch({ type: 'RESET' });
      onSuccess?.();
    } catch (err: any) {
      console.error(err);
      toast.error(err.shortMessage || err.message || 'Transaction failed', { id: tid });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
          <Zap className="text-white" size={15} />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-black text-[var(--text-primary)]">Task Creator Wizard</h3>
          <p className="text-[10px] text-slate-400 font-medium">Arc Chain Testnet · Step {cfg.step} of 2</p>
        </div>
        {/* Step indicator dots */}
        <div className="ml-auto flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full transition-colors ${cfg.step >= 1 ? 'bg-blue-500' : 'bg-slate-200'}`} />
          <div className={`w-2 h-2 rounded-full transition-colors ${cfg.step >= 2 ? 'bg-blue-500' : 'bg-slate-200'}`} />
        </div>
      </div>

      <div className="p-5 space-y-5">

        {/* ═══════════════════ STEP 1 ═══════════════════ */}
        {cfg.step === 1 && (
          <div className="space-y-4 animate-in fade-in duration-200">

            {/* Task Title */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Prediction Question <span className="text-red-400">*</span>
              </label>
              <textarea
                rows={2}
                value={cfg.taskTitle}
                onChange={e => dispatch({ type: 'SET_TITLE', payload: e.target.value })}
                placeholder='e.g. "Will Bitcoin hit $80k before Friday?"'
                className="w-full bg-[rgba(6,10,38,0.9)] border border-[var(--border-dim)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--text-primary)] outline-none resize-none focus:border-blue-400 focus:ring-2 focus:ring-blue-900 placeholder:text-slate-300 transition-all"
              />
              <p className="text-[10px] text-slate-400 mt-1">{cfg.taskTitle.length} chars — minimum 5</p>
            </div>

            {/* Resolution Type Toggle */}
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
                      cfg.resolutionType === rt
                        ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {rt === 'Oracle Trigger' ? '⚡ ' : '🗳️ '}{rt}
                  </button>
                ))}
              </div>
            </div>

            {/* Oracle Endpoint — CONDITIONAL: only when Oracle Trigger is active */}
            {cfg.resolutionType === 'Oracle Trigger' && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Link2 size={11} /> Oracle Feed ID
                  <span className="text-[9px] normal-case font-medium text-slate-400">(Pyth / Chainlink)</span>
                </label>
                <input
                  type="text"
                  value={cfg.oracleEndpoint}
                  onChange={e => dispatch({ type: 'SET_ORACLE', payload: e.target.value })}
                  placeholder="e.g. 0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43"
                  className="w-full bg-[rgba(6,10,38,0.9)] border border-[var(--border-dim)] rounded-xl px-3.5 py-2.5 text-xs font-mono text-[var(--text-secondary)] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-900 placeholder:text-slate-300 transition-all"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Paste Pyth price feed ID or Chainlink aggregator address
                </p>
              </div>
            )}

            {/* Expiry Timestamp */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Clock size={11} /> Expiry Date & Time <span className="text-red-400">*</span>
              </label>
              <input
                type="datetime-local"
                value={cfg.expiryTimestamp}
                onChange={e => dispatch({ type: 'SET_EXPIRY', payload: e.target.value })}
                className="w-full bg-[rgba(6,10,38,0.9)] border border-[var(--border-dim)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--text-secondary)] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-900 transition-all"
              />
              {/* Quick shortcuts */}
              <div className="flex gap-1.5 mt-2">
                {[['1h', 1], ['6h', 6], ['24h', 24], ['7d', 168]] .map(([label, hours]) => (
                  <button
                    key={label}
                    onClick={() => dispatch({ type: 'SET_EXPIRY', payload: quickExpiry(Number(hours)) })}
                    className="text-[10px] font-bold px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-all"
                  >
                    +{label}
                  </button>
                ))}
              </div>
              {cfg.expiryTimestamp && (
                <p className="text-[10px] text-slate-400 mt-1.5">
                  Epoch: <span className="font-mono font-bold text-slate-600">
                    {Math.floor(new Date(cfg.expiryTimestamp).getTime() / 1000)}
                  </span>
                </p>
              )}
            </div>

            {/* Next button */}
            <button
              onClick={advanceToStep2}
              disabled={!step1Valid}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-sm transition-all flex items-center justify-center gap-2"
            >
              Continue to Asset Selection <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* ═══════════════════ STEP 2 ═══════════════════ */}
        {cfg.step === 2 && (
          <div className="space-y-5 animate-in fade-in duration-200">

            {/* Summary card */}
            <div className="bg-[rgba(6,10,38,0.9)] border border-[var(--border-dim)] rounded-xl p-3.5 space-y-1.5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Question</p>
              <p className="text-sm font-black text-[var(--text-primary)] leading-snug">{cfg.taskTitle}</p>
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="text-[10px] bg-white border border-slate-200 px-2 py-0.5 rounded-lg font-semibold text-slate-500">
                  {cfg.resolutionType === 'Oracle Trigger' ? '⚡' : '🗳️'} {cfg.resolutionType}
                </span>
                {cfg.expiryTimestamp && (
                  <span className="text-[10px] bg-white border border-slate-200 px-2 py-0.5 rounded-lg font-semibold text-slate-500">
                    ⏰ {new Date(cfg.expiryTimestamp).toLocaleString()}
                  </span>
                )}
              </div>
            </div>

            {/* Settlement Asset Selector */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Coins size={11} /> Settlement Asset Pool
              </label>
              <p className="text-[10px] text-slate-400 mb-3">
                All bets and payouts will settle in the chosen token on Arc Testnet.
              </p>

              {/* Radio chip row */}
              <div className="flex gap-2">
                {ARC_ASSETS.map(asset => {
                  const isActive = cfg.assetSymbol === asset.symbol;
                  return (
                    <button
                      key={asset.symbol}
                      onClick={() => dispatch({ type: 'SELECT_ASSET', payload: asset.symbol })}
                      className={`flex-1 flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 font-bold text-xs transition-all ${
                        isActive ? asset.active : asset.color
                      }`}
                    >
                      <span className="text-lg leading-none">{asset.icon}</span>
                      <span className="font-black">{asset.label}</span>
                      {isActive && <CheckCircle2 size={12} className="opacity-80" />}
                    </button>
                  );
                })}
              </div>

              {/* Bound address display */}
              <div className="mt-3 bg-[rgba(6,10,38,0.9)] border border-[var(--border-dim)] rounded-xl px-3.5 py-2.5">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                  Bound Contract Address
                </p>
                <p className="text-[11px] font-mono text-[var(--text-secondary)] break-all">
                  {cfg.settlementAsset}
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => dispatch({ type: 'SET_STEP', payload: 1 })}
                disabled={submitting}
                className="px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-600 font-bold text-sm hover:bg-slate-100 transition-all"
              >
                ← Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !isConnected}
                className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-sm transition-all flex items-center justify-center gap-2"
              >
                {submitting
                  ? <><Loader2 className="animate-spin" size={16} /> Creating Market...</>
                  : <><Zap size={16} /> Deploy Market</>
                }
              </button>
            </div>

            {!isConnected && (
              <p className="text-[11px] text-center text-slate-400 font-semibold">
                Connect wallet to deploy
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
