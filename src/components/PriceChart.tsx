'use client';

import { useEffect, useRef } from 'react';
import { createChart, ColorType } from 'lightweight-charts';
import { Activity } from 'lucide-react';

export function PriceChart() {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 300,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#00f0ff',
      downColor: '#ff0055',
      borderVisible: false,
      wickUpColor: '#00f0ff',
      wickDownColor: '#ff0055',
    });

    // Generate some mock data for the chart
    const data = [];
    let time = Math.floor(Date.now() / 1000) - 100 * 60; // 100 minutes ago
    let currentPrice = 1.0;

    for (let i = 0; i < 100; i++) {
      const open = currentPrice;
      const close = open + (Math.random() - 0.45) * 0.1;
      const high = Math.max(open, close) + Math.random() * 0.05;
      const low = Math.min(open, close) - Math.random() * 0.05;

      data.push({
        time: time as any,
        open,
        high,
        low,
        close,
      });

      currentPrice = close;
      time += 60; // 1 minute intervals
    }

    candlestickSeries.setData(data);

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
  }, []);

  return (
    <div className="glass-panel p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="text-cyan-400" size={20} />
          <h2 className="text-lg font-bold text-white">Live Market Action</h2>
        </div>
        <div className="flex gap-2">
          <button className="px-2 py-1 text-xs bg-cyan-900/40 text-cyan-400 rounded border border-cyan-500/30">1m</button>
          <button className="px-2 py-1 text-xs text-gray-400 hover:text-white transition-colors">5m</button>
          <button className="px-2 py-1 text-xs text-gray-400 hover:text-white transition-colors">1h</button>
        </div>
      </div>
      <div ref={chartContainerRef} className="w-full h-[300px]" />
    </div>
  );
}
