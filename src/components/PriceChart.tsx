'use client';

import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi } from 'lightweight-charts';
import { Activity, BarChart3, Users, DollarSign, TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface PriceChartProps {
  selectedToken?: any;
}

export function PriceChart({ selectedToken }: PriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

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
        background: { color: 'transparent' },
        textColor: '#9ca3af',
        fontSize: 10,
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          width: 1,
          color: '#22d3ee',
          style: 3,
        },
        horzLine: {
          width: 1,
          color: '#22d3ee',
          style: 3,
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScale: {
        axisPressedMouseMove: { time: true, price: true },
      },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    const fetchChartData = async () => {
      if (!selectedToken) return;
      
      const addr = selectedToken.token_address.toLowerCase();
      console.log("Fetching Chart Data for:", addr);

      const { data: swaps, error } = await supabase
        .from('token_swaps')
        .select('*')
        .eq('token_address', addr)
        .order('timestamp', { ascending: true });

      if (error) {
        console.error("Error fetching swaps:", error);
        return;
      }

      console.log("Total Swaps Found:", swaps?.length || 0);

      // Convert swaps to 1-minute OHLC candles
      let candles: any[] = [];
      if (swaps && swaps.length > 0) {
        const groupedByMinute: { [key: number]: any[] } = {};
        
        swaps.forEach(swap => {
          const ts = swap.timestamp || swap.created_at;
          const time = Math.floor(new Date(ts).getTime() / 60000) * 60;
          if (isNaN(time)) return;
          
          if (!groupedByMinute[time]) groupedByMinute[time] = [];
          groupedByMinute[time].push(swap);
        });

        const sortedMinutes = Object.keys(groupedByMinute).map(Number).sort((a, b) => a - b);
        
        candles = sortedMinutes.map((time, i) => {
          const minuteSwaps = groupedByMinute[time];
          // STRICT 0.01 FLOOR
          const prices = minuteSwaps.map(s => {
            const p = Number(s.usdc_amount / s.token_amount);
            return p < 0.01 ? 0.01 : p;
          }).filter(p => !isNaN(p) && p > 0);
          
          if (prices.length === 0) return null;

          const openPrice = i === 0 ? 0.01 : candles[i-1].close;
          const closePrice = Math.max(0.01, prices[prices.length - 1]);

          return {
            time: time as any,
            open: openPrice,
            high: Math.max(openPrice, closePrice, ...prices),
            low: Math.min(openPrice, closePrice, ...prices),
            close: closePrice
          };
        }).filter(c => c !== null);
      }

      // If no candles, add a placeholder "Launch Green Candle" at 0.01
      if (candles.length === 0) {
        const launchTime = Math.floor(new Date(selectedToken.timestamp || selectedToken.created_at || Date.now()).getTime() / 60000) * 60;
        candles = [{
          time: (isNaN(launchTime) ? Math.floor(Date.now() / 60000) * 60 : launchTime) as any,
          open: 0.01, high: 0.011, low: 0.01, close: 0.011 
        }];
      }


      candleSeries.setData(candles);
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

    // Subscribe to new swaps
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
  }, [selectedToken]);

  return (
    <div className="glass-panel p-6">
      {/* Header & Metrics */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 border-b border-gray-800 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
            {selectedToken?.image_url ? (
              <img src={selectedToken.image_url} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              <TrendingUp className="text-cyan-400" />
            )}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2 leading-none mb-1">
              {selectedToken ? `${selectedToken.ticker}/USDC` : 'Select a Token'}
              {selectedToken && (
                <span className="text-cyan-400 text-[10px] font-black bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20 uppercase tracking-tighter">
                  Live
                </span>
              )}
            </h2>
            <p className="text-gray-500 text-sm">{selectedToken?.name || 'Launchpad Market View'}</p>
          </div>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard icon={<Activity size={12} />} label="MCAP" value={`$${metrics.mcap}`} color="text-cyan-400" />
          <MetricCard icon={<BarChart3 size={12} />} label="FDV" value={`$${metrics.fdv}`} color="text-purple-400" />
          <MetricCard icon={<Users size={12} />} label="HOLDERS" value={metrics.holders} color="text-yellow-400" />
          <MetricCard icon={<DollarSign size={12} />} label="VOLUME" value={`$${metrics.volume}`} color="text-green-400" />
        </div>
      </div>

      {/* Chart Area */}
      <div ref={chartContainerRef} className="w-full relative min-h-[400px]">
        {!selectedToken && (
          <div className="absolute inset-0 z-10 bg-black/60 backdrop-blur-[2px] flex items-center justify-center rounded-xl border border-dashed border-gray-800">
            <div className="text-center">
              <BarChart3 className="text-gray-700 mx-auto mb-3" size={40} />
              <p className="text-gray-500 font-medium">Select a token from the leaderboard to view chart</p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-4 text-[10px] text-gray-600 font-mono">
        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500" /> Live Data</span>
        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-cyan-500" /> Arc Testnet</span>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, color }: { icon: any, label: string, value: string, color: string }) {
  return (
    <div className="bg-black/30 border border-gray-800/50 rounded-lg p-2.5 px-4 min-w-[100px]">
      <div className="flex items-center gap-1.5 text-[9px] text-gray-500 font-black uppercase mb-1 tracking-wider">
        {icon} {label}
      </div>
      <div className={`text-sm font-mono font-bold ${color}`}>{value}</div>
    </div>
  );
}
