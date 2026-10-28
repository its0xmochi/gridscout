'use client';

import React, { useEffect, useRef } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  CandlestickData,
  UTCTimestamp,
  LineStyle,
} from 'lightweight-charts';
import { Candle } from '../lib/adapters/types';
import { GridConfig, GridRange } from '../lib/analytics/ranges';

interface CandlestickChartProps {
  candles: Candle[];
  interval: '1h' | '15m';
  onIntervalChange: (interval: '1h' | '15m') => void;
  gridConfig: GridConfig;
  currentPrice: number;
}

export const CandlestickChart: React.FC<CandlestickChartProps> = ({
  candles,
  interval,
  onIntervalChange,
  gridConfig,
  currentPrice,
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Dispose previous instance if exists
    if (chartInstanceRef.current) {
      chartInstanceRef.current.remove();
      chartInstanceRef.current = null;
    }

    const container = chartContainerRef.current;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 440,
      layout: {
        background: { color: '#0b0e14' },
        textColor: '#94a3b8',
        fontSize: 12,
      },
      grid: {
        vertLines: { color: '#151b26' },
        horzLines: { color: '#151b26' },
      },
      crosshair: {
        vertLine: { color: '#334155', width: 1, style: LineStyle.Dashed },
        horzLine: { color: '#334155', width: 1, style: LineStyle.Dashed },
      },
      timeScale: {
        borderColor: '#222d40',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: '#222d40',
        autoScale: true,
      },
    });

    chartInstanceRef.current = chart;

    const candlestickSeries: ISeriesApi<'Candlestick'> = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    // Format candle data
    const formattedData: CandlestickData[] = candles
      .map((c) => ({
        time: Math.floor(c.time / 1000) as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
      .sort((a, b) => (a.time as number) - (b.time as number));

    candlestickSeries.setData(formattedData);

    // Add Range Bounds (Ceiling & Floor)
    candlestickSeries.createPriceLine({
      price: gridConfig.range.upper,
      color: '#10b981',
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: 'Grid Ceiling',
    });

    candlestickSeries.createPriceLine({
      price: gridConfig.range.lower,
      color: '#ef4444',
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: 'Grid Floor',
    });

    // Add Stop Loss Line
    if (gridConfig.suggestedStopLoss > 0) {
      candlestickSeries.createPriceLine({
        price: gridConfig.suggestedStopLoss,
        color: '#f43f5e',
        lineWidth: 1,
        lineStyle: LineStyle.LargeDashed,
        axisLabelVisible: true,
        title: 'Stop-Loss (Heuristic)',
      });
    }

    // Add subtle intermediate grid lines (sample 4-8 levels)
    const levels = gridConfig.levels;
    if (levels.length > 2) {
      const stepInterval = Math.max(1, Math.floor(levels.length / 6));
      for (let i = stepInterval; i < levels.length - 1; i += stepInterval) {
        candlestickSeries.createPriceLine({
          price: levels[i],
          color: '#222d40',
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: false,
          title: '',
        });
      }
    }

    // Handle responsive container resize
    const handleResize = () => {
      if (container && chart) {
        chart.applyOptions({ width: container.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);
    chart.timeScale().fitContent();

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [candles, gridConfig]);

  return (
    <div className="bg-dark-850 rounded-xl border border-dark-700 overflow-hidden p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold text-slate-300">Timeframe:</span>
          <div className="flex rounded-lg bg-dark-900 p-0.5 border border-dark-700">
            <button
              onClick={() => onIntervalChange('1h')}
              className={`px-3 py-1 rounded text-xs font-medium ${
                interval === '1h'
                  ? 'bg-dark-750 text-emerald-400 border border-dark-600'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              1 Hour (14d)
            </button>
            <button
              onClick={() => onIntervalChange('15m')}
              className={`px-3 py-1 rounded text-xs font-medium ${
                interval === '15m'
                  ? 'bg-dark-750 text-emerald-400 border border-dark-600'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              15 Min (7d)
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center space-x-4 text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-emerald-400 inline-block" />
            Ceiling (${gridConfig.range.upper.toFixed(2)})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-rose-400 inline-block" />
            Floor (${gridConfig.range.lower.toFixed(2)})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-rose-600 border-dashed inline-block" />
            Stop (${gridConfig.suggestedStopLoss.toFixed(2)})
          </span>
        </div>
      </div>

      <div ref={chartContainerRef} className="w-full relative min-h-[440px]" />
    </div>
  );
};
