"use client";

import React, { useEffect, useRef, useState } from "react";
import { createChart } from "lightweight-charts";
import { supabase } from "../lib/supabase";

export default function ChartView() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<any>(null);
  const candleSeriesRef = useRef<any>(null);
  const ema10SeriesRef = useRef<any>(null);
  const ema21SeriesRef = useRef<any>(null);

  const [symbols, setSymbols] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredSymbols, setFilteredSymbols] = useState<string[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string>("TCS");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [ohlc, setOhlc] = useState<any>(null);
  const [candleData, setCandleData] = useState<any[]>([]);

  useEffect(() => {
    async function fetchSymbols() {
      const { data, error } = await supabase.from("cnx500_stock_list").select("symbol");
      if (!error && data) {
        const list = data.map((row) => row.symbol);
        setSymbols(list);
        setFilteredSymbols(list);
      }
    }
    fetchSymbols();
  }, []);

  useEffect(() => {
    const filtered = symbols.filter((s) => s.toLowerCase().includes(searchTerm.toLowerCase()));
    setFilteredSymbols(filtered);
    setSelectedIndex(0);
  }, [searchTerm, symbols]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    if (chartRef.current) {
      chartRef.current.remove();
    }

    const chart = createChart(chartContainerRef.current, {
      layout: { background: { color: "#111" }, textColor: "#DDD" },
      grid: { vertLines: { color: "#222" }, horzLines: { color: "#222" } },
      timeScale: { timeVisible: true },
      height: 500,
    });

    chartRef.current = chart;
    candleSeriesRef.current = chart.addCandlestickSeries();
    ema10SeriesRef.current = chart.addLineSeries({ color: "orange", lineWidth: 1 });
    ema21SeriesRef.current = chart.addLineSeries({ color: "cyan", lineWidth: 1 });
  }, [selectedSymbol]);

  useEffect(() => {
    async function fetchData() {
      const { data, error } = await supabase
        .from("ohlcv_data")
        .select("date, open, high, low, close, volume")
        .eq("symbol", selectedSymbol)
        .order("date");

      if (error || !data) return;

      const candleDataNew = data.map((row) => ({
        time: row.date,
        open: row.open,
        high: row.high,
        low: row.low,
        close: row.close,
      }));

      candleSeriesRef.current?.setData(candleDataNew);
      setCandleData(candleDataNew);

      const lastBar = data[data.length - 1];
      const prevBar = data[data.length - 2];
      setOhlc({
        open: lastBar.open,
        high: lastBar.high,
        low: lastBar.low,
        close: lastBar.close,
        volume: lastBar.volume,
        change: ((lastBar.close - prevBar.close) / prevBar.close) * 100,
      });

      const ema = (period: number) => {
        const k = 2 / (period + 1);
        const result: { time: string; value: number }[] = [];
        let prevEma: number | undefined;

        candleDataNew.forEach((bar, i) => {
          if (i < period - 1) return;
          if (i === period - 1) {
            const sum = candleDataNew.slice(0, period).reduce((acc, d) => acc + d.close, 0);
            prevEma = sum / period;
          } else {
            if (prevEma !== undefined) {
              prevEma = bar.close * k + prevEma * (1 - k);
            }
          }
          if (prevEma !== undefined) {
            result.push({ time: bar.time, value: prevEma });
          }
        });

        return result;
      };

      ema10SeriesRef.current?.setData(ema(10));
      ema21SeriesRef.current?.setData(ema(21));
    }

    fetchData();
  }, [selectedSymbol]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      setSelectedIndex((prev) => Math.min(prev + 1, filteredSymbols.length - 1));
    } else if (e.key === "ArrowUp") {
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && filteredSymbols[selectedIndex]) {
      setSelectedSymbol(filteredSymbols[selectedIndex]);
      setSearchTerm("");
    }
  };

  // Reset zoom: fit visible range horizontally & reset vertical scale
  const resetZoom = () => {
    if (!chartRef.current || candleData.length === 0) return;
    chartRef.current.timeScale().fitContent();
    // Reset price scale to fit visible bars:
    // lightweight-charts usually autoscale Y on fitContent,
    // but you can force setData again to be sure:
    candleSeriesRef.current?.setData(candleData);
  };

  return (
    <div className="flex flex-col relative">
      <div className="mb-4">
        <input
          className="p-2 rounded border border-gray-600 bg-gray-800 text-white w-full"
          type="text"
          placeholder="Search symbol"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        {searchTerm && (
          <ul className="bg-gray-900 max-h-48 overflow-auto rounded mt-1 text-sm border border-gray-700">
            {filteredSymbols.slice(0, 15).map((s, i) => (
              <li
                key={s}
                className={`p-2 cursor-pointer ${i === selectedIndex ? "bg-gray-700" : "hover:bg-gray-700"}`}
                onClick={() => {
                  setSelectedSymbol(s);
                  setSearchTerm("");
                }}
              >
                {s}
              </li>
            ))}
          </ul>
        )}
      </div>

      {ohlc && (
        <div className="text-sm text-white mb-2">
          <span className="font-semibold">{selectedSymbol}</span> &nbsp;
          O: {ohlc.open} H: {ohlc.high} L: {ohlc.low} C: {ohlc.close} Vol: {ohlc.volume} &nbsp;
          <span className={ohlc.change >= 0 ? "text-green-400" : "text-red-400"}>
            {ohlc.change.toFixed(2)}%
          </span>
        </div>
      )}

      <div ref={chartContainerRef} className="w-full relative" style={{ minHeight: 500 }} />

      {/* Floating Reset Zoom button */}
      <button
        onClick={resetZoom}
        aria-label="Reset Zoom"
        className="absolute bottom-4 right-4 bg-zinc-800 text-white px-3 py-1 rounded shadow hover:bg-zinc-700 select-none"
        style={{ userSelect: "none" }}
      >
        🔄 Reset Zoom
      </button>
    </div>
  );
}
