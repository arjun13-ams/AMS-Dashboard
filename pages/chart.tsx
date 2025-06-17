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
  UTCTimestamp,
} from "lightweight-charts";

interface OhlcvRow {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  symbol: string;
}

// Utility function: EMA calculation
function calculateEMA(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  let emaArray: number[] = [];
  let ema = values[0];
  emaArray.push(ema);
  for (let i = 1; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
    emaArray.push(ema);
  }
  return emaArray;
}

const ChartPage: React.FC = () => {
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const ema10SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ema21SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  const [symbolInput, setSymbolInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [ohlcvData, setOhlcvData] = useState<OhlcvRow[]>([]);

  // Example static symbols list, replace with your API/source
  const allSymbols = ["RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK", "BAJFINANCE", "KOTAKBANK"];

  // Auto-suggest filtering on input substring match (case-insensitive)
  useEffect(() => {
    if (!symbolInput) {
      setSuggestions([]);
      return;
    }
    const filtered = allSymbols.filter((s) =>
      s.toLowerCase().includes(symbolInput.toLowerCase())
    );
    setSuggestions(filtered);
  }, [symbolInput]);

  // Simulated fetch function, replace with actual fetch logic
  async function fetchOhlcv(symbol: string): Promise<OhlcvRow[]> {
    // Replace this with your actual API call
    // Here we simulate some data
    const today = new Date();
    let data: OhlcvRow[] = [];
    for (let i = 30; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const open = 100 + Math.random() * 10;
      const close = open + (Math.random() - 0.5) * 5;
      const high = Math.max(open, close) + Math.random() * 2;
      const low = Math.min(open, close) - Math.random() * 2;
      const volume = Math.floor(1000 + Math.random() * 1000);
      data.push({
        date: d.toISOString().slice(0, 10),
        open,
        high,
        low,
        close,
        volume,
        symbol,
      });
    }
    return data;
  }

  // On symbol select or enter
  const loadChartData = async (symbol: string) => {
    if (!symbol) return;
    const data = await fetchOhlcv(symbol);
    setOhlcvData(data);
    setSuggestions([]);
    setSymbolInput(symbol);
  };

  // Initialize chart on first render
  useEffect(() => {
    if (chartRef.current) return; // only once

    const chart = createChart(document.getElementById("chart")!, {
      width: 900,
      height: 500,
      layout: {
        background: { color: "#ffffff" },
        textColor: "#333",
      },
      grid: {
        vertLines: {
          color: "#eee",
        },
        horzLines: {
          color: "#eee",
        },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: "#ccc",
      },
      timeScale: {
        borderColor: "#ccc",
        timeVisible: true,
        secondsVisible: false,
      },
    });
    chartRef.current = chart;

    // Create main candle series
    candleSeriesRef.current = chart.addCandlestickSeries({
      upColor: "#4CAF50",
      downColor: "#F44336",
      borderVisible: false,
      wickVisible: true,
      borderColor: undefined,
      wickColor: undefined,
    });

    // Add EMA 10 line - green, thin
    ema10SeriesRef.current = chart.addLineSeries({
      color: "green",
      lineWidth: 1,
    });

    // Add EMA 21 line - red, thin
    ema21SeriesRef.current = chart.addLineSeries({
      color: "red",
      lineWidth: 1,
    });

    // Add volume histogram on separate scale below main chart
    volumeSeriesRef.current = chart.addHistogramSeries({
      color: "#26a69a",
      priceFormat: {
        type: "volume",
      },
      priceScaleId: "volume",
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    // Add separate price scale for volume on the right
    chart.priceScale("volume", {
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    // Cleanup on unmount
    return () => chart.remove();
  }, []);

  // Update chart data when ohlcvData changes
  useEffect(() => {
    if (!ohlcvData.length) return;

    const dataForSymbol = ohlcvData;

    // Prepare candlestick data with proper UTCTimestamp cast
    const candles: CandlestickData<UTCTimestamp>[] = dataForSymbol.map((row) => ({
      time: (Math.floor(new Date(row.date).getTime() / 1000) as UTCTimestamp),
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
    }));

    // Calculate EMAs on close prices
    const closes = dataForSymbol.map((row) => row.close);
    const ema10 = calculateEMA(closes, 10);
    const ema21 = calculateEMA(closes, 21);

    const ema10Data: LineData<UTCTimestamp>[] = ema10.map((value, idx) => ({
      time: (Math.floor(new Date(dataForSymbol[idx].date).getTime() / 1000) as UTCTimestamp),
      value,
    }));

    const ema21Data: LineData<UTCTimestamp>[] = ema21.map((value, idx) => ({
      time: (Math.floor(new Date(dataForSymbol[idx].date).getTime() / 1000) as UTCTimestamp),
      value,
    }));

    // Prepare volume histogram data
    const volumeData: HistogramData<UTCTimestamp>[] = dataForSymbol.map((row) => ({
      time: (Math.floor(new Date(row.date).getTime() / 1000) as UTCTimestamp),
      value: row.volume,
      color: row.close >= row.open ? "#26a69a" : "#ef5350",
    }));

    candleSeriesRef.current?.setData(candles);
    ema10SeriesRef.current?.setData(ema10Data);
    ema21SeriesRef.current?.setData(ema21Data);
    volumeSeriesRef.current?.setData(volumeData);

    // Adjust visible range if needed
    chartRef.current?.timeScale().fitContent();
  }, [ohlcvData]);

  // Crosshair tooltip logic
  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current) return;

    const toolTip = document.getElementById("tooltip")!;
    toolTip.style.display = "none";

    const handleCrosshairMove = (param: any) => {
      if (
        param.point === undefined ||
        param.time === undefined ||
        param.seriesPrices.size === 0
      ) {
        toolTip.style.display = "none";
        return;
      }

      const price = param.seriesPrices.get(candleSeriesRef.current!);
      if (!price) {
        toolTip.style.display = "none";
        return;
      }

      const time = param.time as UTCTimestamp;

      // Find data index
      const index = ohlcvData.findIndex(
        (d) =>
          Math.floor(new Date(d.date).getTime() / 1000) === time
      );
      if (index < 0) {
        toolTip.style.display = "none";
        return;
      }

      const d = ohlcvData[index];

      toolTip.style.display = "block";
      const canvas = chartRef.current!.canvas();
      const bbox = canvas.getBoundingClientRect();

      const tooltipWidth = 160;
      const tooltipHeight = 100;
      let left = param.point.x + bbox.left + 15;
      let top = param.point.y + bbox.top - tooltipHeight - 15;

      // Keep tooltip inside viewport horizontally
      if (left + tooltipWidth > window.innerWidth) {
        left = param.point.x + bbox.left - tooltipWidth - 15;
      }
      // Keep tooltip inside viewport vertically
      if (top < 0) {
        top = param.point.y + bbox.top + 15;
      }

      toolTip.style.left = left + "px";
      toolTip.style.top = top + "px";
      toolTip.innerHTML = `
        <div><strong>${d.symbol}</strong> - ${d.date}</div>
        <div>Open: ${d.open.toFixed(2)}</div>
        <div>High: ${d.high.toFixed(2)}</div>
        <div>Low: ${d.low.toFixed(2)}</div>
        <div>Close: ${d.close.toFixed(2)}</div>
        <div>Volume: ${d.volume.toLocaleString()}</div>
      `;
    };

    chartRef.current.subscribeCrosshairMove(handleCrosshairMove);

    return () => {
      chartRef.current?.unsubscribeCrosshairMove(handleCrosshairMove);
      const toolTip = document.getElementById("tooltip");
      if (toolTip) toolTip.style.display = "none";
    };
  }, [ohlcvData]);

  return (
    <div style={{ padding: 20 }}>
      <h2>Stock Chart</h2>

      <input
        type="text"
        placeholder="Enter symbol"
        value={symbolInput}
        onChange={(e) => setSymbolInput(e.target.value.toUpperCase())}
        style={{ padding: 8, width: 300 }}
        onKeyDown={(e) => {
          if (e.key === "Enter") loadChartData(symbolInput);
        }}
      />

      {suggestions.length > 0 && (
        <ul
          style={{
            border: "1px solid #ccc",
            maxHeight: 120,
            overflowY: "auto",
            width: 300,
            marginTop: 0,
            paddingLeft: 10,
            listStyleType: "none",
            cursor: "pointer",
          }}
        >
          {suggestions.map((s) => (
            <li
              key={s}
              onClick={() => loadChartData(s)}
              style={{ padding: "5px 0" }}
            >
              {s}
            </li>
          ))}
        </ul>
      )}

      <div
        id="chart"
        style={{
          marginTop: 20,
          userSelect: "none",
          position: "relative",
          width: 900,
          height: 500,
        }}
      ></div>

      {/* Tooltip div */}
      <div
        id="tooltip"
        style={{
          position: "fixed",
          display: "none",
          backgroundColor: "rgba(255, 255, 255, 0.9)",
          border: "1px solid #ccc",
          padding: 10,
          fontSize: 12,
          pointerEvents: "none",
          zIndex: 1000,
          borderRadius: 4,
          boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
          whiteSpace: "nowrap",
        }}
      ></div>
    </div>
  );
};

export default ChartPage;
