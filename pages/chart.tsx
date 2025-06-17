import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  createChart,
  CrosshairMode,
  CandlestickData,
  HistogramData,
  ISeriesApi,
} from 'lightweight-charts';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function ChartView() {
  const [symbol, setSymbol] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [ohlcvData, setOhlcvData] = useState<any[]>([]);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const ema10SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ema21SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  // Fetch symbol suggestions as user types
  useEffect(() => {
    if (!symbol || symbol.length < 1) {
      setSuggestions([]);
      return;
    }

    async function fetchSymbols() {
      const { data, error } = await supabase
        .from('ohlcv_data')
        .select('symbol')
        .ilike('symbol', `%${symbol}%`)
        .limit(10);

      if (!error && data) {
        // Get unique symbols
        const uniqueSymbols = Array.from(new Set(data.map((d) => d.symbol)));
        setSuggestions(uniqueSymbols);
      }
    }
    fetchSymbols();
  }, [symbol]);

  // Fetch OHLCV data when a symbol is selected (exact match)
  useEffect(() => {
    if (!symbol) return;

    async function fetchData() {
      const { data, error } = await supabase
        .from('ohlcv_data')
        .select('*')
        .eq('symbol', symbol)
        .order('date', { ascending: true })
        .limit(1000);

      if (!error && data) setOhlcvData(data);
    }

    fetchData();
  }, [symbol]);

  // Calculate EMA helper
  function calculateEMA(data: number[], period: number): number[] {
    const k = 2 / (period + 1);
    let emaArray: number[] = [];
    data.forEach((price, index) => {
      if (index === 0) {
        emaArray.push(price);
      } else {
        emaArray.push(price * k + emaArray[index - 1] * (1 - k));
      }
    });
    return emaArray;
  }

  // Render chart on ohlcvData update
  useEffect(() => {
    if (!ohlcvData.length || !chartContainerRef.current) return;

    // Clean up previous chart instance
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
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
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    // Prepare candlestick data
    const candles: CandlestickData[] = ohlcvData.map((row) => ({
      time: Math.floor(new Date(row.date).getTime() / 1000), // unix timestamp in seconds
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
    }));

    // Add candlestick series
    const candleSeries = chart.addCandlestickSeries();
    candleSeries.setData(candles);
    candleSeriesRef.current = candleSeries;

    // Calculate EMAs on close prices
    const closes = ohlcvData.map((row) => row.close);
    const ema10 = calculateEMA(closes, 10);
    const ema21 = calculateEMA(closes, 21);

    // Map EMAs to chart data format
    const ema10Data = ema10.map((value, idx) => ({
      time: Math.floor(new Date(ohlcvData[idx].date).getTime() / 1000),
      value,
    }));

    const ema21Data = ema21.map((value, idx) => ({
      time: Math.floor(new Date(ohlcvData[idx].date).getTime() / 1000),
      value,
    }));

    // Add EMA lines
    const ema10Series = chart.addLineSeries({
      color: 'green',
      lineWidth: 1, // thin line
    });
    ema10Series.setData(ema10Data);
    ema10SeriesRef.current = ema10Series;

    const ema21Series = chart.addLineSeries({
      color: 'red',
      lineWidth: 1, // thin line
    });
    ema21Series.setData(ema21Data);
    ema21SeriesRef.current = ema21Series;

    // Add volume histogram series below chart
    const volumeSeries = chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: {
        type: 'volume',
      },
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    const volumeData: HistogramData[] = ohlcvData.map((row) => ({
      time: Math.floor(new Date(row.date).getTime() / 1000),
      value: row.volume,
      color: row.close > row.open ? 'rgba(0, 150, 136, 0.8)' : 'rgba(255, 82, 82, 0.8)',
    }));

    volumeSeries.setData(volumeData);
    volumeSeriesRef.current = volumeSeries;

    // Resize handler
    function handleResize() {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    }
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
    };
  }, [ohlcvData]);

  // Handle symbol selection from suggestions
  function onSelectSuggestion(sym: string) {
    setSymbol(sym);
    setSuggestions([]);
  }

  return (
    <div style={{ maxWidth: 900, margin: 'auto', padding: 20 }}>
      <label htmlFor="symbol-search" style={{ fontWeight: 'bold' }}>
        Search Symbol:
      </label>
      <input
        id="symbol-search"
        type="text"
        placeholder="Type symbol..."
        value={symbol}
        onChange={(e) => setSymbol(e.target.value.toUpperCase())}
        style={{ width: '100%', padding: '8px', fontSize: 16, boxSizing: 'border-box' }}
        autoComplete="off"
      />

      {suggestions.length > 0 && (
        <ul
          style={{
            border: '1px solid #ccc',
            maxHeight: 150,
            overflowY: 'auto',
            marginTop: 0,
            paddingLeft: 0,
            listStyleType: 'none',
            cursor: 'pointer',
          }}
        >
          {suggestions.map((s) => (
            <li
              key={s}
              onClick={() => onSelectSuggestion(s)}
              style={{
                padding: 8,
                borderBottom: '1px solid #eee',
                backgroundColor: s === symbol ? '#ddd' : '#fff',
              }}
            >
              {s}
            </li>
          ))}
        </ul>
      )}

      <div
        ref={chartContainerRef}
        style={{ marginTop: 20, position: 'relative', height: 520 }}
      ></div>
    </div>
  );
}
