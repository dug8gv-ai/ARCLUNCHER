'use client';

import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi } from 'lightweight-charts';
import { Activity, BarChart3, Users, DollarSign, TrendingUp } from 'lucide-react';

interface PriceChartProps {
  selectedToken?: any;
}

export function PriceChart({ selectedToken }: PriceChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  const [metrics, setMetrics] = useState({
    mcap: '12.4k',
    fdv: '45.8k',
    holders: '154',
    volume: '2.1k',
    price: '1.63'
  });

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: 'rgba(30, 41, 59, 0.2)' },
        horzLines: { color: 'rgba(30, 41, 59, 0.2)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
      timeScale: {
        borderColor: 'rgba(30, 41, 59, 0.5)',
        timeVisible: true,
      },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });

    // Generate random realistic data
    const data = [];
    let time = Math.floor(Date.now() / 1000) - 100 * 60;
    let price = 1.0;
    for (let i = 0; i < 100; i++) {
      const open = price;
      const close = open + (Math.random() - 0.45) * 0.1;
      data.push({
        time: time as any,
        open,
        high: Math.max(open, close) + Math.random() * 0.05,
        low: Math.min(open, close) - Math.random() * 0.05,
        close
      });
      price = close;
      time += 60;
    }

    candleSeries.setData(data);
    seriesRef.current = candleSeries;
    chartRef.current = chart;

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
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
                <span className="text-green-400 text-xs font-medium bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20">
                  +4.2%
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
