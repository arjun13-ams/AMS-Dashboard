import React, { useState, useEffect, useRef } from 'react';
import {
  createChart,
  CrosshairMode,
  CandlestickData,
  IChartApi,
  ISeriesApi,
  LineStyle,
} from 'lightweight-charts';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

type OhlcvRow = {
  symbol: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export default function ChartView() {
  const [symbolInput, setSymbolInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [ohlcvData, setOhlcvData] = useState<OhlcvRow[]>([]);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const ema10SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const ema21SeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  // Fetch symbol suggestions for autocomplete
  useEffect(() => {
    if (!symbolInput) {
      setSuggestions([]);
      return;
    }

    async function fetchSymbols() {
      const { data, error } = await supabase
        .from('ohlcv_data')
        .select('symbol')
        .ilike('symbol', `%${symbolInput.toUpperCase()}%`)
        .limit(10)
        .order('symbol', { ascending: true });

      if (!error && data) {
        const uniqueSymbols = Array.from(new Set(data.map((d) => d.symbol)));
        setSuggestions(uniqueSymbols);
      }
    }
    fetchSymbols();
  }, [symbolInput]);

  // Fetch OHLCV data when symbol changes
  useEffect(() => {
    if (!selectedSymbol) return;

    async function fetchOhlcv() {
      const { data, error } = await supabase
        .from('ohlcv_data')
        .select('*')
        .eq('symbol', selectedSymbol)
        .order('date', { ascending: true })
        .limit(1000);

      if (!error && data) {
        setOhlcvData(data as OhlcvRow[]);
      } else {
        setOhlcvData([]);
      }
    }
    fetchOhlcv();
  }, [selectedSymbol]);

  // Calculate EMA
  function calculateEMA(data: number[], period: number): number[] {
    const k = 2 / (period + 1);
    const emaArray = [];
    let emaPrev = data[0];
    emaArray.push(emaPrev);
    for (let i = 1; i < data.length; i++) {
      const emaCurrent = data[i] * k + emaPrev * (1 - k);
      emaArray.push(emaCurrent);
      emaPrev = emaCurrent;
    }
    return emaArray;
  }

  // Draw chart when ohlcvData updates
  useEffect(() => {
    if (!ohlcvData.length || !chartContainerRef.current) return;

    // Clean up old chart if any
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      ema10SeriesRef.current = null;
      ema21SeriesRef.current = null;
    }

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 500,
      layout: {
        background: { color: '#ffffff' }, // Correct type: object with color property
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
      time: Math.floor(new Date(row.date).getTime() / 1000),
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
    }));

    // Add candlestick series
    const candleSeries = chart.addCandlestickSeries();
    candleSeries.setData(candles);
    candleSeriesRef.current = candleSeries;

    // Prepare volume data (histogram)
    const volumeData = ohlcvData.map((row) => ({
      time: Math.floor(new Date(row.date).getTime() / 1000),
      value: row.volume,
      color: row.close >= row.open ? 'rgba(0,150,136,0.5)' : 'rgba(255,82,82,0.5)',
    }));

    // Add volume histogram series below main chart
    const volumeSeries = chart.addHistogramSeries({
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '', // separate scale below main chart
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });
    volumeSeries.setData(volumeData);
    volumeSeriesRef.current = volumeSeries;

    // Calculate EMAs on close price
    const closePrices = ohlcvData.map((row) => row.close);
    const ema10 = calculateEMA(closePrices, 10);
    const ema21 = calculateEMA(closePrices, 21);

    // Add EMA 10 series (green, thin)
    const ema10Series = chart.addLineSeries({
      color: 'green',
      lineWidth: 1,
    });
    ema10Series.setData(
      ema10.map((value, idx) => ({
        time: Math.floor(new Date(ohlcvData[idx].date).getTime() / 1000),
        value,
      }))
    );
    ema10SeriesRef.current = ema10Series;

    // Add EMA 21 series (red, thin)
    const ema21Series = chart.addLineSeries({
      color: 'red',
      lineWidth: 1,
    });
    ema21Series.setData(
      ema21.map((value, idx) => ({
        time: Math.floor(new Date(ohlcvData[idx].date).getTime() / 1000),
        value,
      }))
    );
    ema21SeriesRef.current = ema21Series;

    // Tooltip element for OHLC + volume
    const toolTip = document.createElement('div');
    toolTip.style.cssText = `
      position: absolute;
      display: none;
      padding: 8px;
      border-radius: 4px;
      background-color: rgba(255, 255, 255, 0.9);
      color: black;
      font-size: 12px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.3);
      pointer-events: none;
      z-index: 1000;
    `;
    chartContainerRef.current.appendChild(toolTip);

    chart.subscribeCrosshairMove((param) => {
      if (
        param === undefined ||
        param.time === undefined ||
        param.point === undefined ||
        param.seriesPrices === undefined
      ) {
        toolTip.style.display = 'none';
        return;
      }

      const time = param.time as number;
      const candle = candles.find((c) => c.time === time);
      const volumeEntry = volumeData.find((v) => v.time === time);

      if (!candle) {
        toolTip.style.display = 'none';
        return;
      }

      const open = candle.open.toFixed(2);
      const high = candle.high.toFixed(2);
      const low = candle.low.toFixed(2);
      const close = candle.close.toFixed(2);
      const volume = volumeEntry ? volumeEntry.value.toLocaleString() : 'N/A';

      toolTip.style.display = 'block';
      const containerRect = chartContainerRef.current!.getBoundingClientRect();
      const tooltipWidth = 160;
      const tooltipHeight = 90;

      let left = param.point.x + 15;
      if (left + tooltipWidth > containerRect.width) {
        left = param.point.x - tooltipWidth - 15;
      }
      let top = param.point.y - tooltipHeight / 2;
      if (top < 0) top = 0;
      if (top + tooltipHeight > containerRect.height) {
        top = containerRect.height - tooltipHeight;
      }

      toolTip.style.left = `${left}px`;
      toolTip.style.top = `${top}px`;
      toolTip.innerHTML = `
        <b>${selectedSymbol}</b><br/>
        Date: ${new Date(time * 1000).toLocaleDateString()}<br/>
        Open: ${open}<br/>
        High: ${high}<br/>
        Low: ${low}<br/>
        Close: ${close}<br/>
        Volume: ${volume}
      `;
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [ohlcvData, selectedSymbol]);

  return (
    <div style={{ padding: 20, position: 'relative' }}>
      <input
        type="text"
        placeholder="Search symbol"
        value={symbolInput}
        onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
        style={{
          padding: 8,
          width: 300,
          fontSize: 16,
          borderRadius: 4,
          border: '1px solid #ccc',
          marginBottom: 10,
        }}
      />
      {suggestions.length > 0 && (
        <ul
          style={{
            border: '1px solid #ccc',
            maxHeight: 150,
            overflowY: 'auto',
            padding: 0,
            margin: 0,
            width: 300,
            listStyleType: 'none',
            position: 'absolute',
            backgroundColor: 'white',
            zIndex: 1000,
          }}
        >
          {suggestions.map((sym) => (
            <li
              key={sym}
              style={{ padding: '6px 8px', cursor: 'pointer' }}
              onClick={() => {
                setSelectedSymbol(sym);
                setSymbolInput(sym);
                setSuggestions([]);
              }}
            >
              {sym}
            </li>
          ))}
        </ul>
      )}

      <div
        ref={chartContainerRef}
        style={{ marginTop: 40, width: '100%', maxWidth: 900, height: 500 }}
      />
    </div>
  );
}
