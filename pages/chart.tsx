// pages/chart.tsx
import React, { useEffect, useRef } from "react";
import {
  createChart,
  CrosshairMode,
  UTCTimestamp,
  CandlestickData,
  LineStyle,
  IChartApi,
  HistogramData,
} from "lightweight-charts";

type OHLCV = {
  date: string; // 'YYYY-MM-DD'
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type ChartProps = {
  ohlcvData: OHLCV[];
  width?: number;
  height?: number;
};

function calculateEMA(data: number[], period: number): (number | null)[] {
  const k = 2 / (period + 1);
  let emaArray: (number | null)[] = [];
  let emaPrev: number | null = null;

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      emaArray.push(null);
      continue;
    } else if (i === period - 1) {
      // Simple moving average for first EMA value
      const sum = data.slice(0, period).reduce((a, b) => a + b, 0);
      emaPrev = sum / period;
      emaArray.push(emaPrev);
      continue;
    } else if (emaPrev !== null) {
      emaPrev = data[i] * k + emaPrev * (1 - k);
      emaArray.push(emaPrev);
    } else {
      emaArray.push(null);
    }
  }
  return emaArray;
}

const Chart: React.FC<ChartProps> = ({ ohlcvData, width = 900, height = 500 }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Create chart
    chartRef.current = createChart(chartContainerRef.current, {
      width,
      height,
      layout: {
        background: { color: "#ffffff" },
        textColor: "#333",
      },
      grid: {
        vertLines: {
          color: "#eee",
        },
        horzLines: {
          color: "#eee",
        },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: "#ccc",
      },
      timeScale: {
        borderColor: "#ccc",
        timeVisible: true,
        secondsVisible: false,
      },
    });

    // Prepare candlestick data
    // IMPORTANT: cast time as UTCTimestamp (which is just a branded number type)
    const candles: CandlestickData<UTCTimestamp>[] = ohlcvData.map((row) => ({
      time: (Math.floor(new Date(row.date).getTime() / 1000) as UTCTimestamp),
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
    }));

    // Add candlestick series
    const candleSeries = chartRef.current.addCandlestickSeries({
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderVisible: false,
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });
    candleSeries.setData(candles);

    // Calculate EMAs on close prices
    const closes = ohlcvData.map((d) => d.close);
    const ema10 = calculateEMA(closes, 10);
    const ema21 = calculateEMA(closes, 21);

    // Prepare EMA data - skip nulls for initial points
    const ema10Data = ema10
      .map((val, idx) =>
        val === null
          ? null
          : { time: candles[idx].time, value: val }
      )
      .filter((v): v is { time: UTCTimestamp; value: number } => v !== null);

    const ema21Data = ema21
      .map((val, idx) =>
        val === null
          ? null
          : { time: candles[idx].time, value: val }
      )
      .filter((v): v is { time: UTCTimestamp; value: number } => v !== null);

    // Add EMA line series with thin line width
    const ema10Series = chartRef.current.addLineSeries({
      color: "#2962FF",
      lineWidth: 1, // thin line
      lineStyle: LineStyle.Solid,
    });
    ema10Series.setData(ema10Data);

    const ema21Series = chartRef.current.addLineSeries({
      color: "#FF6D00",
      lineWidth: 1, // thin line
      lineStyle: LineStyle.Solid,
    });
    ema21Series.setData(ema21Data);

    // Add volume histogram series on a separate price scale
    const volumeSeries = chartRef.current.addHistogramSeries({
      priceFormat: {
        type: "volume",
      },
      priceScaleId: "volume",
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
      color: "#26a69a",
      priceLineVisible: false,
    });

    // Prepare volume data
    const volumeData: HistogramData<UTCTimestamp>[] = ohlcvData.map((row) => ({
      time: Math.floor(new Date(row.date).getTime() / 1000) as UTCTimestamp,
      value: row.volume,
      color: row.close >= row.open ? "#26a69a" : "#ef5350",
    }));

    volumeSeries.setData(volumeData);

    // Add separate price scale for volume on the left
    chartRef.current.applyOptions({
      priceScale: {
        volume: {
          scaleMargins: {
            top: 0.8,
            bottom: 0,
          },
          borderVisible: false,
        },
      },
    });

    // Cleanup on unmount
    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [ohlcvData, width, height]);

  return <div ref={chartContainerRef} />;
};

export default Chart;
