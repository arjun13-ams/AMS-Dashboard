import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  createChart,
  CrosshairMode,
  LineStyle,
  CandlestickData,
  IChartApi,
  ISeriesApi,
  HistogramData,
} from 'lightweight-charts';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function ChartView() {
  const [symbolInput, setSymbolInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [ohlcvData, setOhlcvData] = useState<CandlestickData[]>([]);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const ema10SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ema21SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  // Fetch symbol suggestions for autocomplete
  useEffect(() => {
    if (!symbolInput) {
      setSuggestions([]);
      return;
    }

    const fetchSuggestions = async () => {
      const { data, error } = await supabase
        .from('ohlcv_data')
        .select('symbol')
        .ilike('symbol', `%${symbolInput}%`)
        .limit(10);

      if (!error && data) {
        // Extract unique symbols
        const uniqueSymbols = Array.from(new Set(data.map((d) => d.symbol)));
        setSuggestions(uniqueSymbols);
      }
    };

    fetchSuggestions();
  }, [symbolInput]);

  // Fetch OHLCV data when symbol is selected
  useEffect(() => {
    if (!symbolInput) {
      setOhlcvData([]);
      return;
    }

    const fetchData = async () => {
      const { data, error } = await supabase
        .from('ohlcv_data')
        .select('date, open, high, low, close, volume')
        .eq('symbol', symbolInput)
        .order('date', { ascending: true })
        .limit(1000);

      if (!error && data) {
        // Map data to Lightweight Charts format, use date string as time
        const candles: CandlestickData[] = data.map((row) => ({
          time: row.date,
          open: row.open,
          high: row.high,
          low: row.low,
          close: row.close,
        }));

        setOhlcvData(candles);
      } else {
        setOhlcvData([]);
      }
    };

    fetchData();
  }, [symbolInput]);

  // Calculate EMA helper
  const calculateEMA = (data: CandlestickData[], period: number): { time: string; value: number }[] => {
    const k = 2 / (period + 1);
    let emaArray: { time: string; value: number }[] = [];

    let prevEma: number | null = null;
    data.forEach((point, idx) => {
      const close = point.close;
      if (idx === 0) {
        prevEma = close;
      } else if (prevEma !== null) {
        prevEma = close * k + prevEma * (1 - k);
      }
      if (prevEma !== null) {
        emaArray.push({ time: point.time as string, value: parseFloat(prevEma.toFixed(2)) });
      }
    });

    return emaArray;
  };

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Clean up previous chart if exists
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 500,
      layout: {
        backgroundColor: '#ffffff',
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

    // Candlestick series
    const candleSeries = chart.addCandlestickSeries();
    candleSeriesRef.current = candleSeries;

    // EMA 10 - green, width 2
    const ema10Series = chart.addLineSeries({
      color: 'green',
      lineWidth: 2,
      lineStyle: LineStyle.Solid,
    });
    ema10SeriesRef.current = ema10Series;

    // EMA 21 - red, width 2
    const ema21Series = chart.addLineSeries({
      color: 'red',
      lineWidth: 2,
      lineStyle: LineStyle.Solid,
    });
    ema21SeriesRef.current = ema21Series;

    // Volume series (Histogram)
    const volumeSeries = chart.addHistogramSeries({
      priceScaleId: '',
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
      color: '#26a69a',
      priceFormat: {
        type: 'volume',
      },
    });
    volumeSeriesRef.current = volumeSeries;

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, []);

  // Update chart data
  useEffect(() => {
    if (!ohlcvData.length) {
      candleSeriesRef.current?.setData([]);
      ema10SeriesRef.current?.setData([]);
      ema21SeriesRef.current?.setData([]);
      volumeSeriesRef.current?.setData([]);
      return;
    }

    candleSeriesRef.current?.setData(ohlcvData);

    // Calculate EMAs
    const ema10 = calculateEMA(ohlcvData, 10);
    const ema21 = calculateEMA(ohlcvData, 21);

    ema10SeriesRef.current?.setData(ema10);
    ema21SeriesRef.current?.setData(ema21);

    // Volume data for histogram series
    const volumeData: HistogramData[] = ohlcvData.map((row, idx) => {
      const prevClose = idx > 0 ? ohlcvData[idx - 1].close : row.close;
      return {
        time: row.time as string,
        value: row.close > prevClose ? row.volume : -row.volume,
        color: row.close > prevClose ? 'rgba(0,150,136,0.8)' : 'rgba(255,82,82,0.8)',
      };
    });
    volumeSeriesRef.current?.setData(volumeData);
  }, [ohlcvData]);

  // Symbol input handlers
  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSymbolInput(e.target.value.toUpperCase());
  };

  const onSuggestionClick = (symbol: string) => {
    setSymbolInput(symbol);
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
        value={symbolInput}
        onChange={onInputChange}
        style={{
          width: '100%',
          padding: '8px 12px',
          marginBottom: 0,
          fontSize: 16,
          boxSizing: 'border-box',
        }}
        autoComplete="off"
      />
      {suggestions.length > 0 && (
        <ul
          style={{
            listStyleType: 'none',
            paddingLeft: 0,
            marginTop: 0,
            maxHeight: 150,
            overflowY: 'auto',
            border: '1px solid #ccc',
            borderTop: 'none',
            cursor: 'pointer',
            background: 'white',
            position: 'absolute',
            width: 'calc(100% - 24px)', // input width minus padding
            zIndex: 10,
          }}
        >
          {suggestions.map((sym) => (
            <li
              key={sym}
              onClick={() => onSuggestionClick(sym)}
              style={{ padding: '8px 12px', borderBottom: '1px solid #eee' }}
            >
              {sym}
            </li>
          ))}
        </ul>
      )}
      <div
        ref={chartContainerRef}
        style={{ marginTop: suggestions.length > 0 ? 160 : 20 }}
      />
    </div>
  );
}
