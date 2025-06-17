import React, { useState, useEffect, useRef } from 'react';
import { createChart, CandlestickData, LineData, Time } from 'lightweight-charts';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function ChartView() {
  const [symbol, setSymbol] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [ohlcvData, setOhlcvData] = useState<any[]>([]);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);

  useEffect(() => {
    const fetchSymbols = async () => {
      const { data, error } = await supabase
        .from('ohlcv_data')
        .select('symbol')
        .limit(1000);

      if (data) {
        const uniqueSymbols = [...new Set(data.map((d) => d.symbol))];
        setSuggestions(uniqueSymbols);
      }
    };

    fetchSymbols();
  }, []);

  useEffect(() => {
    if (!symbol) return;

    const fetchData = async () => {
      const { data, error } = await supabase
        .from('ohlcv_data')
        .select('*')
        .eq('symbol', symbol)
        .order('date', { ascending: true });

      if (data) setOhlcvData(data);
    };

    fetchData();
  }, [symbol]);

  useEffect(() => {
    if (!ohlcvData.length || !chartContainerRef.current) return;

    // Clear existing chart
    chartContainerRef.current.innerHTML = '';
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 500,
      layout: {
        background: { color: '#111' },
        textColor: '#DDD',
      },
      grid: {
        vertLines: { color: '#333' },
        horzLines: { color: '#333' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    const candles: CandlestickData[] = ohlcvData.map((row) => ({
      time: row.date, // 'YYYY-MM-DD' format
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
    }));

    const candleSeries = chart.addCandlestickSeries();
    candleSeries.setData(candles);

    // Add 10 EMA and 20 EMA
    const closePrices = ohlcvData.map((row) => row.close);
    const ema = (period: number): LineData[] =>
      closePrices.map((_, idx, arr) => {
        if (idx < period - 1) return null;
        const slice = arr.slice(idx - period + 1, idx + 1);
        const avg = slice.reduce((a, b) => a + b, 0) / period;
        return {
          time: ohlcvData[idx].date,
          value: parseFloat(avg.toFixed(2)),
        };
      }).filter(Boolean) as LineData[];

    const ema10 = chart.addLineSeries({ color: 'orange' });
    const ema20 = chart.addLineSeries({ color: 'skyblue' });

    ema10.setData(ema(10));
    ema20.setData(ema(20));
  }, [ohlcvData]);

  return (
    <div style={{ padding: '1rem', background: '#000', minHeight: '100vh', color: 'white' }}>
      <h2>Chart View</h2>
      <input
        type="text"
        placeholder="Search symbol..."
        value={symbol}
        onChange={(e) => setSymbol(e.target.value.toUpperCase())}
        list="symbol-options"
        style={{ padding: '0.5rem', marginBottom: '1rem', width: '300px' }}
      />
      <datalist id="symbol-options">
        {suggestions
          .filter((s) => s.includes(symbol.toUpperCase()))
          .map((s, idx) => (
            <option key={idx} value={s} />
          ))}
      </datalist>
      <div ref={chartContainerRef} />
    </div>
  );
}
