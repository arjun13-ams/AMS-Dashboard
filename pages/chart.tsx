// pages/chart.tsx

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { createChart, IChartApi, CandlestickData } from 'lightweight-charts';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function ChartView() {
  const [symbol, setSymbol] = useState('');
  const [ohlcvData, setOhlcvData] = useState<any[]>([]);
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);

  // Fetch OHLCV data when symbol changes
  useEffect(() => {
    if (!symbol) return;

    async function fetchData() {
      const { data, error } = await supabase
        .from('ohlcv_data')
        .select('*')
        .ilike('symbol', `%${symbol}%`)
        .order('date', { ascending: true })
        .limit(1000);

      if (error) {
        console.error('Error fetching OHLCV data:', error);
      } else {
        setOhlcvData(data);
      }
    }

    fetchData();
  }, [symbol]);

  // Render chart when ohlcvData changes
  useEffect(() => {
    if (!chartContainerRef.current || ohlcvData.length === 0) return;

    // Cleanup previous chart
    chartContainerRef.current.innerHTML = '';

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 400,
      layout: { background: { color: '#1e1e1e' }, textColor: '#d1d4dc' },
      grid: { vertLines: { color: '#2f2f2f' }, horzLines: { color: '#2f2f2f' } },
      timeScale: { timeVisible: true, secondsVisible: false },
    });
    chartRef.current = chart;

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#4caf50',
      downColor: '#f44336',
      borderVisible: false,
      wickUpColor: '#4caf50',
      wickDownColor: '#f44336',
    });

    const candles: CandlestickData[] = ohlcvData.map((row) => ({
      time: new Date(row.date).getTime() / 1000, // UNIX timestamp
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
    }));

    candleSeries.setData(candles);

    // Resize chart on window resize
    const handleResize = () => {
      chart.applyOptions({
        width: chartContainerRef.current!.clientWidth,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [ohlcvData]);

  return (
    <div style={{ padding: '1rem' }}>
      <h2 style={{ color: 'white' }}>Stock Candle Chart</h2>
      <input
        type="text"
        placeholder="Search symbol (e.g., HDFCBANK)"
        value={symbol}
        onChange={(e) => setSymbol(e.target.value.toUpperCase())}
        style={{
          padding: '8px',
          fontSize: '16px',
          marginBottom: '1rem',
          width: '100%',
          maxWidth: '300px',
        }}
      />
      <div
        ref={chartContainerRef}
        style={{
          width: '100%',
          height: '400px',
          border: '1px solid #333',
        }}
      />
    </div>
  );
}
