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
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);
  const [latestBar, setLatestBar] = useState<any>(null);

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
    setHighlightedIndex(0);
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

      const candleData = data.map((row) => ({
        time: row.date,
        open: row.open,
        high: row.high,
        low: row.low,
        close: row.close,
      }));

      setLatestBar(data[data.length - 1]);

      candleSeriesRef.current?.setData(candleData);

      const ema = (period: number) => {
        const k = 2 / (period + 1);
        const result: { time: string; value: number }[] = [];
        let prevEma: number | undefined;

        candleData.forEach((bar, i) => {
          if (i < period - 1) return;
          if (i === period - 1) {
            const sum = candleData.slice(0, period).reduce((acc, d) => acc + d.close, 0);
            prevEma = sum / period;
          } else if (prevEma !== undefined) {
            prevEma = bar.close * k + prevEma * (1 - k);
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
      e.preventDefault();
      setHighlightedIndex((prev) => Math.min(prev + 1, filteredSymbols.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      if (filteredSymbols.length > 0) {
        const selected = filteredSymbols[highlightedIndex] || filteredSymbols[0];
        setSelectedSymbol(selected);
        setSearchTerm("");
      }
    }
  };

  const formatNumber = (num: number) => {
    return num?.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  };

  return (
    <div className="flex flex-col">
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
            {filteredSymbols.slice(0, 15).map((s, idx) => (
              <li
                key={s}
                className={`p-2 cursor-pointer ${
                  highlightedIndex === idx ? "bg-gray-700" : "hover:bg-gray-700"
                }`}
                onMouseEnter={() => setHighlightedIndex(idx)}
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

      {latestBar && (
        <div className="text-sm text-gray-300 bg-zinc-800 px-3 py-2 rounded mb-2">
          <span className="font-semibold text-white mr-4">{selectedSymbol}</span>
          O: {formatNumber(latestBar.open)} H: {formatNumber(latestBar.high)} L: {formatNumber(latestBar.low)} C: {formatNumber(latestBar.close)} V: {formatNumber(latestBar.volume)}
          <span className={`ml-4 font-semibold ${latestBar.close >= latestBar.open ? 'text-green-400' : 'text-red-400'}`}>
            {(((latestBar.close - latestBar.open) / latestBar.open) * 100).toFixed(2)}%
          </span>
        </div>
      )}

      <div ref={chartContainerRef} className="w-full" />
    </div>
  );
}
