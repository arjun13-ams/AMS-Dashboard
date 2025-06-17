import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  createChart,
  CrosshairMode,
  CandlestickData,
  LineStyle,
  HistogramData,
  UTCTimestamp,
} from 'lightweight-charts';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function ChartView() {
  const [symbol, setSymbol] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [ohlcvData, setOhlcvData] = useState<any[]>([]);
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<any>(null);
  const candleSeriesRef = useRef<any>(null);
  const ema10Ref = useRef<any>(null);
  const ema21Ref = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);

  // Fetch symbol suggestions as user types (auto-suggest)
  useEffect(() => {
    if (symbol.length < 1) {
      setSuggestions([]);
      return;
    }

    const fetchSuggestions = async () => {
      const { data, error } = await supabase
        .from('ohlcv_data')
        .select('symbol')
        .ilike('symbol', `${symbol.toUpperCase()}%`)
        .limit(10)
        .order('symbol', { ascending: true });

      if (!error && data) {
        const uniqueSymbols = [...new Set(data.map((d) => d.symbol))];
        setSuggestions(uniqueSymbols);
      }
    };

    fetchSuggestions();
  }, [symbol]);

  // Fetch OHLCV data when symbol is selected/changed
  useEffect(() => {
    if (!symbol) {
      setOhlcvData([]);
      return;
    }

    const fetchData = async () => {
      const { data, error } = await supabase
        .from('ohlcv_data')
        .select('*')
        .eq('symbol', symbol)
        .order('date', { ascending: true })
        .limit(1000);

      if (!error && data) {
        setOhlcvData(data);

        // Log first row to console for debugging
        if (data.length > 0) {
          console.log('First OHLCV row:', data[0]);
        }
      } else {
        setOhlcvData([]);
      }
    };

    fetchData();
  }, [symbol]);

  // Calculate EMA helper
  function calculateEMA(data: number[], period: number): number[] {
    const k = 2 / (period + 1);
    const emaArray: number[] = [];
    data.forEach((price, index) => {
      if (index === 0) {
        emaArray.push(price);
      } else {
        emaArray.push(price * k + emaArray[index - 1] * (1 - k));
      }
    });
    return emaArray;
  }

  // Create or update chart when OHLCV data changes
  useEffect(() => {
    if (!chartContainerRef.current) return;
    if (!ohlcvData.length) return;

    // Dispose old chart if exists
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 500,
      layout: {
        background: { type: 'solid', color: '#ffffff' }, // corrected type
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

    // Prepare candlestick data (convert date string to UTCTimestamp = seconds)
    const candles: CandlestickData[] = ohlcvData.map((row) => ({
      time: Math.floor(new Date(row.date).getTime() / 1000) as UTCTimestamp,
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
    }));

    // Set candlestick series
    const candleSeries = chart.addCandlestickSeries({
      priceLineVisible: false,
    });
    candleSeries.setData(candles);
    candleSeriesRef.current = candleSeries;

    // Calculate EMAs on close price
    const closePrices = ohlcvData.map((d) => d.close);
    const ema10 = calculateEMA(closePrices, 10);
    const ema21 = calculateEMA(closePrices, 21);

    // Map EMAs to line series data format
    const ema10Data = ema10.map((value, idx) => ({
      time: Math.floor(new Date(ohlcvData[idx].date).getTime() / 1000) as UTCTimestamp,
      value: value,
    }));
    const ema21Data = ema21.map((value, idx) => ({
      time: Math.floor(new Date(ohlcvData[idx].date).getTime() / 1000) as UTCTimestamp,
      value: value,
    }));

    // Add EMA line series: 10 EMA (green, thin)
    const ema10Series = chart.addLineSeries({
      color: 'green',
      lineWidth: 1,
    });
    ema10Series.setData(ema10Data);
    ema10Ref.current = ema10Series;

    // Add EMA line series: 21 EMA (red, thin)
    const ema21Series = chart.addLineSeries({
      color: 'red',
      lineWidth: 1,
    });
    ema21Series.setData(ema21Data);
    ema21Ref.current = ema21Series;

    // Add volume histogram series (bottom)
    const volumeSeries = chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: 'volume',
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    // Map volume data with time
    const volumeData: HistogramData[] = ohlcvData.map((row) => ({
      time: Math.floor(new Date(row.date).getTime() / 1000) as UTCTimestamp,
      value: row.volume,
      color: row.close > row.open ? '#26a69a' : '#ef5350', // green if up, red if down
    }));

    volumeSeries.setData(volumeData);
    volumeSeriesRef.current = volumeSeries;

    // Resize chart on container resize
    function handleResize() {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    }
    window.addEventListener('resize', handleResize);

    // Cleanup on unmount
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
    };
  }, [ohlcvData]);

  // Handle suggestion click to set symbol
  const handleSuggestionClick = (sym: string) => {
    setSymbol(sym);
    setSuggestions([]);
  };

  return (
    <div style={{ maxWidth: 900, margin: 'auto', padding: 20 }}>
      <h2>Stock Chart</h2>

      <input
        type="text"
        placeholder="Type symbol e.g. INFY"
        value={symbol}
        onChange={(e) => setSymbol(e.target.value.toUpperCase())}
        style={{
          width: '100%',
          padding: '8px',
          fontSize: '16px',
          boxSizing: 'border-box',
        }}
      />

      {/* Suggestions dropdown */}
      {suggestions.length > 0 && (
        <ul
          style={{
            border: '1px solid #ccc',
            borderTop: 'none',
            maxHeight: 200,
            overflowY: 'auto',
            marginTop: 0,
            paddingLeft: 0,
            listStyleType: 'none',
          }}
        >
          {suggestions.map((sym) => (
            <li
              key={sym}
              onClick={() => handleSuggestionClick(sym)}
              style={{
                padding: '8px',
                cursor: 'pointer',
                backgroundColor: sym === symbol ? '#eee' : 'white',
              }}
            >
              {sym}
            </li>
          ))}
        </ul>
      )}

      <div
        ref={chartContainerRef}
        style={{ marginTop: 20, width: '100%', height: 500 }}
      ></div>
    </div>
  );
}
