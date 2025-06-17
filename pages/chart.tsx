import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  createChart,
  CrosshairMode,
  CandlestickData,
  LineData,
  ISeriesApi,
  PriceLineOptions,
} from 'lightweight-charts';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function ChartView() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'>>();
  const ema10SeriesRef = useRef<ISeriesApi<'Line'>>();
  const ema21SeriesRef = useRef<ISeriesApi<'Line'>>();
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'>>();

  const [symbol, setSymbol] = useState('');
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [ohlcvData, setOhlcvData] = useState<CandlestickData[]>([]);
  const [volumeData, setVolumeData] = useState<{ time: number; value: number; color: string }[]>([]);

  // Fetch distinct symbols once (or you can fetch on demand)
  useEffect(() => {
    async function fetchSymbols() {
      const { data, error } = await supabase
        .from('ohlcv_data')
        .select('symbol', { count: 'exact' });
      if (error) {
        console.error('Error fetching symbols:', error);
        return;
      }
      const uniqueSymbols = Array.from(new Set(data?.map((d) => d.symbol) ?? []));
      setSuggestions(uniqueSymbols);
    }
    fetchSymbols();
  }, []);

  // Filter suggestions based on input text
  const filteredSuggestions = suggestions.filter((s) =>
    s.toLowerCase().includes(input.toLowerCase())
  ).slice(0, 10); // limit to 10 suggestions

  // When symbol changes, fetch OHLCV data
  useEffect(() => {
    if (!symbol) return;

    async function fetchOhlcv() {
      const { data, error } = await supabase
        .from('ohlcv_data')
        .select('date, open, high, low, close, volume')
        .eq('symbol', symbol)
        .order('date', { ascending: true })
        .limit(1000);

      if (error) {
        console.error(error);
        return;
      }
      if (!data) return;

      // Map data to Lightweight Charts format
      const candles: CandlestickData[] = data.map((row) => ({
        time: Math.floor(new Date(row.date).getTime() / 1000), // unix time in seconds
        open: row.open,
        high: row.high,
        low: row.low,
        close: row.close,
      }));

      setOhlcvData(candles);

      // Prepare volume histogram data (green/red by candle direction)
      const volumeHist = data.map((row, idx) => ({
        time: Math.floor(new Date(row.date).getTime() / 1000),
        value: row.volume,
        color: idx === 0 || row.close >= data[idx - 1].close ? 'rgba(0, 150, 136, 0.8)' : 'rgba(255, 82, 82, 0.8)', // green/red
      }));
      setVolumeData(volumeHist);
    }
    fetchOhlcv();
  }, [symbol]);

  // Calculate EMA (Exponential Moving Average)
  // period = number of days for EMA
  function calculateEMA(data: CandlestickData[], period: number): LineData[] {
    const k = 2 / (period + 1);
    const emaArray: LineData[] = [];
    let emaPrev: number | null = null;

    data.forEach((d, i) => {
      const close = d.close;
      if (i === 0) {
        emaPrev = close;
        emaArray.push({ time: d.time, value: close });
      } else if (emaPrev !== null) {
        const emaCurrent = close * k + emaPrev * (1 - k);
        emaArray.push({ time: d.time, value: emaCurrent });
        emaPrev = emaCurrent;
      }
    });

    return emaArray;
  }

  // Draw chart on data update
  useEffect(() => {
    if (!chartContainerRef.current || ohlcvData.length === 0) return;

    // Dispose old chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 500,
      layout: {
        backgroundColor: '#121212',
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: '#2a2e39' },
        horzLines: { color: '#2a2e39' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: '#555',
      },
      timeScale: {
        borderColor: '#555',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    // Add candlestick series
    candleSeriesRef.current = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });
    candleSeriesRef.current.setData(ohlcvData);

    // Add volume histogram series below
    volumeSeriesRef.current = chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '',
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });
    volumeSeriesRef.current.setData(volumeData);

    // Calculate EMAs
    const ema10 = calculateEMA(ohlcvData, 10);
    const ema21 = calculateEMA(ohlcvData, 21);

    // Add EMA 10 (green, thicker)
    ema10SeriesRef.current = chart.addLineSeries({
      color: 'green',
      lineWidth: 2,
    });
    ema10SeriesRef.current.setData(ema10);

    // Add EMA 21 (red, thicker)
    ema21SeriesRef.current = chart.addLineSeries({
      color: 'red',
      lineWidth: 2,
    });
    ema21SeriesRef.current.setData(ema21);

    // Resize handler
    function handleResize() {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    }
    window.addEventListener('resize', handleResize);

    // Clean up
    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [ohlcvData, volumeData]);

  return (
    <div style={{ maxWidth: 900, margin: 'auto', padding: 20, color: '#ddd' }}>
      <label htmlFor="symbol-search" style={{ display: 'block', marginBottom: 8 }}>
        Search Symbol:
      </label>
      <input
        id="symbol-search"
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value.toUpperCase())}
        style={{
          width: '100%',
          padding: 8,
          fontSize: 16,
          borderRadius: 4,
          border: '1px solid #555',
          backgroundColor: '#222',
          color: '#ddd',
          marginBottom: 4,
        }}
        autoComplete="off"
        placeholder="Type symbol (e.g. HDFCBANK)"
      />
      {input && filteredSuggestions.length > 0 && (
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            border: '1px solid #555',
            borderRadius: 4,
            maxHeight: 160,
            overflowY: 'auto',
            backgroundColor: '#222',
            color: '#ddd',
            position: 'absolute',
            zIndex: 10,
            width: 'calc(100% - 40px)',
          }}
        >
          {filteredSuggestions.map((s) => (
            <li
              key={s}
              onClick={() => {
                setSymbol(s);
                setInput(s);
              }}
              style={{
                padding: '6px 12px',
                cursor: 'pointer',
                borderBottom: '1px solid #555',
              }}
              onMouseDown={(e) => e.preventDefault()} // prevent input blur before click
            >
              {s}
            </li>
          ))}
        </ul>
      )}

      <div
        ref={chartContainerRef}
        style={{ marginTop: 20, position: 'relative', height: 500 }}
      />
    </div>
  );
}
