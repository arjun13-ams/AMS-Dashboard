import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  createChart,
  CrosshairMode,
  CandlestickData,
  LineData,
  UTCTimestamp,
} from 'lightweight-charts';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

function calculateEMA(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  let emaArray: number[] = [];
  values.forEach((value, index) => {
    if (index === 0) {
      emaArray.push(value);
    } else {
      emaArray.push(value * k + emaArray[index - 1] * (1 - k));
    }
  });
  return emaArray;
}

export default function ChartView() {
  const [symbol, setSymbol] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [ohlcvData, setOhlcvData] = useState<any[]>([]);

  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<any>(null);
  const candleSeriesRef = useRef<any>(null);
  const ema10SeriesRef = useRef<any>(null);
  const ema21SeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);

  // Fetch symbol suggestions as user types (case insensitive contains)
  useEffect(() => {
    if (!symbol) {
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
        const uniqueSymbols = Array.from(new Set(data.map((d) => d.symbol)));
        setSuggestions(uniqueSymbols);
      }
    }
    fetchSymbols();
  }, [symbol]);

  // Fetch OHLCV data when symbol changes
  useEffect(() => {
    if (!symbol) return;

    async function fetchData() {
      const { data, error } = await supabase
        .from('ohlcv_data')
        .select('*')
        .eq('symbol', symbol)
        .order('date', { ascending: true })
        .limit(1000);

      if (!error && data) {
        setOhlcvData(data);
      }
    }
    fetchData();
  }, [symbol]);

  // Setup chart when data changes
  useEffect(() => {
    if (!ohlcvData.length) return;
    if (!chartContainerRef.current) return;

    // Clear previous chart if any
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 500,
      layout: {
        background: '#ffffff',
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

    // Prepare candlestick data (time as date string)
    const candles: CandlestickData[] = ohlcvData.map((row) => ({
      time: row.date, // YYYY-MM-DD string works fine
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
    }));

    // Add candlestick series
    const candleSeries = chart.addCandlestickSeries({
      priceScaleId: 'right',
    });
    candleSeries.setData(candles);
    candleSeriesRef.current = candleSeries;

    // Calculate EMAs on close prices
    const closes = ohlcvData.map((row) => row.close);
    const ema10 = calculateEMA(closes, 10);
    const ema21 = calculateEMA(closes, 21);

    // Add EMA10 line - green, thin width 2
    const ema10Series = chart.addLineSeries({
      color: 'green',
      lineWidth: 2,
    });
    ema10Series.setData(
      ema10.map((value, idx) => ({
        time: ohlcvData[idx].date,
        value,
      }))
    );
    ema10SeriesRef.current = ema10Series;

    // Add EMA21 line - red, thin width 2
    const ema21Series = chart.addLineSeries({
      color: 'red',
      lineWidth: 2,
    });
    ema21Series.setData(
      ema21.map((value, idx) => ({
        time: ohlcvData[idx].date,
        value,
      }))
    );
    ema21SeriesRef.current = ema21Series;

    // Add volume histogram series below chart
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '', // volume uses own scale
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
      color: '#26a69a',
      priceLineVisible: false,
      overlay: false,
    });
    volumeSeries.setData(
      ohlcvData.map((row) => ({
        time: row.date,
        value: row.volume,
        color: row.close > row.open ? '#26a69a' : '#ef5350', // green/red bars
      }))
    );
    volumeSeriesRef.current = volumeSeries;

    // Resize handling
    function handleResize() {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    }
    window.addEventListener('resize', handleResize);

    // Cleanup on unmount or data change
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
    };
  }, [ohlcvData]);

  // Handle selecting a suggestion
  const handleSelectSuggestion = (sym: string) => {
    setSymbol(sym);
    setSuggestions([]);
  };

  return (
    <div style={{ maxWidth: 900, margin: '20px auto' }}>
      <label htmlFor="symbol-input" style={{ fontWeight: 'bold' }}>
        Search Symbol:
      </label>
      <input
        id="symbol-input"
        type="text"
        placeholder="Type symbol here..."
        value={symbol}
        onChange={(e) => setSymbol(e.target.value.toUpperCase())}
        style={{
          width: '100%',
          padding: '8px 12px',
          fontSize: 16,
          marginBottom: 4,
          boxSizing: 'border-box',
        }}
      />
      {suggestions.length > 0 && (
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: '4px 0',
            border: '1px solid #ccc',
            maxHeight: 150,
            overflowY: 'auto',
            cursor: 'pointer',
          }}
        >
          {suggestions.map((s) => (
            <li
              key={s}
              onClick={() => handleSelectSuggestion(s)}
              style={{
                padding: '6px 10px',
                borderBottom: '1px solid #eee',
              }}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
      <div
        ref={chartContainerRef}
        style={{ width: '100%', height: 500, marginTop: 12 }}
      />
    </div>
  );
}
