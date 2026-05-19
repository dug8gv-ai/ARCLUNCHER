'use client';

import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, CrosshairMode } from 'lightweight-charts';
import { Activity, BarChart3, Users, DollarSign, TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface PriceChartProps {
  selectedToken?: any;
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
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#64748b', // Slate-500 for high-end readability
      },
      grid: {
        vertLines: { color: '#e2e8f0' }, // Slate-200 grid lines
        horzLines: { color: '#e2e8f0' }, // Slate-200 grid lines
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          width: 1,
          color: '#3b82f6', // Calm blue crosshair
          style: 3,
        },
        horzLine: {
          width: 1,
          color: '#3b82f6', // Calm blue crosshair
          style: 3,
        },
      },
      rightPriceScale: {
        borderColor: '#e2e8f0',
        scaleMargins: { top: 0.1, bottom: 0.3 }, // leave space for volume
      },
      timeScale: {
        borderColor: '#e2e8f0',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScale: {
        axisPressedMouseMove: { time: true, price: true },
      },
    });

    chartRef.current = chart;

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#10b981', // Premium green
      downColor: '#ef4444', // Premium red
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });
    candleSeriesRef.current = candleSeries;

    candleSeries.createPriceLine({
      price: 0.01,
      color: '#94a3b8',
      lineWidth: 2,
      lineStyle: 2, // Dashed
      axisLabelVisible: true,
      title: 'Floor Price',
    });

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

      // 1. THE SYMMETRIC AMM BONDING CURVE LOGIC (MATCHING TRADING PANEL)
      const VIRTUAL_USDC = 100;
      const VIRTUAL_TOKENS = VIRTUAL_USDC / 0.01; // 10,000 tokens virtual supply
      const k = VIRTUAL_USDC * VIRTUAL_TOKENS;

      let currentUSDC = VIRTUAL_USDC;
      let currentTokens = VIRTUAL_TOKENS;

      const swapsWithSpotPrice = swaps?.map(s => {
        const usdcAmount = Number(s.usdc_amount);
        const tokenAmount = Number(s.token_amount);

        if (s.is_buy) {
          currentUSDC += usdcAmount;
          currentTokens -= tokenAmount;
        } else {
          currentUSDC -= usdcAmount;
          currentTokens += tokenAmount;
        }

        // Strict Floor Protection (Price never below 0.01)
        if (currentUSDC < VIRTUAL_USDC) currentUSDC = VIRTUAL_USDC;
        if (currentTokens > VIRTUAL_TOKENS) currentTokens = VIRTUAL_TOKENS;

        const spotPrice = currentTokens > 0 ? (currentUSDC / currentTokens) : 0.01;

        return { ...s, spotPrice: Math.max(0.01, spotPrice) };
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

          const openPrice = candles.length === 0 ? 0.01 : candles[candles.length - 1].close;
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
        candles = [{
          time: fallbackTime,
          open: 0.01, high: 0.011, low: 0.01, close: 0.011 
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

      // Update Metrics
      const supply = Number(selectedToken.initial_supply || selectedToken.supply || 1000000000);
      const latestPrice = candles.length > 0 ? candles[candles.length - 1].close : 0.01;
      const totalVolume = swaps?.reduce((acc, s) => acc + Number(s.usdc_amount), 0) || 0;
      const uniqueHolders = new Set(swaps?.map(s => s.user_address)).size || 1;
      const mcap = latestPrice * supply;

      setMetrics({
        mcap: mcap < 1 ? mcap.toFixed(2) : mcap.toLocaleString(undefined, { maximumFractionDigits: 0 }),
        fdv: mcap < 1 ? mcap.toFixed(2) : mcap.toLocaleString(undefined, { maximumFractionDigits: 0 }),
        holders: uniqueHolders.toString(),
        volume: totalVolume.toLocaleString(undefined, { maximumFractionDigits: 2 }),
        price: latestPrice < 0.0001 ? latestPrice.toExponential(4) : latestPrice.toFixed(6)
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
    <div className="glass-panel p-6 bg-white border border-slate-200/80">
      {/* Header & Metrics */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-4 border-b border-slate-100 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center overflow-hidden">
            {selectedToken?.image_url ? (
              <img src={selectedToken.image_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <TrendingUp className="text-blue-500" />
            )}
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2 leading-none mb-1">
              {selectedToken ? `${selectedToken.ticker}/USDC` : 'Select a Token'}
              {selectedToken && (
                <span className="text-blue-600 text-[10px] font-black bg-blue-50 px-2 py-0.5 rounded border border-blue-100 uppercase tracking-tighter">
                  Live
                </span>
              )}
            </h2>
            <p className="text-slate-400 text-xs font-semibold">{selectedToken?.name || 'Launchpad Market View'}</p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard icon={<Activity size={12} />} label="MCAP" value={`$${metrics.mcap}`} color="text-blue-600" />
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
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${timeframe === tf ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'bg-slate-100/80 text-slate-500 hover:text-slate-800 hover:bg-slate-200/80'}`}
          >
            {tf}
          </button>
        ))}
      </div>

      {/* Chart Area */}
      <div ref={chartContainerRef} className="w-full relative min-h-[400px]">
        {!selectedToken && (
          <div className="absolute inset-0 z-10 bg-slate-50/95 backdrop-blur-[2px] flex items-center justify-center rounded-2xl border border-dashed border-slate-200">
            <div className="text-center p-6 space-y-2">
              <BarChart3 className="text-slate-300 mx-auto mb-2" size={42} />
              <p className="text-slate-500 font-bold text-sm">No token selected</p>
              <p className="text-slate-400 text-xs font-medium max-w-xs mx-auto">Select a live market from the leaderboard on the right to load trading history</p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-4 text-[10px] text-slate-400 font-mono font-bold">
        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live Data</span>
        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500" /> Arc Testnet</span>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, color }: { icon: any, label: string, value: string, color: string }) {
  return (
    <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-2.5 px-4 min-w-[100px] shadow-sm">
      <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-black uppercase mb-1 tracking-wider">
        {icon} {label}
      </div>
      <div className={`text-xs font-mono font-bold ${color}`}>{value}</div>
    </div>
  );
}
