import React, { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  createChart,
  CrosshairMode,
  CandlestickData,
  HistogramData,
  LineData,
  Time,
} from "lightweight-charts";

// Ensure you have NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

function calculateEMA(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const emaArray: number[] = [];
  values.forEach((value, index) => {
    if (index === 0) {
      emaArray.push(value);
    } else {
      emaArray.push(value * k + emaArray[index - 1] * (1 - k));
    }
  });
  return emaArray;
}

export default function ChartPage() {
  const [symbol, setSymbol] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [ohlcvData, setOhlcvData] = useState<any[]>([]);

  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const candleSeriesRef = useRef<any>(null);
  const ema10SeriesRef = useRef<any>(null);
  const ema21SeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);

  // Symbol search with partial matching & suggestions
  useEffect(() => {
    if (!symbol) {
      setSuggestions([]);
      return;
    }
    const fetchSymbols = async () => {
      const { data, error } = await supabase
        .from("ohlcv_data")
        .select("symbol")
        .ilike("symbol", `%${symbol}%`)
        .limit(10);
      if (!error && data) {
        const uniqueSymbols = Array.from(new Set(data.map((d) => d.symbol)));
        setSuggestions(uniqueSymbols);
      }
    };
    fetchSymbols();
  }, [symbol]);

  // Fetch OHLCV data for selected symbol
  useEffect(() => {
    if (!symbol) return;
    const fetchData = async () => {
      const { data, error } = await supabase
        .from("ohlcv_data")
        .select("date, open, high, low, close, volume")
        .eq("symbol", symbol)
        .order("date", { ascending: true })
        .limit(1000);
      if (!error && data) {
        setOhlcvData(data);
      }
    };
    fetchData();
  }, [symbol]);

  // Create and update chart when OHLCV data changes
  useEffect(() => {
    if (!ohlcvData.length || !chartContainerRef.current) return;

    // Remove old chart if exists
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    // Create chart with layout, grid, crosshair options
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 500,
      layout: {
        background: { color: "#ffffff" },
        textColor: "#333",
      },
      grid: {
        vertLines: { color: "#eee" },
        horzLines: { color: "#eee" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: "#ccc",
        scaleMargins: {
          top: 0,
          bottom: 0.2, // leave space for volume scale
        },
      },
      timeScale: {
        borderColor: "#ccc",
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    // Candlestick series (attached to default right price scale)
    const candleSeries = chart.addCandlestickSeries();
    candleSeriesRef.current = candleSeries;

    // Format data for candlesticks: convert date strings to 'yyyy-mm-dd' or unix timestamp (seconds)
    // Lightweight-charts supports string 'yyyy-mm-dd' dates for Time
    const candles: CandlestickData[] = ohlcvData.map((row) => ({
      time: row.date, // assuming row.date is 'YYYY-MM-DD' string
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
    }));
    candleSeries.setData(candles);

    // Calculate EMAs on close prices
    const closes = ohlcvData.map((row) => row.close);
    const ema10 = calculateEMA(closes, 10);
    const ema21 = calculateEMA(closes, 21);

    // 10 EMA - green, thin line
    const ema10Series = chart.addLineSeries({
      color: "green",
      lineWidth: 1,
      priceScaleId: "right",
    });
    ema10Series.setData(
      ema10.map((val, idx) => ({
        time: ohlcvData[idx].date,
        value: val,
      }))
    );
    ema10SeriesRef.current = ema10Series;

    // 21 EMA - red, thin line
    const ema21Series = chart.addLineSeries({
      color: "red",
      lineWidth: 1,
      priceScaleId: "right",
    });
    ema21Series.setData(
      ema21.map((val, idx) => ({
        time: ohlcvData[idx].date,
        value: val,
      }))
    );
    ema21SeriesRef.current = ema21Series;

    // Add volume series on separate price scale on left side
    // Create a new price scale id: "volume"
    chart.applyOptions({
      leftPriceScale: {
        visible: true,
        borderColor: "#ccc",
        scaleMargins: {
          top: 0.8,
          bottom: 0,
        },
      },
    });

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: {
        type: "volume",
      },
      priceScaleId: "left",
      priceLineVisible: false,
      overlay: false,
      color: "#26a69a",
    });

    volumeSeries.setData(
      ohlcvData.map((row) => ({
        time: row.date,
        value: row.volume,
        color: row.close > row.open ? "#26a69a" : "#ef5350",
      }))
    );

    volumeSeriesRef.current = volumeSeries;

    // Responsive chart width
    function handleResize() {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    }
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
      chartRef.current = null;
    };
  }, [ohlcvData]);

  // User selects symbol from suggestions
  function handleSelectSuggestion(sym: string) {
    setSymbol(sym);
    setSuggestions([]);
  }

  return (
    <div style={{ maxWidth: 900, margin: "20px auto" }}>
      <label htmlFor="symbol-input" style={{ fontWeight: "bold" }}>
        Search Symbol:
      </label>
      <input
        id="symbol-input"
        type="text"
        placeholder="Type symbol here..."
        value={symbol}
        onChange={(e) => setSymbol(e.target.value.toUpperCase())}
        style={{
          width: "100%",
          padding: "8px 12px",
          fontSize: 16,
          marginBottom: 4,
          boxSizing: "border-box",
        }}
        autoComplete="off"
      />
      {suggestions.length > 0 && (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: "4px 0",
            border: "1px solid #ccc",
            maxHeight: 150,
            overflowY: "auto",
            cursor: "pointer",
          }}
        >
          {suggestions.map((s) => (
            <li
              key={s}
              onClick={() => handleSelectSuggestion(s)}
              style={{
                padding: "6px 10px",
                borderBottom: "1px solid #eee",
              }}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
      <div
        ref={chartContainerRef}
        style={{ width: "100%", height: 500, marginTop: 12 }}
      />
    </div>
  );
}
