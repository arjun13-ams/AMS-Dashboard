import React, { useEffect, useRef, useState } from 'react';
import {
  createChart,
  CrosshairMode,
  CandlestickData,
  LineData,
  HistogramData,
} from 'lightweight-charts';

type OHLCV = {
  date: string; // ISO string date
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

interface ChartProps {
  ohlcvData: OHLCV[];
  width?: number;
  height?: number;
}

const Chart: React.FC<ChartProps> = ({ ohlcvData, width = 900, height = 500 }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candleSeriesRef = useRef<any>(null);
  const ema10SeriesRef = useRef<any>(null);
  const ema21SeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);

  // Tooltip state
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    data?: {
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
      time: string;
    };
  }>({ visible: false, x: 0, y: 0 });

  useEffect(() => {
    if (!chartContainerRef.current || ohlcvData.length === 0) return;

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      width,
      height,
      layout: {
        background: { color: '#ffffff' },
        textColor: '#333',
      },
      grid: {
        vertLines: { color: '#eee' },
        horzLines: { color: '#eee' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: '#ccc',
      },
      timeScale: {
        borderColor: '#ccc',
        timeVisible: true,
        secondsVisible: false,
      },
    });
    chartRef.current = chart;

    // Candlestick series
    const candleSeries = chart.addCandlestickSeries();
    candleSeriesRef.current = candleSeries;

    // Convert data for candlestick
    const candles: CandlestickData[] = ohlcvData.map((row) => ({
      time: Math.floor(new Date(row.date).getTime() / 1000),
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
    }));

    candleSeries.setData(candles);

    // EMA calculation helper
    function calculateEMA(data: CandlestickData[], period: number): LineData[] {
      const k = 2 / (period + 1);
      const emaArray: LineData[] = [];
      let emaPrev: number | null = null;

      data.forEach((point) => {
        const close = point.close;
        if (emaPrev === null) {
          emaPrev = close;
        } else {
          emaPrev = close * k + emaPrev * (1 - k);
        }
        emaArray.push({ time: point.time, value: emaPrev });
      });

      return emaArray;
    }

    // Calculate EMAs
    const ema10 = calculateEMA(candles, 10);
    const ema21 = calculateEMA(candles, 21);

    // Add EMA line series
    const ema10Series = chart.addLineSeries({ color: 'green', lineWidth: 1 });
    const ema21Series = chart.addLineSeries({ color: 'red', lineWidth: 1 });

    ema10Series.setData(ema10);
    ema21Series.setData(ema21);

    ema10SeriesRef.current = ema10Series;
    ema21SeriesRef.current = ema21Series;

    // Volume histogram series on separate scale on right
    const volumeSeries = chart.addHistogramSeries({
      priceScaleId: '', // use independent scale on right
      priceLineVisible: false,
      lastValueVisible: false,
      color: '#26a69a',
      priceFormat: {
        type: 'volume',
      },
    });
    volumeSeriesRef.current = volumeSeries;

    // Volume data mapping
    const volumeData: HistogramData[] = ohlcvData.map((row) => ({
      time: Math.floor(new Date(row.date).getTime() / 1000),
      value: row.volume,
      color: row.close >= row.open ? 'rgba(38, 166, 154, 0.8)' : 'rgba(255, 82, 82, 0.8)',
    }));
    volumeSeries.setData(volumeData);

    // Add volume scale to right
    chart.priceScale('right').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    // Crosshair move handler for tooltip
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.point) {
        setTooltip((t) => ({ ...t, visible: false }));
        return;
      }

      const time = param.time as number;
      const hoveredIndex = candles.findIndex((c) => c.time === time);
      if (hoveredIndex === -1) {
        setTooltip((t) => ({ ...t, visible: false }));
        return;
      }

      const candle = ohlcvData[hoveredIndex];

      // Position tooltip near cursor
      setTooltip({
        visible: true,
        x: param.point.x,
        y: param.point.y,
        data: {
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume,
          time: candle.date,
        },
      });
    });

    // Cleanup on unmount
    return () => {
      chart.remove();
    };
  }, [ohlcvData, width, height]);

  return (
    <div style={{ position: 'relative' }}>
      <div ref={chartContainerRef} />
      {tooltip.visible && tooltip.data && (
        <div
          style={{
            position: 'absolute',
            left: tooltip.x + 10,
            top: tooltip.y + 10,
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            border: '1px solid #ccc',
            borderRadius: 4,
            padding: '8px',
            fontSize: 12,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            zIndex: 10,
          }}
        >
          <div><b>{new Date(tooltip.data.time).toLocaleDateString()}</b></div>
          <div>Open: {tooltip.data.open.toFixed(2)}</div>
          <div>High: {tooltip.data.high.toFixed(2)}</div>
          <div>Low: {tooltip.data.low.toFixed(2)}</div>
          <div>Close: {tooltip.data.close.toFixed(2)}</div>
          <div>Volume: {tooltip.data.volume.toLocaleString()}</div>
        </div>
      )}
    </div>
  );
};

export default Chart;
