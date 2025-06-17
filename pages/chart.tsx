// pages/chart.tsx

import React, { useEffect, useRef, useState } from 'react';
import {
  createChart,
  CrosshairMode,
  CandlestickData,
  HistogramData,
  IChartApi,
  ISeriesApi,
  LineData,
} from 'lightweight-charts';

interface OHLCV {
  symbol: string;
  date: string; // 'YYYY-MM-DD' format
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export default function ChartPage() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const ema10SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ema21SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  const [ohlcvData, setOhlcvData] = useState<OHLCV[]>([]);
  const [symbolInput, setSymbolInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('');

  // Fetch data from your API (replace with your actual API)
  async function fetchData() {
    try {
      const res = await fetch('/api/ohlcv'); // Your API route to fetch OHLCV data for all symbols
      if (!res.ok) throw new Error('Failed to fetch OHLCV data');
      const data: OHLCV[] = await res.json();
      setOhlcvData(data);

      // Extract unique symbols for suggestions
      const uniqueSymbols = Array.from(new Set(data.map((d) => d.symbol))).sort();
      setSuggestions(uniqueSymbols);
    } catch (error) {
      console.error(error);
    }
  }

  // Calculate EMA for a series of closes
  function calculateEMA(data: number[], period: number): number[] {
    const k = 2 / (period + 1);
    const emaArray: number[] = [];
    data.forEach((price, index) => {
      if (index === 0) {
        emaArray.push(price);
      } else {
        const ema = price * k + emaArray[index - 1] * (1 - k);
        emaArray.push(ema);
      }
    });
    return emaArray;
  }

  // Filter OHLCV data by symbol
  function getSymbolData(symbol: string): OHLCV[] {
    return ohlcvData.filter((d) => d.symbol === symbol).sort((a, b) => (a.date > b.date ? 1 : -1));
  }

  // Format data to candlestick and histogram series format
  function prepareChartData(data: OHLCV[]) {
    // Candlestick data uses date string as 'time'
    const candles: CandlestickData[] = data.map((row) => ({
      time: row.date, // Lightweight charts accepts 'YYYY-MM-DD' strings
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
    }));

    // Volume data as histogram
    const volume: HistogramData[] = data.map((row) => ({
      time: row.date,
      value: row.volume,
      color: row.close >= row.open ? '#26a69a' : '#ef5350', // green if up, red if down
    }));

    // Calculate EMAs on close prices
    const closes = data.map((d) => d.close);
    const ema10 = calculateEMA(closes, 10);
    const ema21 = calculateEMA(closes, 21);

    const ema10Data: LineData[] = data.map((d, i) => ({
      time: d.date,
      value: ema10[i],
    }));

    const ema21Data: LineData[] = data.map((d, i) => ({
      time: d.date,
      value: ema21[i],
    }));

    return { candles, volume, ema10Data, ema21Data };
  }

  // Initialize chart on first render
  useEffect(() => {
    if (!chartContainerRef.current) return;

    chartRef.current = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 500,
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

    // Add candlestick series
    candleSeriesRef.current = chartRef.current.addCandlestickSeries({
      priceScaleId: 'right',
    });

    // Create a separate price scale for volume with scaleMargins
    chartRef.current.priceScale('volume', {
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
      borderVisible: false,
    });

    // Add volume histogram series, assigned to 'volume' scale
    volumeSeriesRef.current = chartRef.current.addHistogramSeries({
      priceScaleId: 'volume',
      priceLineVisible: false,
      overlay: false,
      color: '#26a69a',
    });

    // Add EMA 10 (green, thin line)
    ema10SeriesRef.current = chartRef.current.addLineSeries({
      color: 'green',
      lineWidth: 1,
    });

    // Add EMA 21 (red, thin line)
    ema21SeriesRef.current = chartRef.current.addLineSeries({
      color: 'red',
      lineWidth: 1,
    });

    // Resize handler
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chartRef.current?.remove();
      chartRef.current = null;
    };
  }, []);

  // Update chart when selectedSymbol or data changes
  useEffect(() => {
    if (!selectedSymbol || !ohlcvData.length) return;

    const data = getSymbolData(selectedSymbol);
    if (!data.length) return;

    const { candles, volume, ema10Data, ema21Data } = prepareChartData(data);

    candleSeriesRef.current?.setData(candles);
    volumeSeriesRef.current?.setData(volume);
    ema10SeriesRef.current?.setData(ema10Data);
    ema21SeriesRef.current?.setData(ema21Data);
  }, [selectedSymbol, ohlcvData]);

  // On input change: filter suggestions by symbol prefix
  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase();
    setSymbolInput(val);

    if (!val) {
      setSuggestions([]);
      return;
    }
    const filtered = suggestions.filter((s) => s.startsWith(val));
    setSuggestions(filtered.slice(0, 10)); // max 10 suggestions
  };

  // When user clicks a suggestion
  const onSuggestionClick = (symbol: string) => {
    setSelectedSymbol(symbol);
    setSymbolInput(symbol);
    setSuggestions([]);
  };

  // Tooltip - show OHLCV on crosshair move
  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current) return;

    const handleCrosshairMove = (param: any) => {
      if (
        param === undefined ||
        param.time === undefined ||
        !param.seriesPrices.size
      ) {
        // Hide tooltip or clear if implemented
        return;
      }

      const time = param.time as string;
      const index = ohlcvData.findIndex((d) => d.date === time && d.symbol === selectedSymbol);
      if (index === -1) return;

      const d = getSymbolData(selectedSymbol)[index];

      // You can implement tooltip display logic here (e.g., set state to display data)
      // For brevity, let's just console.log for now:
      // console.log(`Date: ${d.date}, O:${d.open}, H:${d.high}, L:${d.low}, C:${d.close}, V:${d.volume}`);
    };

    chartRef.current.subscribeCrosshairMove(handleCrosshairMove);

    return () => {
      chartRef.current?.unsubscribeCrosshairMove(handleCrosshairMove);
    };
  }, [ohlcvData, selectedSymbol]);

  // Fetch data once on mount
  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div style={{ maxWidth: 900, margin: 'auto', padding: 20 }}>
      <h2>Stock Chart</h2>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={symbolInput}
          onChange={onInputChange}
          placeholder="Type stock symbol..."
          style={{ width: '100%', padding: 8, fontSize: 16 }}
          spellCheck={false}
        />
        {suggestions.length > 0 && (
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              border: '1px solid #ccc',
              maxHeight: 150,
              overflowY: 'auto',
              position: 'absolute',
              width: '100%',
              backgroundColor: 'white',
              zIndex: 10,
            }}
          >
            {suggestions.map((sym) => (
              <li
                key={sym}
                onClick={() => onSuggestionClick(sym)}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  borderBottom: '1px solid #eee',
                }}
              >
                {sym}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div
        ref={chartContainerRef}
        style={{ marginTop: 20, height: 500 }}
      />
    </div>
  );
}
