'use client';

import React, { useEffect, useRef } from 'react';
import {
  createChart,
  IChartApi,
  ISeriesApi,
  IPriceLine,
  CandlestickData,
  UTCTimestamp,
  LineStyle,
} from 'lightweight-charts';
import { Candle } from '../lib/adapters/types';
import { GridConfig } from '../lib/analytics/ranges';

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
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);

  // 1. Initialize and update chart canvas & candlestick series (Only when candles change)
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;

    // Clean up any existing chart
    if (chartInstanceRef.current) {
      try {
        chartInstanceRef.current.remove();
      } catch (err) {
        console.warn('Error removing chart:', err);
      }
      chartInstanceRef.current = null;
      seriesRef.current = null;
      priceLinesRef.current = [];
    }

    container.innerHTML = '';

    const chart = createChart(container, {
      width: container.clientWidth || 800,
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

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    seriesRef.current = candlestickSeries;

    // Format candle data with timestamp deduplication to prevent lightweight-charts uniqueness errors
    const seenTimes = new Set<number>();
    const formattedData: CandlestickData[] = [];

    for (const c of candles) {
      const timeSec = Math.floor(c.time / 1000) as UTCTimestamp;
      if (!seenTimes.has(timeSec) && Number.isFinite(c.open) && Number.isFinite(c.high)) {
        seenTimes.add(timeSec);
        formattedData.push({
          time: timeSec,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        });
      }
    }

    formattedData.sort((a, b) => (a.time as number) - (b.time as number));

    if (formattedData.length > 0) {
      candlestickSeries.setData(formattedData);
      chart.timeScale().fitContent();
    }

    const handleResize = () => {
      if (container && chartInstanceRef.current) {
        chartInstanceRef.current.applyOptions({ width: container.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartInstanceRef.current) {
        try {
          chartInstanceRef.current.remove();
        } catch (err) {}
        chartInstanceRef.current = null;
        seriesRef.current = null;
        priceLinesRef.current = [];
      }
    };
  }, [candles]);

  // 2. Dynamically update price lines when gridConfig changes (Without destroying the chart canvas)
  useEffect(() => {
    const series = seriesRef.current;
    if (!series || !gridConfig) return;

    // Remove existing price lines safely
    for (const line of priceLinesRef.current) {
      try {
        series.removePriceLine(line);
      } catch (e) {}
    }
    priceLinesRef.current = [];

    // Add Range Bounds (Ceiling & Floor)
    if (Number.isFinite(gridConfig.range?.upper)) {
      try {
        priceLinesRef.current.push(
          series.createPriceLine({
            price: gridConfig.range.upper,
            color: '#10b981',
            lineWidth: 2,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: 'Grid Ceiling',
          })
        );
      } catch (e) {}
    }

    if (Number.isFinite(gridConfig.range?.lower)) {
      try {
        priceLinesRef.current.push(
          series.createPriceLine({
            price: gridConfig.range.lower,
            color: '#ef4444',
            lineWidth: 2,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
            title: 'Grid Floor',
          })
        );
      } catch (e) {}
    }

    // Add Stop Loss Line
    if (Number.isFinite(gridConfig.suggestedStopLoss) && gridConfig.suggestedStopLoss > 0) {
      try {
        priceLinesRef.current.push(
          series.createPriceLine({
            price: gridConfig.suggestedStopLoss,
            color: '#f43f5e',
            lineWidth: 1,
            lineStyle: LineStyle.LargeDashed,
            axisLabelVisible: true,
            title: 'Stop-Loss',
          })
        );
      } catch (e) {}
    }

    // Add subtle intermediate grid lines (sample 4-8 levels)
    const levels = gridConfig.levels;
    if (Array.isArray(levels) && levels.length > 2) {
      const stepInterval = Math.max(1, Math.floor(levels.length / 6));
      for (let i = stepInterval; i < levels.length - 1; i += stepInterval) {
        if (Number.isFinite(levels[i])) {
          try {
            priceLinesRef.current.push(
              series.createPriceLine({
                price: levels[i],
                color: '#222d40',
                lineWidth: 1,
                lineStyle: LineStyle.Dotted,
                axisLabelVisible: false,
                title: '',
              })
            );
          } catch (e) {}
        }
      }
    }
  }, [gridConfig]);

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
            Ceiling (${gridConfig?.range?.upper?.toFixed(2) ?? '0.00'})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-rose-400 inline-block" />
            Floor (${gridConfig?.range?.lower?.toFixed(2) ?? '0.00'})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-rose-600 border-dashed inline-block" />
            Stop (${gridConfig?.suggestedStopLoss?.toFixed(2) ?? '0.00'})
          </span>
        </div>
      </div>

      <div ref={chartContainerRef} className="w-full relative min-h-[440px]" />
    </div>
  );
};
