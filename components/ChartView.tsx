"use client";

import React, { useEffect, useRef, useState } from "react";
import { createChart, IChartApi, ISeriesApi, HistogramData } from "lightweight-charts";
import { supabase } from "../lib/supabase";

export default function ChartView() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const ema10SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const ema21SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  const [symbols, setSymbols] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredSymbols, setFilteredSymbols] = useState<string[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string>("TCS");

  // Fetch symbols on mount
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

  // Filter symbols on search term change
  useEffect(() => {
    const filtered = symbols.filter((s) => s.toLowerCase().includes(searchTerm.toLowerCase()));
    setFilteredSymbols(filtered);
  }, [searchTerm, symbols]);

  // Initialize chart and series when selectedSymbol changes
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Remove existing chart if any
    if (chartRef.current) {
      chartRef.current.remove();
    }

    const chart = createChart(chartContainerRef.current, {
      layout: { background: { color: "#111" }, textColor: "#DDD" },
      grid: { vertLines: { color: "#222" }, horzLines: { color: "#222" } },
      timeScale: { timeVisible: true },
      height: 500,
      rightPriceScale: { scaleMargins: { top: 0.3, bottom: 0.25 } },
      // we will create separate scale for volume
    });

    chartRef.current = chart;

    // Add candlestick series
    candleSeriesRef.current = chart.addCandlestickSeries();

    // Add volume histogram below candles with own price scale on left
    volumeSeriesRef.current = chart.addHistogramSeries({
      priceScaleId: '',  // separate scale
      scaleMargins: { top: 0.8, bottom: 0 }, // small portion at bottom for volume
      color: '#26a69a',
      priceFormat: {
        type: 'volume',
      },
      overlay: false,
    });

    // Add EMA line series
    ema10SeriesRef.current = chart.addLineSeries({ color: "orange", lineWidth: 1 });
    ema21SeriesRef.current = chart.addLineSeries({ color: "cyan", lineWidth: 1 });

  }, [selectedSymbol]);

  // Fetch OHLCV data and update chart
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

      candleSeriesRef.current?.setData(candleData);

      // Volume data for histogram
      // Use green if close >= open, else red
      const volumeData: HistogramData[] = data.map((row) => ({
        time: row.date,
        value: row.volume,
        color: row.close >= row.open ? 'rgba(38, 166, 154, 0.8)' : 'rgba(255, 82, 82, 0.8)',
      }));

      volumeSeriesRef.current?.setData(volumeData);

      // EMA Calculation
      const ema = (period: number) => {
        const k = 2 / (period + 1);
        const result: { time: string; value: number }[] = [];
        let prevEma: number | undefined;

        candleData.forEach((bar, i) => {
          if (i < period - 1) return;
          if (i === period - 1) {
            const sum = candleData.slice(0, period).reduce((acc, d) => acc + d.close, 0);
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

  return (
    <div className="flex flex-col">
      <div className="mb-4">
        <input
          className="p-2 rounded border border-gray-600 bg-gray-800 text-white w-full"
          type="text"
          placeholder="Search symbol"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <ul className="bg-gray-900 max-h-48 overflow-auto rounded mt-1 text-sm border border-gray-700">
            {filteredSymbols.slice(0, 15).map((s) => (
              <li
                key={s}
                className="p-2 hover:bg-gray-700 cursor-pointer"
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
      <div ref={chartContainerRef} className="w-full" />
    </div>
  );
}
