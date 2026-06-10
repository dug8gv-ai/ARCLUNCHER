'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAccount, usePublicClient, useWriteContract } from 'wagmi';
import { parseUnits, erc20Abi } from 'viem';
import { Activity, Globe, Zap, ArrowRightLeft, Loader2, TrendingUp, Search, ChevronDown, ExternalLink, Filter, Coins, Users, ArrowUpRight, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { supabase } from '@/lib/supabase';

import { 
  ECOSYSTEM_USDC_ADDRESS, 
  ECOSYSTEM_EURC_ADDRESS, 
  ECOSYSTEM_CRBTC_ADDRESS,
  ECOSYSTEM_FACTORY_ADDRESS,
  ECOSYSTEM_ROUTER_ADDRESS,
  ecosystemFactoryAbi,
  ecosystemRouterAbi
} from '@/lib/arcEcosystemAbi';

import { ARC_DEFI_ROUTER_ADDRESS, arcDefiRouterAbi } from '@/lib/arcDefiAbi';

// Import components
import { PriceChart } from '@/components/PriceChart';

// ── Types ──────────────────────────────────────────────────────────────
type UnifiedToken = {
  id: string;
  token_address: string;
  name: string;
  ticker: string;
  image_url: string | null;
  holders: number | string;
  priceChange: string;
  type: string;
  _source: 'arcomni' | 'arcscan';
  _holdersRaw: number;
  decimals?: string;
  total_supply?: string;
  is_pinned?: boolean;
  badge_type?: string;
};

type SwapTx = {
  hash: string;
  isBuy: boolean;
  ticker: string;
  amount: number;
  volume: number;
  timestamp: number;
  token_address: string;
};

const ARCSCAN_API = 'https://testnet.arcscan.app/api/v2/tokens';
const ARCSCAN_EXPLORER = 'https://testnet.arcscan.app';

export function ArcEcosystemHub() {
  const { isConnected, address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  // ── State ────────────────────────────────────────────────────────────
  const [allTokens, setAllTokens] = useState<UnifiedToken[]>([]);
  const [filteredTokens, setFilteredTokens] = useState<UnifiedToken[]>([]);
  const [swaps, setSwaps] = useState<SwapTx[]>([]);
  const [totalCumulativeVolume, setTotalCumulativeVolume] = useState(0);
  const [selectedToken, setSelectedToken] = useState<any | null>(null);
  
  const [isLoadingTokens, setIsLoadingTokens] = useState(true);
  const [hasMoreTokens, setHasMoreTokens] = useState(false);
  const [nextPageParams, setNextPageParams] = useState<any>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [tokenTypeFilter, setTokenTypeFilter] = useState<'ALL' | 'ERC-20' | 'ERC-721'>('ALL');

  // Swap Panel State
  const [swapAmount, setSwapAmount] = useState('');
  const [baseAnchor, setBaseAnchor] = useState<'USDC' | 'EURC' | 'crBTC'>('USDC');
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapDirection, setSwapDirection] = useState<'BUY' | 'SELL'>('BUY');

  // ── Fetch Unified Tokens (ArcOmni Supabase + ArcScan API) ────────────
  const fetchUnifiedTokens = useCallback(async (loadMoreParams?: any) => {
    try {
      if (!loadMoreParams) setIsLoadingTokens(true);
      else setIsLoadingMore(true);

      // 1. Fetch ArcOmni Tokens from Supabase
      let arcOmniTokens: any[] = [];
      let arcOmniMap = new Map<string, boolean>();
      
      // Only fetch Supabase tokens on initial load (not on pagination)
      if (!loadMoreParams) {
        let dbTokensData: any[] | null = null;
        try {
          const res = await supabase
            .from('token_launches')
            .select('*')
            .order('is_pinned', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(100);
          dbTokensData = res.data;
        } catch (fallbackErr) {
          const res = await supabase.from('token_launches').select('*').order('created_at', { ascending: false }).limit(100);
          dbTokensData = res.data;
        }

        // Fetch swaps for metrics
        const addresses = dbTokensData?.map(t => t.token_address) || [];
        const { data: allSwaps } = await supabase
          .from('token_swaps')
          .select('token_address, user_address, usdc_amount, token_amount')
          .in('token_address', addresses);

        arcOmniTokens = (dbTokensData || []).map(token => {
          arcOmniMap.set(token.token_address.toLowerCase(), true);
          const tSwaps = allSwaps?.filter(s => s.token_address === token.token_address) || [];
          const holdersCount = new Set(tSwaps.map(s => s.user_address)).size;
          
          let pChange = 0;
          if (tSwaps.length >= 2) {
            const initialPrice = Number(tSwaps[0].usdc_amount / tSwaps[0].token_amount);
            const latestPrice = Number(tSwaps[tSwaps.length - 1].usdc_amount / tSwaps[tSwaps.length - 1].token_amount);
            pChange = ((latestPrice - initialPrice) / (initialPrice || 1)) * 100;
          }

          return {
            id: token.id,
            token_address: token.token_address,
            name: token.name,
            ticker: token.ticker,
            image_url: token.image_url,
            holders: holdersCount,
            priceChange: isNaN(pChange) ? "0.00" : pChange.toFixed(2),
            type: 'ERC-20',
            _source: 'arcomni',
            _holdersRaw: holdersCount,
            is_pinned: token.is_pinned,
            badge_type: token.badge_type,
            decimals: '18',
          } as UnifiedToken;
        });
      }

      // 2. Fetch ArcScan API Tokens (Pagination handling)
      let arcScanTokens: UnifiedToken[] = [];
      let nextParams = loadMoreParams;
      let pagesFetched = 0;
      
      // Auto-fetch up to 4 pages (200 tokens) if it's the initial load to solve the 50 token limit problem
      const pagesToFetch = loadMoreParams ? 1 : 4; 

      while (pagesFetched < pagesToFetch) {
        let url = ARCSCAN_API;
        if (nextParams) {
          const params = new URLSearchParams();
          if (nextParams.contract_address_hash) params.set('contract_address_hash', nextParams.contract_address_hash);
          if (nextParams.holders_count !== undefined) params.set('holders_count', String(nextParams.holders_count));
          if (nextParams.items_count !== undefined) params.set('items_count', String(nextParams.items_count));
          if (nextParams.name) params.set('name', nextParams.name);
          url = `${ARCSCAN_API}?${params.toString()}`;
        }

        const res = await fetch(url);
        if (!res.ok) break;
        
        const data = await res.json();
        const items = data.items || [];
        
        const mapped = items
          .filter((t: any) => {
            // If it's initial load, filter against ArcOmni. If pagination, we filter against existing allTokens in state.
            const isAlreadyArcOmni = arcOmniMap.has(t.address_hash.toLowerCase());
            return !isAlreadyArcOmni;
          })
          .map((t: any) => ({
            id: t.address_hash,
            token_address: t.address_hash,
            name: t.name || 'Unknown Token',
            ticker: t.symbol || '???',
            image_url: t.icon_url,
            holders: Number(t.holders_count || 0),
            priceChange: '0.00',
            type: t.type,
            _source: 'arcscan',
            _holdersRaw: Number(t.holders_count || 0),
            decimals: t.decimals,
            total_supply: t.total_supply
          } as UnifiedToken));
        
        arcScanTokens = [...arcScanTokens, ...mapped];
        nextParams = data.next_page_params;
        pagesFetched++;
        
        if (!nextParams) break;
      }

      setNextPageParams(nextParams || null);
      setHasMoreTokens(!!nextParams);

      if (loadMoreParams) {
        // Append to existing
        setAllTokens(prev => {
          // ensure no duplicates
          const existingIds = new Set(prev.map(p => p.token_address.toLowerCase()));
          const newUnique = arcScanTokens.filter(a => !existingIds.has(a.token_address.toLowerCase()));
          return [...prev, ...newUnique];
        });
      } else {
        // Replace all
        setAllTokens([...arcOmniTokens, ...arcScanTokens]);
      }

    } catch (err) {
      console.error('Error fetching unified tokens:', err);
      toast.error('Failed to load tokens');
    } finally {
      setIsLoadingTokens(false);
      setIsLoadingMore(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchUnifiedTokens();
  }, [fetchUnifiedTokens]);

  // Filter logic (Deduplicate correctly)
  useEffect(() => {
    // 1. Strict deduplication by token address (case-insensitive)
    const uniqueMap = new Map<string, UnifiedToken>();
    allTokens.forEach(t => {
      const addr = t.token_address.toLowerCase();
      // Prefer ArcOmni source if duplicates exist
      if (!uniqueMap.has(addr) || t._source === 'arcomni') {
        uniqueMap.set(addr, t);
      }
    });
    let filtered = Array.from(uniqueMap.values());

    if (tokenTypeFilter !== 'ALL') {
      filtered = filtered.filter(t => t.type === tokenTypeFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(t => 
        (t.name || '').toLowerCase().includes(q) ||
        (t.ticker || '').toLowerCase().includes(q) ||
        t.token_address.toLowerCase().includes(q)
      );
    }

    // Sort: ArcOmni pinned first, then by holders
    filtered.sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return b._holdersRaw - a._holdersRaw;
    });

    setFilteredTokens(filtered);
  }, [allTokens, searchQuery, tokenTypeFilter]);

  // ── Global Swap Stream (Supabase) ──────────────────────────────────
  useEffect(() => {
    let isMounted = true;

    const fetchSwaps = async () => {
      const { data: swapData } = await supabase
        .from('token_swaps')
        .select('*, token_launches(ticker)')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!isMounted) return;

      let cumulativeVolume = 0;
      const formattedSwaps: SwapTx[] = [];

      if (swapData) {
        swapData.forEach((s: any) => {
          const sVolume = Number(s.usdc_amount || 0);
          cumulativeVolume += sVolume;
          formattedSwaps.push({
            hash: s.id || `hash_${Math.random()}`,
            isBuy: s.is_buy,
            ticker: s.token_launches?.ticker || 'UNKNOWN',
            amount: Number(s.token_amount || 0),
            volume: sVolume,
            timestamp: new Date(s.created_at).getTime(),
            token_address: s.token_address
          });
        });
        setSwaps(formattedSwaps);
        setTotalCumulativeVolume(cumulativeVolume);
      }
    };

    fetchSwaps();

    const channel = supabase.channel('ecosystem-hub-swaps')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'token_swaps' }, async (payload) => {
        const s = payload.new;
        const sVolume = Number(s.usdc_amount || 0);
        
        const { data: tokenData } = await supabase
          .from('token_launches')
          .select('ticker')
          .eq('token_address', s.token_address)
          .single();

        const newSwap: SwapTx = {
          hash: s.id || `live_${Date.now()}`,
          isBuy: s.is_buy,
          ticker: tokenData?.ticker || 'UNKNOWN',
          amount: Number(s.token_amount || 0),
          volume: sVolume,
          timestamp: new Date(s.created_at).getTime(),
          token_address: s.token_address
        };
        
        setSwaps(prev => [newSwap, ...prev].slice(0, 50));
        setTotalCumulativeVolume(prev => prev + sVolume);
      })
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  // ── On-Chain Web3 Event Sync (getContractEvents & watchContractEvent) ──
  useEffect(() => {
    if (!publicClient) return;

    let unwatchTokens: (() => void) | undefined;
    let unwatchSwaps: (() => void) | undefined;

    const syncOnChainEvents = async () => {
      try {
        // 1. Fetch Historical Data
        const [pastTokens, pastSwaps] = await Promise.all([
          publicClient.getContractEvents({
            address: ECOSYSTEM_FACTORY_ADDRESS as `0x${string}`,
            abi: ecosystemFactoryAbi,
            eventName: 'TokenCreated',
            fromBlock: BigInt(0),
          }),
          publicClient.getContractEvents({
            address: ECOSYSTEM_ROUTER_ADDRESS as `0x${string}`,
            abi: ecosystemRouterAbi,
            eventName: 'Swap',
            fromBlock: BigInt(0),
          })
        ]);

        // Process Historical Tokens
        const historicalTokens = pastTokens.map(log => ({
          id: log.args.tokenAddress as string,
          token_address: log.args.tokenAddress as string,
          name: log.args.name || 'Unknown',
          ticker: log.args.ticker || '???',
          image_url: null,
          holders: 0,
          priceChange: '0.00',
          type: 'ERC-20',
          _source: 'arcomni' as const,
          _holdersRaw: 0
        }));

        if (historicalTokens.length > 0) {
          setAllTokens(prev => [...historicalTokens, ...prev]);
        }

        // 2. Seamlessly Chain Real-Time Subscriptions
        unwatchTokens = publicClient.watchContractEvent({
          address: ECOSYSTEM_FACTORY_ADDRESS as `0x${string}`,
          abi: ecosystemFactoryAbi,
          eventName: 'TokenCreated',
          onLogs: (logs) => {
            const liveTokens = logs.map(log => ({
              id: log.args.tokenAddress as string,
              token_address: log.args.tokenAddress as string,
              name: log.args.name || 'New Token',
              ticker: log.args.ticker || 'NEW',
              image_url: null,
              holders: 0,
              priceChange: '0.00',
              type: 'ERC-20',
              _source: 'arcomni' as const,
              _holdersRaw: 0
            }));

            setAllTokens(prev => {
              const existingIds = new Set(prev.map(p => p.token_address.toLowerCase()));
              const newUniques = liveTokens.filter(t => !existingIds.has(t.token_address.toLowerCase()));
              return [...newUniques, ...prev];
            });
            toast.success(`New token deployed: ${liveTokens[0]?.ticker}`);
          }
        });

      } catch (err) {
        console.error("On-chain event sync failed:", err);
      }
    };

    syncOnChainEvents();

    return () => {
      if (unwatchTokens) unwatchTokens();
      if (unwatchSwaps) unwatchSwaps();
    };
  }, [publicClient]);

  // ── Handlers ─────────────────────────────────────────────────────────
  const handleSelectToken = async (token: UnifiedToken) => {
    if (token._source === 'arcomni') {
      // Re-fetch full DB object for PriceChart
      const { data: dbToken } = await supabase
        .from('token_launches')
        .select('*')
        .eq('token_address', token.token_address)
        .single();
      
      if (dbToken) {
        setSelectedToken(dbToken);
        toast.success(`Loaded ${dbToken.ticker}`);
      }
    } else {
      setSelectedToken({
        token_address: token.token_address,
        name: token.name,
        ticker: token.ticker,
        image_url: token.image_url,
        decimals: token.decimals,
        holders_count: token.holders,
        total_supply: token.total_supply,
        _isExternalToken: true
      });
      toast(`${token.ticker} loaded — External token`, { icon: '🌐' });
    }
  };

  const handleSwapExecute = async () => {
    if (!isConnected) return toast.error("Please connect your wallet");
    if (!selectedToken) return toast.error("Select a token first");
    if (selectedToken._isExternalToken) return toast.error("External tokens cannot be traded through this router");
    if (!swapAmount || Number(swapAmount) <= 0) return toast.error("Enter a valid amount");

    setIsSwapping(true);
    try {
      let anchorAddress = ECOSYSTEM_USDC_ADDRESS;
      let decimals = 6;
      if (baseAnchor === 'EURC') { anchorAddress = ECOSYSTEM_EURC_ADDRESS; decimals = 6; }
      if (baseAnchor === 'crBTC') { anchorAddress = ECOSYSTEM_CRBTC_ADDRESS; decimals = 8; }

      const tokenIn = swapDirection === 'BUY' ? anchorAddress : selectedToken.token_address;
      const tokenOut = swapDirection === 'BUY' ? selectedToken.token_address : anchorAddress;
      const amountInWei = parseUnits(swapAmount, swapDirection === 'BUY' ? decimals : 18);
      const estimatedOutput = Number(swapAmount);

      toast.loading("Approving...", { id: 'swap-toast' });
      const approveTx = await writeContractAsync({
        address: tokenIn as `0x${string}`,
        abi: erc20Abi,
        functionName: 'approve',
        args: [ARC_DEFI_ROUTER_ADDRESS as `0x${string}`, amountInWei],
      });
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash: approveTx });

      toast.loading("Executing Swap via ArcDefiRouter...", { id: 'swap-toast' });
      const path = [tokenIn as `0x${string}`, tokenOut as `0x${string}`];
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20);

      const swapTx = await writeContractAsync({
        address: ARC_DEFI_ROUTER_ADDRESS as `0x${string}`,
        abi: arcDefiRouterAbi,
        functionName: 'swapExactTokensForTokens',
        args: [amountInWei, BigInt(0), path, address as `0x${string}`, deadline],
      });
      
      if (publicClient) await publicClient.waitForTransactionReceipt({ hash: swapTx });

      const swapData = {
        user_address: address?.toLowerCase(),
        token_address: selectedToken.token_address.toLowerCase(),
        usdc_amount: swapDirection === 'BUY' ? Number(swapAmount) : estimatedOutput,
        token_amount: swapDirection === 'BUY' ? estimatedOutput : Number(swapAmount),
        is_buy: swapDirection === 'BUY',
        type: swapDirection === 'BUY' ? 'buy' : 'sell'
      };

      await supabase.from('token_swaps').insert(swapData);
      toast.success("Swap Executed Successfully!", { id: 'swap-toast' });
      setSwapAmount('');
    } catch (e: any) {
      console.error(e);
      toast.error(e.shortMessage || e.message || "Swap failed", { id: 'swap-toast' });
    } finally {
      setIsSwapping(false);
    }
  };

  const formatHolders = (count: string | number) => {
    const n = Number(count);
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n.toString();
  };
  const truncateAddr = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* ═══ Header ═══ */}
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
                Unified Token Terminal
              </p>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex gap-4 flex-wrap">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-sm min-w-[160px]">
            <p className="text-[10px] font-black uppercase text-[var(--text-secondary)] tracking-widest mb-1">Tokens Indexed</p>
            <span className="text-2xl font-black text-[var(--text-primary)]">{allTokens.length}+</span>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-sm min-w-[200px]">
            <p className="text-[10px] font-black uppercase text-[var(--text-secondary)] tracking-widest mb-1">Ecosystem Vol</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-[var(--text-primary)]">${totalCumulativeVolume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span className="text-xs font-bold text-emerald-500 flex items-center"><TrendingUp size={12} className="mr-0.5" /> Live</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ 3-Column Layout ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* ──── LEFT: Unified On-Chain Explorer (5 cols) ──── */}
        <div className="lg:col-span-5 space-y-4">
          <div className="card rounded-[24px] shadow-sm border border-[var(--border-dim)] bg-white p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Zap size={18} className="text-amber-500" />
              <h3 className="font-extrabold text-[var(--text-primary)] text-lg flex-1">Global Token Explorer</h3>
              <div className="text-[10px] font-bold px-2 py-1 bg-emerald-100 text-emerald-700 rounded uppercase tracking-widest flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span> Live
              </div>
            </div>

            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search ArcOmni & External tokens..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-[var(--border-dim)] rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium outline-none focus:border-[var(--accent-cyan)] transition-colors"
              />
            </div>

            <div className="flex gap-2">
              {(['ALL', 'ERC-20', 'ERC-721'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setTokenTypeFilter(type)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    tokenTypeFilter === type 
                      ? 'bg-[rgba(0,242,254,0.05)] border-[var(--accent-cyan)] text-[var(--accent-cyan)]' 
                      : 'bg-white border-[var(--border-dim)] text-[var(--text-secondary)] hover:border-slate-300'
                  }`}
                >
                  {type === 'ALL' ? '🌐 All' : type === 'ERC-20' ? '🪙 ERC-20' : '🖼️ ERC-721'}
                </button>
              ))}
            </div>
          </div>

          <div className="card rounded-[24px] shadow-sm border border-[var(--border-dim)] bg-white overflow-hidden">
            <div className="max-h-[700px] overflow-y-auto custom-scrollbar">
              {isLoadingTokens ? (
                <div className="flex flex-col items-center justify-center py-20 text-[var(--text-secondary)] gap-2">
                  <Loader2 size={28} className="animate-spin text-[var(--accent-cyan)]" />
                  <p className="text-xs font-semibold">Indexing Arc Chain...</p>
                </div>
              ) : filteredTokens.length === 0 ? (
                <div className="text-center py-16 text-[var(--text-secondary)]">
                  <Search size={32} className="mx-auto mb-3 text-slate-300" />
                  <p className="text-sm font-bold">No tokens found</p>
                </div>
              ) : (
                <AnimatePresence>
                  {filteredTokens.map((token, idx) => {
                    const isSelected = selectedToken?.token_address === token.token_address;
                    return (
                      <motion.div
                        key={token.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={() => handleSelectToken(token)}
                        className={`flex items-center justify-between px-5 py-4 border-b border-[var(--border-dim)] hover:bg-slate-50 transition-colors cursor-pointer group ${
                          isSelected ? 'bg-blue-50/60 border-l-4 border-l-[var(--accent-cyan)]' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center font-bold text-xs text-indigo-700 border border-indigo-200 overflow-hidden flex-shrink-0">
                            {token.image_url ? (
                              <img src={token.image_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              (token.ticker || '??').substring(0, 2).toUpperCase()
                            )}
                          </div>
                          
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                              {token.is_pinned && <span className="text-[8px] bg-amber-500 text-white px-1.5 py-0.5 rounded font-black">📌 Pinned</span>}
                              <span className="font-extrabold text-sm text-[var(--text-primary)] truncate">{token.name}</span>
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-[var(--text-secondary)]">{token.ticker}</span>
                              
                              {token._source === 'arcomni' ? (
                                <span className="text-[8px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider">ArcOmni</span>
                              ) : (
                                <span className="text-[8px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider flex items-center gap-0.5"><Globe size={8}/> On-Chain</span>
                              )}
                              {token.type === 'ERC-721' && <span className="text-[8px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full font-black">ERC-721</span>}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-mono text-[var(--text-secondary)]">{truncateAddr(token.token_address)}</span>
                              <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(token.token_address); toast.success("Copied!"); }} className="text-[var(--text-secondary)] hover:text-[var(--accent-cyan)]"><Copy size={10} /></button>
                              {token._source === 'arcscan' && (
                                <a href={`${ARCSCAN_EXPLORER}/token/${token.token_address}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-[var(--text-secondary)] hover:text-[var(--accent-cyan)]"><ExternalLink size={10} /></a>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <div className="flex items-center gap-1 justify-end mb-0.5">
                            <Users size={12} className="text-[var(--accent-cyan)]" />
                            <span className="text-xs font-black text-[var(--text-primary)]">{formatHolders(token.holders)}</span>
                          </div>
                          {token._source === 'arcomni' && (
                            <div className="text-[10px] font-extrabold flex items-center justify-end gap-0.5" style={{ color: Number(token.priceChange) >= 0 ? '#10b981' : '#f43f5e' }}>
                              {Number(token.priceChange) >= 0 ? '+' : ''}{token.priceChange}% <ArrowUpRight size={10} className={Number(token.priceChange) >= 0 ? 'rotate-0' : 'rotate-90'} />
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}

              {hasMoreTokens && !isLoadingTokens && (
                <div className="p-4 text-center">
                  <button onClick={() => fetchUnifiedTokens(nextPageParams)} disabled={isLoadingMore} className="px-6 py-2.5 rounded-xl text-xs font-black text-[var(--accent-cyan)] bg-[rgba(0,242,254,0.05)] border border-[var(--accent-cyan)] hover:bg-[rgba(0,242,254,0.1)] transition-all flex items-center gap-2 mx-auto">
                    {isLoadingMore ? <><Loader2 size={14} className="animate-spin" /> Loading...</> : <><ChevronDown size={14} /> Load More From ArcScan</>}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ──── CENTER: Chart & Swap Stream (4 cols) ──── */}
        <div className="lg:col-span-4 space-y-6">
          <div className="card rounded-[24px] shadow-sm border border-[var(--border-dim)] bg-white overflow-hidden min-h-[400px]">
            <PriceChart selectedToken={selectedToken} />
          </div>

          <div className="card rounded-[24px] shadow-sm border border-[var(--border-dim)] overflow-hidden bg-white">
            <div className="p-4 border-b border-[var(--border-dim)] bg-slate-50/50 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-emerald-500" />
                <h3 className="font-extrabold text-[var(--text-primary)] text-sm">Global Swap Stream</h3>
              </div>
            </div>
            <div className="p-3 space-y-2 max-h-[260px] overflow-y-auto custom-scrollbar">
              <AnimatePresence>
                {swaps.length === 0 ? (
                  <div className="text-center py-8 text-[var(--text-secondary)] font-medium">
                    <Loader2 size={20} className="mx-auto mb-2 animate-spin text-slate-300" />
                    <p className="text-xs">Listening for live swaps...</p>
                  </div>
                ) : (
                  swaps.slice(0, 15).map((swap, idx) => (
                    <motion.div key={swap.hash + idx} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center justify-between p-2.5 rounded-xl border border-[var(--border-dim)] bg-slate-50/50 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-[10px] ${swap.isBuy ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                          {swap.isBuy ? 'BUY' : 'SELL'}
                        </div>
                        <div>
                          <div className="font-bold text-xs text-[var(--text-primary)]">
                            {swap.amount.toLocaleString()} <span className="font-black">{swap.ticker}</span>
                          </div>
                          <div className="text-[10px] text-[var(--text-secondary)]">{new Date(swap.timestamp).toLocaleTimeString()}</div>
                        </div>
                      </div>
                      <div className="font-black text-xs text-[var(--text-primary)]">${swap.volume.toFixed(2)}</div>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* ──── RIGHT: Fast Routing Panel (3 cols) ──── */}
        <div className="lg:col-span-3">
          <div className="sticky top-8 space-y-6">
            
            <div className="card rounded-[24px] shadow-sm border border-[var(--border-dim)] overflow-hidden bg-white p-5 relative">
              <h3 className="font-extrabold text-[var(--text-primary)] text-base mb-5 flex items-center gap-2">
                <ArrowRightLeft size={16} className="text-[var(--accent-cyan)]" /> Fast Routing
              </h3>

              {!selectedToken ? (
                <div className="text-center py-10 px-4 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
                  <Search size={28} className="mx-auto text-slate-300 mb-3" />
                  <p className="text-sm font-bold text-[var(--text-secondary)]">Select a token to trade</p>
                </div>
              ) : selectedToken._isExternalToken ? (
                <div className="text-center py-10 px-4 border-2 border-dashed border-amber-200 rounded-2xl bg-amber-50">
                  <Globe size={28} className="mx-auto text-amber-400 mb-3" />
                  <p className="text-sm font-bold text-amber-700">External Token</p>
                  <p className="text-xs text-amber-600 mt-1">Trading only available for ArcOmni tokens</p>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-blue-50/50 border border-blue-100">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center font-bold text-xs text-indigo-700 overflow-hidden">
                      {selectedToken.image_url ? <img src={selectedToken.image_url} alt="" className="w-full h-full object-cover" /> : selectedToken.ticker.substring(0, 2)}
                    </div>
                    <div>
                      <div className="font-black text-sm text-[var(--text-primary)]">{selectedToken.name} <span className="text-[10px] text-[var(--text-secondary)]">{selectedToken.ticker}</span></div>
                      <div className="text-[9px] font-mono text-[var(--text-secondary)]">{truncateAddr(selectedToken.token_address)}</div>
                    </div>
                  </div>

                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button onClick={() => setSwapDirection('BUY')} className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${swapDirection === 'BUY' ? 'bg-white text-emerald-600 shadow-sm border border-emerald-100' : 'text-[var(--text-secondary)]'}`}>BUY</button>
                    <button onClick={() => setSwapDirection('SELL')} className={`flex-1 py-2 rounded-lg text-xs font-black transition-all ${swapDirection === 'SELL' ? 'bg-white text-rose-600 shadow-sm border border-rose-100' : 'text-[var(--text-secondary)]'}`}>SELL</button>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-[var(--text-secondary)]">Pay With</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['USDC', 'EURC', 'crBTC'] as const).map(a => (
                        <button key={a} onClick={() => setBaseAnchor(a)} className={`py-1.5 rounded-lg text-[10px] font-bold border transition-all ${baseAnchor === a ? 'bg-[rgba(0,242,254,0.05)] border-[var(--accent-cyan)] text-[var(--accent-cyan)]' : 'bg-white border-[var(--border-dim)] text-[var(--text-secondary)]'}`}>{a}</button>
                      ))}
                    </div>
                  </div>

                  <div className="relative">
                    <input type="number" value={swapAmount} onChange={(e) => setSwapAmount(e.target.value)} placeholder="0.0" className="w-full bg-slate-50 border border-[var(--border-dim)] rounded-xl px-4 py-3 text-base font-bold outline-none focus:border-[var(--accent-cyan)] transition-colors pr-16" />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-[var(--text-secondary)] bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                      {swapDirection === 'BUY' ? baseAnchor : selectedToken.ticker}
                    </div>
                  </div>

                  <button 
                    onClick={handleSwapExecute}
                    disabled={isSwapping || !swapAmount || Number(swapAmount) <= 0}
                    className={`w-full py-3.5 rounded-xl text-xs font-black tracking-wider uppercase transition-all shadow-lg flex items-center justify-center gap-2 ${
                      isSwapping || !swapAmount || Number(swapAmount) <= 0
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                        : swapDirection === 'BUY' 
                          ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/25' 
                          : 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/25'
                    }`}
                  >
                    {isSwapping ? <><Loader2 size={16} className="animate-spin" /> Routing...</> : <>Execute {swapDirection}</>}
                  </button>
                </div>
              )}
            </div>

            <div className="card rounded-[24px] shadow-sm border border-[var(--border-dim)] overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800 p-5 text-white relative">
              <div className="absolute top-0 right-0 p-4 opacity-10"><Globe size={60} /></div>
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Network Connectivity</h4>
              <div className="space-y-3 relative z-10">
                <div>
                  <div className="text-[9px] text-slate-400 font-bold">Arc Defi Router</div>
                  <div className="font-mono text-xs text-blue-300 mt-0.5 break-all">{ARC_DEFI_ROUTER_ADDRESS}</div>
                </div>
                <div>
                  <div className="text-[9px] text-slate-400 font-bold">Latency</div>
                  <div className="font-black text-emerald-400 text-sm flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> 12ms (Optimal)
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
