"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  createChart,
  IChartApi,
  ISeriesApi,
  HistogramData,
  UTCTimestamp,
  HistogramStyleOptions,
  LineStyle,
} from "lightweight-charts";
import { supabase } from "../lib/supabase";
import dayjs from "dayjs";

type OHLCV = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type Timeframe = "D" | "W" | "M";

export default function ChartView() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  const [symbols, setSymbols] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredSymbols, setFilteredSymbols] = useState<string[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string>("TCS");
  const [timeframe, setTimeframe] = useState<Timeframe>("D");
  const [loading, setLoading] = useState(false);
  const [latestBar, setLatestBar] = useState<OHLCV | null>(null);

  // Fetch all symbols once
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

  // Filter symbols on search term
  useEffect(() => {
    const filtered = symbols.filter((s) => s.toLowerCase().includes(searchTerm.toLowerCase()));
    setFilteredSymbols(filtered);
  }, [searchTerm, symbols]);

  // Create chart on mount or selectedSymbol/timeframe change
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Clear previous chart instance
    if (chartRef.current) {
      chartRef.current.remove();
    }

    // Create chart with dark theme and grid
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { color: "#111" },
        textColor: "#DDD",
      },
      grid: {
        vertLines: { color: "#222" },
        horzLines: { color: "#222" },
      },
      timeScale: {
        timeVisible: true,
        borderColor: "#555",
      },
      rightPriceScale: {
        borderColor: "#555",
      },
      leftPriceScale: {
        visible: false,
      },
      height: 500,
      localization: {
        dateFormat: "yyyy-MM-dd",
      },
    });

    chartRef.current = chart;

    // Add candlestick series
    const candleSeries = chart.addCandlestickSeries({
      upColor: "#4AFA9A",
      downColor: "#E33F64",
      borderVisible: false,
      wickUpColor: "#4AFA9A",
      wickDownColor: "#E33F64",
    });

    candleSeriesRef.current = candleSeries;

    // Add volume histogram series on separate price scale with scaleMargins
    const volumeSeries = chart.addHistogramSeries({
      color: "#26a69a",
      priceFormat: {
        type: "volume",
      },
      priceScaleId: "volume",
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
      priceLineVisible: false,
    } as HistogramStyleOptions);

    volumeSeriesRef.current = volumeSeries;

    return () => {
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
  }, [selectedSymbol, timeframe]);

  // Fetch OHLCV data when selectedSymbol or timeframe changes
  useEffect(() => {
    if (!selectedSymbol) return;

    setLoading(true);
    async function fetchData() {
      // For timeframe support, aggregate data as needed
      // Fetch daily data always, then aggregate in client for weekly/monthly
      // Supabase doesn't support complex aggregates easily, so we do it in JS

      const { data, error } = await supabase
        .from("ohlcv_data")
        .select("date, open, high, low, close, volume")
        .eq("symbol", selectedSymbol)
        .order("date", { ascending: true });

      if (error || !data) {
        setLoading(false);
        return;
      }

      let ohlcv: OHLCV[] = data;

      // Aggregate for weekly/monthly if needed
      if (timeframe === "W") {
        ohlcv = aggregateWeekly(ohlcv);
      } else if (timeframe === "M") {
        ohlcv = aggregateMonthly(ohlcv);
      }

      // Prepare candlestick data
      const candleData = ohlcv.map((bar) => ({
        time: toChartTime(bar.date),
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
      }));

      // Prepare volume data (histogram requires value and time)
      const volumeData: HistogramData[] = ohlcv.map((bar) => ({
        time: toChartTime(bar.date),
        value: bar.volume,
        color: bar.close >= bar.open ? "#4AFA9A" : "#E33F64",
      }));

      // Update series data
      candleSeriesRef.current?.setData(candleData);
      volumeSeriesRef.current?.setData(volumeData);

      // Set latest bar for display info
      setLatestBar(ohlcv[ohlcv.length - 1] ?? null);

      setLoading(false);
    }

    fetchData();
  }, [selectedSymbol, timeframe]);

  // Helpers
  function toChartTime(dateString: string): UTCTimestamp {
    // lightweight-charts expects UTC timestamp (seconds since epoch)
    return Math.floor(new Date(dateString + "T00:00:00Z").getTime() / 1000);
  }

  function aggregateWeekly(data: OHLCV[]): OHLCV[] {
    // Group by ISO week year + week number
    const weeks: { [key: string]: OHLCV[] } = {};

    data.forEach((bar) => {
      const d = dayjs(bar.date);
      const weekKey = d.year() + "-W" + d.isoWeek(); // isoWeek requires isoWeek plugin, so use week()
      // Since you may not have isoWeek plugin, fallback to simple week:
      //const weekKey = d.year() + "-W" + d.week();

      if (!weeks[weekKey]) weeks[weekKey] = [];
      weeks[weekKey].push(bar);
    });

    // Aggregate OHLCV per week
    return Object.values(weeks).map((weekBars) => {
      const sorted = weekBars.sort((a, b) => a.date.localeCompare(b.date));
      const open = sorted[0].open;
      const close = sorted[sorted.length - 1].close;
      const high = Math.max(...sorted.map((b) => b.high));
      const low = Math.min(...sorted.map((b) => b.low));
      const volume = sorted.reduce((sum, b) => sum + b.volume, 0);
      const date = sorted[sorted.length - 1].date; // use last day of week as time

      return { date, open, high, low, close, volume };
    });
  }

  function aggregateMonthly(data: OHLCV[]): OHLCV[] {
    // Group by year-month
    const months: { [key: string]: OHLCV[] } = {};

    data.forEach((bar) => {
      const d = dayjs(bar.date);
      const monthKey = d.format("YYYY-MM");

      if (!months[monthKey]) months[monthKey] = [];
      months[monthKey].push(bar);
    });

    // Aggregate OHLCV per month
    return Object.values(months).map((monthBars) => {
      const sorted = monthBars.sort((a, b) => a.date.localeCompare(b.date));
      const open = sorted[0].open;
      const close = sorted[sorted.length - 1].close;
      const high = Math.max(...sorted.map((b) => b.high));
      const low = Math.min(...sorted.map((b) => b.low));
      const volume = sorted.reduce((sum, b) => sum + b.volume, 0);
      const date = sorted[sorted.length - 1].date; // use last day of month as time

      return { date, open, high, low, close, volume };
    });
  }

  // Render selected symbol OHLCV summary at top
  const prevClose = latestBar ? latestBar.close : 0;
  const prevCloseCompare = latestBar ? latestBar.close - latestBar.open : 0;
  const pctChange =
    latestBar && latestBar.close && latestBar.open
      ? ((latestBar.close - latestBar.open) / latestBar.open) * 100
      : 0;

  return (
    <div className="flex flex-col text-white">
      <div className="mb-4">
        <input
          className="p-2 rounded border border-gray-600 bg-gray-800 text-white w-full"
          type="text"
          placeholder="Search symbol"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && filteredSymbols.length > 0) {
              setSelectedSymbol(filteredSymbols[0]);
              setSearchTerm("");
            }
          }}
        />
        {searchTerm && (
          <ul className="bg-gray-900 max-h-48 overflow-auto rounded mt-1 text-sm border border-gray-700">
            {filteredSymbols.slice(0, 15).map((s, i) => (
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

      <div className="mb-2 flex gap-4 text-sm items-center">
        <div>
          <strong>Symbol:</strong> {selectedSymbol.toUpperCase()}
        </div>
        {latestBar && (
          <>
            <div>
              <strong>O:</strong> {latestBar.open.toFixed(2)}
            </div>
            <div>
              <strong>H:</strong> {latestBar.high.toFixed(2)}
            </div>
            <div>
              <strong>L:</strong> {latestBar.low.toFixed(2)}
            </div>
            <div>
              <strong>C:</strong> {latestBar.close.toFixed(2)}
            </div>
            <div>
              <strong>Vol:</strong> {latestBar.volume.toLocaleString()}
            </div>
            <div
              className={`font-semibold ${
                pctChange > 0 ? "text-green-400" : pctChange < 0 ? "text-red-400" : "text-white"
              }`}
            >
              {pctChange.toFixed(2)}%
            </div>
          </>
        )}
      </div>

      <div className="mb-4">
        <button
          className={`mr-2 px-3 py-1 rounded ${
            timeframe === "D" ? "bg-green-700" : "bg-gray-800"
          }`}
          onClick={() => setTimeframe("D")}
        >
          Daily
        </button>
        <button
          className={`mr-2 px-3 py-1 rounded ${
            timeframe === "W" ? "bg-green-700" : "bg-gray-800"
          }`}
          onClick={() => setTimeframe("W")}
        >
          Weekly
        </button>
        <button
          className={`px-3 py-1 rounded ${
            timeframe === "M" ? "bg-green-700" : "bg-gray-800"
          }`}
          onClick={() => setTimeframe("M")}
        >
          Monthly
        </button>
      </div>

      <div ref={chartContainerRef} className="w-full" />
      {loading && <div className="text-white mt-2">Loading data...</div>}
    </div>
  );
}
