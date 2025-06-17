// pages/chart.tsx

import React, { useEffect, useRef, useState } from 'react';
import {
  createChart,
  CrosshairMode,
  CandlestickData,
  LineStyle,
  UTCTimestamp,
  HistogramData,
} from 'lightweight-charts';

interface OHLCV {
  date: string; // ISO date string
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Props {
  ohlcvData: OHLCV[];
  symbol: string;
}

const ChartPage: React.FC<Props> = ({ ohlcvData, symbol }) => {
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const candleSeriesRef = useRef<ReturnType<
    ReturnType<typeof createChart>['addCandlestickSeries']
  > | null>(null);
  const ema10Ref = useRef<ReturnType<
    ReturnType<typeof createChart>['addLineSeries']
  > | null>(null);
  const ema21Ref = useRef<ReturnType<
    ReturnType<typeof createChart>['addLineSeries']
  > | null>(null);
  const volumeSeriesRef = useRef<ReturnType<
    ReturnType<typeof createChart>['addHistogramSeries']
  > | null>(null);

  // Utility: Calculate EMA
  const calculateEMA = (data: number[], period: number): (number | null)[] => {
    const k = 2 / (period + 1);
    const emaArray: (number | null)[] = [];
    let emaPrev: number | null = null;
    data.forEach((price, idx) => {
      if (idx === 0) {
        emaArray.push(price); // seed with first price
        emaPrev = price;
      } else if (emaPrev !== null) {
        const ema = price * k + emaPrev * (1 - k);
        emaArray.push(ema);
        emaPrev = ema;
      } else {
        emaArray.push(null);
      }
    });
    return emaArray;
  };

  useEffect(() => {
    if (!ohlcvData || ohlcvData.length === 0) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    // Create chart
    const chart = createChart('chart-container', {
      width: 900,
      height: 500,
      layout: {
        background: { type: 'solid', color: '#ffffff' },
        textColor: '#333',
      },
      grid: {
        vertLines: {
          color: '#eee',
        },
        horzLines: {
          color: '#eee',
        },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: '#ccc',
      },
      timeScale: {
        borderColor: '#ccc',
      },
    });

    chartRef.current = chart;

    // Prepare candlestick data
    // Note: lightweight-charts expects time as UTCTimestamp = number (unix seconds)
    const candles: CandlestickData[] = ohlcvData.map((row) => ({
      time: Math.floor(new Date(row.date).getTime() / 1000) as UTCTimestamp,
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
    }));

    // Add candlestick series
    const candleSeries = chart.addCandlestickSeries({
      priceLineVisible: false,
      upColor: '#4caf50',
      downColor: '#f44336',
      borderVisible: false,
      wickUpColor: '#4caf50',
      wickDownColor: '#f44336',
    });
    candleSeries.setData(candles);
    candleSeriesRef.current = candleSeries;

    // Calculate EMAs (close prices)
    const closePrices = ohlcvData.map((row) => row.close);
    const ema10 = calculateEMA(closePrices, 10);
    const ema21 = calculateEMA(closePrices, 21);

    // Prepare EMA line data (skip nulls)
    const ema10Data = ema10
      .map((val, idx) =>
        val !== null
          ? { time: Math.floor(new Date(ohlcvData[idx].date).getTime() / 1000) as UTCTimestamp, value: val }
          : null
      )
      .filter((x): x is { time: UTCTimestamp; value: number } => x !== null);

    const ema21Data = ema21
      .map((val, idx) =>
        val !== null
          ? { time: Math.floor(new Date(ohlcvData[idx].date).getTime() / 1000) as UTCTimestamp, value: val }
          : null
      )
      .filter((x): x is { time: UTCTimestamp; value: number } => x !== null);

    // Add EMA10 series (green, thin)
    const ema10Series = chart.addLineSeries({
      color: 'green',
      lineWidth: 1,
      lineStyle: LineStyle.Solid,
    });
    ema10Series.setData(ema10Data);
    ema10Ref.current = ema10Series;

    // Add EMA21 series (red, thin)
    const ema21Series = chart.addLineSeries({
      color: 'red',
      lineWidth: 1,
      lineStyle: LineStyle.Solid,
    });
    ema21Series.setData(ema21Data);
    ema21Ref.current = ema21Series;

    // Add volume histogram
    const volumeData: HistogramData[] = ohlcvData.map((row) => ({
      time: Math.floor(new Date(row.date).getTime() / 1000) as UTCTimestamp,
      value: row.volume,
      color: row.close >= row.open ? 'rgba(76, 175, 80, 0.5)' : 'rgba(244, 67, 54, 0.5)', // green or red transparent
    }));

    // Add volume price scale (on left bottom)
    chart.priceScale('volume', {
      visible: true,
      borderColor: '#ccc',
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    // Add volume series
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: 'volume',
      scaleMargins: {
        top: 0.8, // This will be ignored here, it's set above on priceScale
        bottom: 0,
      },
      color: 'rgba(0, 150, 136, 0.8)', // fallback color
    });
    volumeSeries.setData(volumeData);
    volumeSeriesRef.current = volumeSeries;

    // Crosshair tooltip (show OHLCV data)
    const toolTip = document.createElement('div');
    toolTip.style = `
      position: absolute;
      display: none;
      border: 1px solid #ccc;
      background: white;
      padding: 8px;
      font-size: 12px;
      z-index: 1000;
      pointer-events: none;
      white-space: nowrap;
    `;
    document.body.appendChild(toolTip);

    chart.subscribeCrosshairMove((param) => {
      if (
        param === undefined ||
        param.time === undefined ||
        param.point === undefined ||
        param.seriesPrices.size === 0
      ) {
        toolTip.style.display = 'none';
        return;
      }

      const time = param.time as UTCTimestamp;
      const date = new Date(time * 1000);
      const dateString = date.toLocaleDateString();

      const price = param.seriesPrices.get(candleSeries);
      if (!price) {
        toolTip.style.display = 'none';
        return;
      }

      // Find OHLCV for the hovered date
      const ohlcv = ohlcvData.find(
        (row) => Math.floor(new Date(row.date).getTime() / 1000) === time
      );

      if (!ohlcv) {
        toolTip.style.display = 'none';
        return;
      }

      toolTip.style.display = 'block';
      toolTip.style.left = param.point.x + 15 + 'px';
      toolTip.style.top = param.point.y + 15 + 'px';

      toolTip.innerHTML = `
        <strong>${symbol} - ${dateString}</strong><br/>
        Open: ${ohlcv.open.toFixed(2)}<br/>
        High: ${ohlcv.high.toFixed(2)}<br/>
        Low: ${ohlcv.low.toFixed(2)}<br/>
        Close: ${ohlcv.close.toFixed(2)}<br/>
        Volume: ${ohlcv.volume.toLocaleString()}
      `;
    });

    return () => {
      chart.remove();
      document.body.removeChild(toolTip);
    };
  }, [ohlcvData, symbol]);

  return (
    <div>
      <h2>Chart for {symbol}</h2>
      <div
        id="chart-container"
        style={{ position: 'relative', width: '900px', height: '500px' }}
      />
    </div>
  );
};

export default ChartPage;
