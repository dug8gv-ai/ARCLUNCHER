'use client';

import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, CrosshairMode } from 'lightweight-charts';
import { Activity, BarChart3, Users, DollarSign, TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface PriceChartProps {
  selectedToken?: any;
}

// Smart price formatter — shows enough decimals for any magnitude
// e.g.  0.000000003  →  "$0.000000003"
//       0.00045      →  "$0.00045"
//       1.2345       →  "$1.2345"
function formatSmartPrice(price: number): string {
  if (price === 0) return '0';
  const abs = Math.abs(price);
  if (abs >= 1)        return price.toFixed(4);
  if (abs >= 0.01)     return price.toFixed(6);
  if (abs >= 0.000001) return price.toFixed(9);
  const decimals = Math.max(2, Math.ceil(-Math.log10(abs)) + 4);
  return price.toFixed(Math.min(decimals, 20));
}

// USD formatter for FDV / MCAP — handles any size cleanly
// e.g.  20000  →  "20,000"   |  1500000  →  "1.50M"  |  0.5  →  "0.5000"
function formatUSD(value: number): string {
  if (value === 0) return '0';
  if (value >= 1_000_000_000) return (value / 1_000_000_000).toFixed(2) + 'B';
  if (value >= 1_000_000)     return (value / 1_000_000).toFixed(2) + 'M';
  if (value >= 1_000)         return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (value >= 1)             return value.toFixed(2);
  return value.toFixed(4);
}

export function PriceChart({ selectedToken }: PriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  const [timeframe, setTimeframe] = useState<'1m' | '15m' | '1h' | '1D'>('1m');

  const [metrics, setMetrics] = useState({
    mcap: '0',
    fdv: '0',
    holders: '0',
    volume: '0',
    price: '0'
  });

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#ffffff' },
        textColor: '#64748b',
      },
      grid: {
        vertLines: { color: '#e2e8f0' },
        horzLines: { color: '#e2e8f0' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { width: 1, color: '#3b82f6', style: 3 },
        horzLine: { width: 1, color: '#3b82f6', style: 3 },
      },
      rightPriceScale: {
        borderColor: '#e2e8f0',
        scaleMargins: { top: 0.1, bottom: 0.3 },
      },
      timeScale: {
        borderColor: '#e2e8f0',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScale: {
        axisPressedMouseMove: { time: true, price: true },
      },
      // ── SMART PRICE FORMATTER ──────────────────────────────────────────
      // Automatically shows enough decimal places for any price magnitude.
      // e.g.  0.000000003  →  "0.000000003"
      //       0.00045      →  "0.00045"
      //       1.23         →  "1.23"
      // ──────────────────────────────────────────────────────────────────
      localization: {
        priceFormatter: (price: number) => {
          if (price === 0) return '0';
          const abs = Math.abs(price);
          if (abs >= 1)        return price.toFixed(4);
          if (abs >= 0.01)     return price.toFixed(6);
          if (abs >= 0.000001) return price.toFixed(9);
          // Very small prices — use enough decimals to show non-zero digits
          const decimals = Math.max(2, Math.ceil(-Math.log10(abs)) + 4);
          return price.toFixed(Math.min(decimals, 20));
        },
      },
    });

    chartRef.current = chart;

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
      // Use enough decimal precision for very small token prices
      priceFormat: {
        type: 'custom',
        formatter: (price: number) => {
          if (price === 0) return '0';
          const abs = Math.abs(price);
          if (abs >= 1)        return price.toFixed(4);
          if (abs >= 0.01)     return price.toFixed(6);
          if (abs >= 0.000001) return price.toFixed(9);
          const decimals = Math.max(2, Math.ceil(-Math.log10(abs)) + 4);
          return price.toFixed(Math.min(decimals, 20));
        },
        minMove: 0.000000000001,
      },
    });
    candleSeriesRef.current = candleSeries;

    // Floor price line is set dynamically inside fetchChartData
    // once we know the real initial price from the token's supply

    const volumeSeries = chart.addHistogramSeries({
      color: '#3b82f6',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '', // overlay
    });

    chart.priceScale('').applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });
    volumeSeriesRef.current = volumeSeries;

    const fetchChartData = async () => {
      if (!selectedToken) return;
      
      const addr = selectedToken.token_address.toLowerCase();

      const { data: swaps, error } = await supabase
        .from('token_swaps')
        .select('*')
        .eq('token_address', addr)
        .order('timestamp', { ascending: true });

      if (error) {
        console.error("Error fetching swaps:", error);
        return;
      }

      // ── REAL MARKET PRICE CALCULATION ─────────────────────────────────
      // Listing Price = Actual Liquidity / Total Supply
      //
      // Example: If token launches with 3 USDC liquidity and 1B supply:
      //   Price = 3 / 1,000,000,000 = 0.000000003 USDC per token
      //
      // Chart shows real price movements based on buy/sell volume
      // – As buys happen: price goes UP (more USDC in pool)
      // – As sells happen: price goes DOWN (less USDC in pool)
      // ─────────────────────────────────────────────────────────────────────
      
      // Get actual initial liquidity from token data (default to 3 USDC if not set)
      const INITIAL_LIQUIDITY_USDC = Number(
        selectedToken.initial_liquidity || 
        selectedToken.liquidity || 
        3  // Default: 3 USDC (real launch amount)
      );

      const totalSupply = Number(
        selectedToken.initial_supply || selectedToken.supply || 1_000_000_000
      );

      // REAL LISTING PRICE = Liquidity / Supply
      // This is the true initial price based on AMM formula: price = k/x where k is constant product
      const INITIAL_PRICE = INITIAL_LIQUIDITY_USDC / totalSupply;

      // Draw the floor price line on the chart using the real initial price
      candleSeries.createPriceLine({
        price: INITIAL_PRICE,
        color: '#94a3b8',
        lineWidth: 2,
        lineStyle: 2, // Dashed
        axisLabelVisible: true,
        title: 'Floor Price',
      });

      // Virtual pool starts with ACTUAL initial liquidity amounts
      // Pool balance = INITIAL_LIQUIDITY_USDC of USDC and totalSupply tokens
      // Constant product: k = USDC × Tokens (stays constant through trades)
      const VIRTUAL_USDC   = INITIAL_LIQUIDITY_USDC;
      const VIRTUAL_TOKENS = totalSupply;
      const k = VIRTUAL_USDC * VIRTUAL_TOKENS;

      let currentUSDC   = VIRTUAL_USDC;
      let currentTokens = VIRTUAL_TOKENS;

      const swapsWithSpotPrice = swaps?.map(s => {
        const usdcAmount   = Number(s.usdc_amount);
        const tokenAmount  = Number(s.token_amount);

        if (s.is_buy) {
          // No damping — chart matches real pool math exactly
          currentUSDC   += usdcAmount;
          currentTokens -= tokenAmount;
        } else {
          currentUSDC   -= usdcAmount;
          currentTokens += tokenAmount;
        }

        // Floor protection: pool reserves never go below initial values
        if (currentUSDC   < VIRTUAL_USDC)   currentUSDC   = VIRTUAL_USDC;
        if (currentTokens > VIRTUAL_TOKENS) currentTokens = VIRTUAL_TOKENS;
        if (currentTokens <= 0) currentTokens = 1;

        const spotPrice = currentUSDC / currentTokens;

        return { ...s, spotPrice: Math.max(INITIAL_PRICE, spotPrice) };
      }) || [];

      let candles: any[] = [];
      let volumes: any[] = [];

      if (swapsWithSpotPrice.length > 0) {
        let bucketMs = 60000;
        if (timeframe === '1m') bucketMs = 60000;
        else if (timeframe === '15m') bucketMs = 15 * 60000;
        else if (timeframe === '1h') bucketMs = 60 * 60000;
        else if (timeframe === '1D') bucketMs = 24 * 60 * 60000;

        const groupedByBucket: { [key: number]: any[] } = {};
        
        swapsWithSpotPrice.forEach(swap => {
          const ts = swap.timestamp || swap.created_at;
          const time = Math.floor(new Date(ts).getTime() / bucketMs) * (bucketMs / 1000);
          if (isNaN(time)) return;
          
          if (!groupedByBucket[time]) groupedByBucket[time] = [];
          groupedByBucket[time].push(swap);
        });

        const sortedBuckets = Object.keys(groupedByBucket).map(Number).sort((a, b) => a - b);
        
        for (let i = 0; i < sortedBuckets.length; i++) {
          const time = sortedBuckets[i];
          const bucketSwaps = groupedByBucket[time];
          
          const prices = bucketSwaps.map(s => s.spotPrice);
          if (prices.length === 0) continue;

          const openPrice = candles.length === 0 ? INITIAL_PRICE : candles[candles.length - 1].close;
          const closePrice = prices[prices.length - 1];
          
          let high = Math.max(openPrice, closePrice, ...prices);
          let low = Math.min(openPrice, closePrice, ...prices);

          const bucketVolume = bucketSwaps.reduce((acc, s) => acc + Number(s.usdc_amount), 0);
          const isGreen = closePrice >= openPrice;

          candles.push({
            time: time as any,
            open: openPrice,
            high: high,
            low: low,
            close: closePrice
          });

          volumes.push({
            time: time as any,
            value: bucketVolume,
            color: isGreen ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)',
          });
        }
      }

      if (candles.length === 0) {
        const launchTime = Math.floor(new Date(selectedToken.timestamp || selectedToken.created_at || Date.now()).getTime() / 60000) * 60;
        const fallbackTime = (isNaN(launchTime) ? Math.floor(Date.now() / 60000) * 60 : launchTime) as any;
        // Fallback candle uses the real initial price derived from pool math
        const fp = INITIAL_PRICE;
        candles = [{
          time: fallbackTime,
          open: fp, high: fp * 1.01, low: fp, close: fp * 1.005
        }];
        volumes = [{
          time: fallbackTime,
          value: 0,
          color: 'rgba(34, 197, 94, 0.4)',
        }];
      }

      candleSeries.setData(candles);
      volumeSeries.setData(volumes);
      chart.timeScale().fitContent();

      // ── METRICS: use same pool math as chart (no separate replay needed) ─
      // Both chart and metrics now share the same undamped pool state.
      // ─────────────────────────────────────────────────────────────────────
      let realUSDC   = VIRTUAL_USDC;   // starts at 20,000
      let realTokens = VIRTUAL_TOKENS; // starts at totalSupply

      swaps?.forEach(s => {
        if (s.is_buy) {
          realUSDC   += Number(s.usdc_amount);
          realTokens -= Number(s.token_amount);
        } else {
          realUSDC   -= Number(s.usdc_amount);
          realTokens += Number(s.token_amount);
        }
      });

      // Floor protection
      if (realUSDC   < VIRTUAL_USDC)   realUSDC   = VIRTUAL_USDC;
      if (realTokens > VIRTUAL_TOKENS) realTokens = VIRTUAL_TOKENS;
      if (realTokens <= 0)             realTokens = 1;

      const realCurrentPrice = realUSDC / realTokens;
      const latestPrice = Math.max(INITIAL_PRICE, realCurrentPrice);

      const totalVolume = swaps?.reduce((acc, s) => acc + Number(s.usdc_amount), 0) || 0;
      const uniqueHolders = new Set(swaps?.map(s => s.user_address)).size || 1;

      // FDV = current real price × total supply
      const mcap = latestPrice * totalSupply;

      setMetrics({
        mcap: formatUSD(mcap),
        fdv:  formatUSD(mcap),
        holders: uniqueHolders.toString(),
        volume: totalVolume.toLocaleString(undefined, { maximumFractionDigits: 2 }),
        price: formatSmartPrice(latestPrice),
      });
    }

    fetchChartData();

    // 3. REAL-TIME CHART UPDATES
    const channel = supabase.channel(`chart_swaps_${selectedToken?.token_address}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'token_swaps',
        filter: `token_address=eq.${selectedToken?.token_address?.toLowerCase()}`
      }, () => {
        fetchChartData();
      })
      .subscribe();

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      supabase.removeChannel(channel);
    };
  }, [selectedToken, timeframe]); // Re-run when timeframe changes

  return (
    <div className="glass-panel p-6 card">
      {/* Header & Metrics */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-4 border-b border-[var(--border-dim)] pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[rgba(0,242,254,0.05)] border border-[var(--border-dim)] flex items-center justify-center overflow-hidden">
            {selectedToken?.image_url ? (
              <img src={selectedToken.image_url} alt="" className="w-full h-full object-contain p-0.5" />
            ) : (
              <TrendingUp className="text-[var(--accent-cyan)]" />
            )}
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-[var(--text-primary)] flex items-center gap-2 leading-none mb-1">
              {selectedToken ? `${selectedToken.ticker}/USDC` : 'Select a Token'}
              {selectedToken && (
                <span className="text-[var(--accent-cyan)] text-[10px] font-black bg-[rgba(0,242,254,0.05)] px-2 py-0.5 rounded border border-[var(--border-dim)] uppercase tracking-tighter">
                  Live
                </span>
              )}
            </h2>
            <p className="text-[var(--text-secondary)] text-xs font-semibold">{selectedToken?.name || 'Launchpad Market View'}</p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard icon={<Activity size={12} />} label="MCAP" value={`$${metrics.mcap}`} color="text-[var(--accent-cyan)]" />
          <MetricCard icon={<BarChart3 size={12} />} label="FDV" value={`$${metrics.fdv}`} color="text-indigo-600" />
          <MetricCard icon={<Users size={12} />} label="HOLDERS" value={metrics.holders} color="text-amber-600" />
          <MetricCard icon={<DollarSign size={12} />} label="VOLUME" value={`$${metrics.volume}`} color="text-emerald-600" />
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        {['1m', '15m', '1h', '1D'].map(tf => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf as any)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${timeframe === tf ? 'bg-[rgba(0,242,254,0.05)] text-[var(--accent-cyan)] border border-[var(--border-dim)]' : 'bg-slate-100/80 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-slate-200/80'}`}
          >
            {tf}
          </button>
        ))}
      </div>

      {/* Chart Area */}
      <div ref={chartContainerRef} className="w-full relative min-h-[400px]">
        {!selectedToken && (
          <div className="absolute inset-0 z-10 bg-slate-50/95 backdrop-blur-[2px] flex items-center justify-center rounded-2xl border border-dashed border-[var(--border-dim)]">
            <div className="text-center p-6 space-y-2">
              <BarChart3 className="text-slate-300 mx-auto mb-2" size={42} />
              <p className="text-[var(--text-secondary)] font-bold text-sm">No token selected</p>
              <p className="text-[var(--text-secondary)] text-xs font-medium max-w-xs mx-auto">Select a live market from the leaderboard on the right to load trading history</p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-4 text-[10px] text-[var(--text-secondary)] font-mono font-bold">
        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live Data</span>
        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[rgba(0,242,254,0.05)]0" /> Arc Testnet</span>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, color }: { icon: any, label: string, value: string, color: string }) {
  return (
    <div className="bg-[rgba(6,10,38,0.9)] border border-[var(--border-dim)] rounded-xl p-2.5 px-4 min-w-[100px] shadow-sm">
      <div className="flex items-center gap-1.5 text-[9px] text-[var(--text-secondary)] font-black uppercase mb-1 tracking-wider">
        {icon} {label}
      </div>
      <div className={`text-xs font-mono font-bold ${color}`}>{value}</div>
    </div>
  );
}
