"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type MomentumData = {
  symbol: string;
  score21: number;
  score63: number;
  momentumScore: number;
  trend: "Up" | "Down" | "Flat";
};

const TOP_N = 20;

const strategies = [
  { id: 1, name: "Close Based" },
  { id: 2, name: "True Range Based" },
  { id: 3, name: "Combined Based" },
  { id: 4, name: "Physics Mass*Velocity" },
];

export default function MomentumTabs() {
  const [activeStrategy, setActiveStrategy] = useState(1);
  const [data, setData] = useState<MomentumData[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortKey, setSortKey] = useState<keyof MomentumData>("momentumScore");
  const [sortAsc, setSortAsc] = useState(false);
  const [loading, setLoading] = useState(false);

  function min(arr: number[]) {
    return Math.min(...arr);
  }
  function max(arr: number[]) {
    return Math.max(...arr);
  }

  function scaleScore(val: number, minVal: number, maxVal: number) {
    if (maxVal === minVal) return 50;
    return ((val - minVal) / (maxVal - minVal)) * 99 + 1;
  }

  async function fetchAndCalculate(strategyId: number) {
    setLoading(true);
    try {
      const { data: symbolsData, error: errSymbols } = await supabase
        .from("ohlcv_last_6_months")
        .select("symbol")
        .neq("symbol", null)
        .group("symbol");

      if (errSymbols || !symbolsData) throw errSymbols || new Error("No symbols");

      const symbols = symbolsData.map((r) => r.symbol);

      const results: MomentumData[] = [];

      for (const symbol of symbols) {
        const { data: ohlcv, error: ohlcvErr } = await supabase
          .from("ohlcv_last_6_months")
          .select("date, open, high, low, close, volume")
          .eq("symbol", symbol)
          .order("date", { ascending: true });

        if (ohlcvErr || !ohlcv || ohlcv.length < 63) continue;

        const getLookbackSlice = (days: number) => ohlcv.slice(-days);

        const scoreClose = (days: number) => {
          const slice = getLookbackSlice(days);
          const closes = slice.map((x) => x.close);
          const currClose = closes[closes.length - 1];
          const minClose = min(closes);
          const maxClose = max(closes);
          return scaleScore(currClose, minClose, maxClose);
        };

        const scoreTrueRange = (days: number) => {
          const slice = getLookbackSlice(days);
          const lows = slice.map((x) => x.low);
          const highs = slice.map((x) => x.high);
          const closes = slice.map((x) => x.close);
          const currClose = closes[closes.length - 1];
          const minLow = min(lows);
          const maxHigh = max(highs);
          return scaleScore(currClose, minLow, maxHigh);
        };

        const scorePhysics = (days: number) => {
          const slice = getLookbackSlice(days);
          const massVelocity = slice.map((x) => x.close * x.volume);
          const currMv = massVelocity[massVelocity.length - 1];
          const minMv = min(massVelocity);
          const maxMv = max(massVelocity);
          return scaleScore(currMv, minMv, maxMv);
        };

        const w21 = 0.6;
        const w63 = 0.4;

        let score21 = 0,
          score63 = 0,
          momentumScore = 0;

        switch (strategyId) {
          case 1:
            score21 = scoreClose(21);
            score63 = scoreClose(63);
            momentumScore = score21 * w21 + score63 * w63;
            break;
          case 2:
            score21 = scoreTrueRange(21);
            score63 = scoreTrueRange(63);
            momentumScore = score21 * w21 + score63 * w63;
            break;
          case 3:
            const s1_21 = scoreClose(21);
            const s1_63 = scoreClose(63);
            const s2_21 = scoreTrueRange(21);
            const s2_63 = scoreTrueRange(63);
            score21 = (s1_21 + s2_21) / 2;
            score63 = (s1_63 + s2_63) / 2;
            momentumScore = score21 * w21 + score63 * w63;
            break;
          case 4:
            score21 = scorePhysics(21);
            score63 = scorePhysics(63);
            momentumScore = score21 * w21 + score63 * w63;
            break;
        }

        let trend: "Up" | "Down" | "Flat" = "Flat";
        if (score21 > score63) trend = "Up";
        else if (score21 < score63) trend = "Down";

        results.push({
          symbol,
          score21: Number(score21.toFixed(2)),
          score63: Number(score63.toFixed(2)),
          momentumScore: Number(momentumScore.toFixed(2)),
          trend,
        });
      }

      results.sort((a, b) => b.momentumScore - a.momentumScore);
      setData(results.slice(0, TOP_N));
    } catch (err) {
      console.error(err);
      setData([]);
    } finally {
      setLoading(false);
    }
  }

  function handleSort(key: keyof MomentumData) {
    if (key === sortKey) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  const filteredData = data
    .filter((d) => d.symbol.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];
      if (typeof valA === "string" && typeof valB === "string") {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else if (typeof valA === "number" && typeof valB === "number") {
        return sortAsc ? valA - valB : valB - valA;
      }
      return 0;
    });

  useEffect(() => {
    fetchAndCalculate(activeStrategy);
  }, [activeStrategy]);

  return (
    <div className="p-4 text-white bg-gray-900 rounded shadow">
      <div className="mb-4 flex space-x-4 border-b border-gray-700">
        {strategies.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveStrategy(s.id)}
            className={`pb-2 font-semibold border-b-4 ${
              activeStrategy === s.id
                ? "border-green-400 text-green-400"
                : "border-transparent hover:text-green-300"
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>

      <input
        className="mb-4 p-2 rounded bg-gray-800 border border-gray-700 w-full text-white"
        type="text"
        placeholder="Search symbol..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      <div className="overflow-x-auto">
        <table className="w-full table-auto text-left border-collapse border border-gray-700">
          <thead>
            <tr>
              {[
                { label: "Symbol", key: "symbol" },
                { label: "Momentum Score", key: "momentumScore" },
                { label: "21-day Score", key: "score21" },
                { label: "63-day Score", key: "score63" },
                { label: "Trend", key: "trend" },
              ].map(({ label, key }) => (
                <th
                  key={key}
                  className="cursor-pointer p-2 border border-gray-700"
                  onClick={() => handleSort(key as keyof MomentumData)}
                >
                  {label} {sortKey === key && (sortAsc ? "▲" : "▼")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="p-4 text-center text-gray-400">
                  Loading...
                </td>
              </tr>
            ) : filteredData.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-4 text-center text-gray-400">
                  No data found
                </td>
              </tr>
            ) : (
              filteredData.map(({ symbol, momentumScore, score21, score63, trend }) => (
                <tr key={symbol} className="hover:bg-gray-800">
                  <td className="p-2 border border-gray-700 font-mono">{symbol}</td>
                  <td className="p-2 border border-gray-700">{momentumScore.toFixed(2)}</td>
                  <td className="p-2 border border-gray-700">{score21.toFixed(2)}</td>
                  <td className="p-2 border border-gray-700">{score63.toFixed(2)}</td>
                  <td
                    className={`p-2 border border-gray-700 font-semibold ${
                      trend === "Up"
                        ? "text-green-400"
                        : trend === "Down"
                        ? "text-red-400"
                        : "text-gray-400"
                    }`}
                  >
                    {trend}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
