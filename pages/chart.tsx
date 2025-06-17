// pages/chart.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  createChart,
  CrosshairMode,
  CandlestickData,
  LineData,
  HistogramData,
  IChartApi,
  ISeriesApi,
} from "lightweight-charts";

interface OHLCV {
  symbol: string;
  date: string; // ISO date string
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const ChartPage: React.FC = () => {
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const ema10SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ema21SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  const [ohlcvData, setOhlcvData] = useState<OHLCV[]>([]);
  const [symbolInput, setSymbolInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

  // Fetch sample data or fetch from API here
  // For demo, simulate with sample data:
  useEffect(() => {
    async function fetchData() {
      // Replace with your API endpoint or supabase fetch call
      const res = await fetch("/api/ohlcv?symbol=NSE:RELIANCE");
      const data: OHLCV[] = await res.json();
      setOhlcvData(data);

      // Set initial symbol for demo
      setSelectedSymbol("RELIANCE");
    }
    fetchData();
  }, []);

  // Update suggestions as user types (case-insensitive substring match)
  useEffect(() => {
    if (!symbolInput) {
      setSuggestions([]);
      return;
    }
    // Collect unique symbols from loaded data
    const uniqueSymbols = Array.from(new Set(ohlcvData.map((d) => d.symbol)));
    const filtered = uniqueSymbols.filter((sym) =>
      sym.toLowerCase().includes(symbolInput.toLowerCase())
    );
    setSuggestions(filtered.slice(0, 10));
  }, [symbolInput, ohlcvData]);

  // Calculate EMA helper
  function calculateEMA(data: number[], period: number): number[] {
    const k = 2 / (period + 1);
    let emaArray: number[] = [];
    data.forEach((price, idx) => {
      if (idx === 0) {
        emaArray.push(price); // first EMA = first price
      } else {
        const ema = price * k + emaArray[idx - 1] * (1 - k);
        emaArray.push(ema);
      }
    });
    return emaArray;
  }

  // Initialize chart and series
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Cleanup previous chart if any
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    chartRef.current = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 500,
      layout: {
        background: { color: "#ffffff" }, // proper type
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
      },
      leftPriceScale: {
        borderColor: "#ccc",
        scaleMargins: {
          top: 0.8,
          bottom: 0,
        },
      },
      timeScale: {
        borderColor: "#ccc",
        timeVisible: true,
        secondsVisible: false,
      },
    });

    candleSeriesRef.current = chartRef.current.addCandlestickSeries({
      priceScaleId: "right",
    });

    ema10SeriesRef.current = chartRef.current.addLineSeries({
      color: "green",
      lineWidth: 1,
      priceScaleId: "right",
    });

    ema21SeriesRef.current = chartRef.current.addLineSeries({
      color: "red",
      lineWidth: 1,
      priceScaleId: "right",
    });

    volumeSeriesRef.current = chartRef.current.addHistogramSeries({
      priceScaleId: "left",
      priceLineVisible: false,
      color: "#26a69a",
      overlay: false,
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, []);

  // Update chart data when selectedSymbol or ohlcvData changes
  useEffect(() => {
    if (!selectedSymbol) return;

    const dataForSymbol = ohlcvData.filter((d) => d.symbol === selectedSymbol);

    if (dataForSymbol.length === 0) return;

    // Map data to candlestick format with time as UNIX timestamp (seconds)
    const candles: CandlestickData[] = dataForSymbol.map((row) => ({
      time: Math.floor(new Date(row.date).getTime() / 1000),
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
    }));

    candleSeriesRef.current?.setData(candles);

    // Calculate EMAs on close prices
    const closePrices = dataForSymbol.map((d) => d.close);
    const ema10 = calculateEMA(closePrices, 10);
    const ema21 = calculateEMA(closePrices, 21);

    // Map EMA data to LineData format with matching timestamps
    const ema10Data: LineData[] = ema10.map((value, idx) => ({
      time: Math.floor(new Date(dataForSymbol[idx].date).getTime() / 1000),
      value,
    }));

    const ema21Data: LineData[] = ema21.map((value, idx) => ({
      time: Math.floor(new Date(dataForSymbol[idx].date).getTime() / 1000),
      value,
    }));

    ema10SeriesRef.current?.setData(ema10Data);
    ema21SeriesRef.current?.setData(ema21Data);

    // Volume data for histogram
    const volumeData: HistogramData[] = dataForSymbol.map((row) => ({
      time: Math.floor(new Date(row.date).getTime() / 1000),
      value: row.volume,
      color: row.close >= row.open ? "#26a69a" : "#ef5350",
    }));

    volumeSeriesRef.current?.setData(volumeData);

    // Fit chart to data
    chartRef.current?.timeScale().fitContent();
  }, [selectedSymbol, ohlcvData]);

  // Handle suggestion click
  const onSuggestionClick = (sym: string) => {
    setSelectedSymbol(sym);
    setSymbolInput(sym);
    setSuggestions([]);
  };

  // Tooltip logic
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!chartRef.current || !tooltipRef.current) return;

    const handleCrosshairMove = (param: any) => {
      if (
        param.point === undefined ||
        param.time === undefined ||
        param.seriesPrices === undefined
      ) {
        tooltipRef.current.style.display = "none";
        return;
      }

      const price = param.seriesPrices.get(candleSeriesRef.current!);
      const ema10Price = param.seriesPrices.get(ema10SeriesRef.current!);
      const ema21Price = param.seriesPrices.get(ema21SeriesRef.current!);
      const volumePrice = param.seriesPrices.get(volumeSeriesRef.current!);

      if (!price) {
        tooltipRef.current.style.display = "none";
        return;
      }

      const date = new Date(param.time as number * 1000);
      const dateStr = date.toLocaleDateString();

      tooltipRef.current.style.display = "block";
      tooltipRef.current.style.left = param.point.x + 15 + "px";
      tooltipRef.current.style.top = param.point.y + 15 + "px";
      tooltipRef.current.innerHTML = `
        <div><strong>Date:</strong> ${dateStr}</div>
        <div><strong>Open:</strong> ${price.open.toFixed(2)}</div>
        <div><strong>High:</strong> ${price.high.toFixed(2)}</div>
        <div><strong>Low:</strong> ${price.low.toFixed(2)}</div>
        <div><strong>Close:</strong> ${price.close.toFixed(2)}</div>
        <div><strong>Volume:</strong> ${
          volumePrice ? volumePrice.toLocaleString() : "N/A"
        }</div>
        <div style="color: green;"><strong>EMA 10:</strong> ${
          ema10Price ? ema10Price.toFixed(2) : "N/A"
        }</div>
        <div style="color: red;"><strong>EMA 21:</strong> ${
          ema21Price ? ema21Price.toFixed(2) : "N/A"
        }</div>
      `;
    };

    chartRef.current.subscribeCrosshairMove(handleCrosshairMove);

    return () => {
      chartRef.current?.unsubscribeCrosshairMove(handleCrosshairMove);
    };
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h2>Stock Chart with Momentum Indicators</h2>
      <div style={{ marginBottom: 10 }}>
        <input
          type="text"
          value={symbolInput}
          onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
          placeholder="Type symbol (e.g. RELIANCE)"
          style={{ width: 300, padding: 8 }}
          autoComplete="off"
        />
        {suggestions.length > 0 && (
          <ul
            style={{
              listStyleType: "none",
              padding: 0,
              margin: 0,
              border: "1px solid #ccc",
              maxHeight: 150,
              overflowY: "auto",
              width: 300,
              backgroundColor: "white",
              position: "absolute",
              zIndex: 10,
            }}
          >
            {suggestions.map((sym) => (
              <li
                key={sym}
                style={{ padding: 8, cursor: "pointer" }}
                onClick={() => onSuggestionClick(sym)}
              >
                {sym}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div
        ref={chartContainerRef}
        style={{ position: "relative", height: 500, userSelect: "none" }}
      />

      <div
        ref={tooltipRef}
        style={{
          position: "absolute",
          display: "none",
          pointerEvents: "none",
          padding: 8,
          backgroundColor: "rgba(255, 255, 255, 0.9)",
          border: "1px solid #ccc",
          borderRadius: 4,
          fontSize: 12,
          color: "#000",
          whiteSpace: "nowrap",
          zIndex: 20,
        }}
      />
    </div>
  );
};

export default ChartPage;
