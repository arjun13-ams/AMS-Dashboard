import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function calculateCloseBasedMomentum(ohlcvData) {
  if (!ohlcvData || ohlcvData.length < 63) return null;
  ohlcvData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const maxDate = ohlcvData[ohlcvData.length - 1].date;
  const currentClose = ohlcvData[ohlcvData.length - 1].close;

  const filterLastNDays = (data, days) => {
    const cutoffDate = new Date(maxDate);
    cutoffDate.setDate(cutoffDate.getDate() - (days - 1));
    return data.filter((d) => new Date(d.date) >= cutoffDate);
  };

  const last21 = filterLastNDays(ohlcvData, 21);
  const last63 = filterLastNDays(ohlcvData, 63);

  const minClose21 = Math.min(...last21.map((d) => d.close));
  const maxClose21 = Math.max(...last21.map((d) => d.close));
  const minClose63 = Math.min(...last63.map((d) => d.close));
  const maxClose63 = Math.max(...last63.map((d) => d.close));

  const calcScore = (close, min, max) => (max === min ? 0 : 100 * (close - min) / (max - min));

  const score21 = calcScore(currentClose, minClose21, maxClose21);
  const score63 = calcScore(currentClose, minClose63, maxClose63);
  const scoreSmooth = 0.6 * score21 + 0.4 * score63;

  return {
    score21: +score21.toFixed(2),
    score63: +score63.toFixed(2),
    scoreSmooth: +scoreSmooth.toFixed(2),
  };
}

function calculateTrueRangeMomentum(ohlcvData) {
  if (!ohlcvData || ohlcvData.length < 63) return null;
  ohlcvData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const maxDate = ohlcvData[ohlcvData.length - 1].date;
  const currentClose = ohlcvData[ohlcvData.length - 1].close;

  const filterLastNDays = (data, days) => {
    const cutoffDate = new Date(maxDate);
    cutoffDate.setDate(cutoffDate.getDate() - (days - 1));
    return data.filter((d) => new Date(d.date) >= cutoffDate);
  };

  const last21 = filterLastNDays(ohlcvData, 21);
  const last63 = filterLastNDays(ohlcvData, 63);

  const minLow21 = Math.min(...last21.map((d) => d.low));
  const maxHigh21 = Math.max(...last21.map((d) => d.high));
  const minLow63 = Math.min(...last63.map((d) => d.low));
  const maxHigh63 = Math.max(...last63.map((d) => d.high));

  const calcScore = (close, min, max) => (max === min ? 0 : 100 * (close - min) / (max - min));

  const score21 = calcScore(currentClose, minLow21, maxHigh21);
  const score63 = calcScore(currentClose, minLow63, maxHigh63);
  const scoreSmooth = 0.6 * score21 + 0.4 * score63;

  return {
    score21: +score21.toFixed(2),
    score63: +score63.toFixed(2),
    scoreSmooth: +scoreSmooth.toFixed(2),
  };
}

function calculatePhysicsBasedMomentum(ohlcvData) {
  if (!ohlcvData || ohlcvData.length < 63) return null;
  ohlcvData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const log = (x) => Math.log(x);
  const velocity = ohlcvData.map((d, i) => (i > 0 ? log(d.close) - log(ohlcvData[i - 1].close) : 0));
  const mass = ohlcvData.map((d) => d.close * d.volume);
  const mv = velocity.map((v, i) => v * mass[i]);

  const sum = (arr) => arr.reduce((a, b) => a + b, 0);
  const lastN = (arr, n) => arr.slice(-n);

  const p1_short = sum(lastN(mv, 21));
  const p1_long = sum(lastN(mv, 63));
  const mass_short = sum(lastN(mass, 21));
  const mass_long = sum(lastN(mass, 63));

  const p2_short = mass_short === 0 ? 0 : p1_short / mass_short;
  const p2_long = mass_long === 0 ? 0 : p1_long / mass_long;
  const p2_smooth = 0.6 * p2_short + 0.4 * p2_long;

  return {
    score21: +p2_short.toFixed(2),
    score63: +p2_long.toFixed(2),
    scoreSmooth: +p2_smooth.toFixed(2),
  };
}

export default function MomentumTabs() {
  const [strategy1, setStrategy1] = useState([]);
  const [strategy2, setStrategy2] = useState([]);
  const [strategy3, setStrategy3] = useState([]);
  const [strategy4, setStrategy4] = useState([]);

  useEffect(() => {
    const fetchMomentumScores = async () => {
      const { data: symbolsData } = await supabase
        .from("ohlcv_last_6_months")
        .select("symbol")
        .neq("symbol", null)
        .order("symbol", { ascending: true });

      const symbols = Array.from(new Set(symbolsData.map((r) => r.symbol)));

      const s1 = [], s2 = [], s3 = [], s4 = [];

      for (const symbol of symbols) {
        const { data: ohlcv } = await supabase
          .from("ohlcv_last_6_months")
          .select("date, close, high, low, volume")
          .eq("symbol", symbol)
          .order("date", { ascending: true });

        const closeScore = calculateCloseBasedMomentum(ohlcv);
        const trScore = calculateTrueRangeMomentum(ohlcv);
        const physicsScore = calculatePhysicsBasedMomentum(ohlcv);

        if (closeScore) s1.push({ symbol, ...closeScore });
        if (trScore) s2.push({ symbol, ...trScore });
        if (closeScore && trScore) {
          const combined = {
            score21: +((closeScore.score21 + trScore.score21) / 2).toFixed(2),
            score63: +((closeScore.score63 + trScore.score63) / 2).toFixed(2),
            scoreSmooth: +((closeScore.scoreSmooth + trScore.scoreSmooth) / 2).toFixed(2),
          };
          s3.push({ symbol, ...combined });
        }
        if (physicsScore) s4.push({ symbol, ...physicsScore });
      }

      s1.sort((a, b) => b.scoreSmooth - a.scoreSmooth);
      s2.sort((a, b) => b.scoreSmooth - a.scoreSmooth);
      s3.sort((a, b) => b.scoreSmooth - a.scoreSmooth);
      s4.sort((a, b) => b.scoreSmooth - a.scoreSmooth);

      setStrategy1(s1.slice(0, 20));
      setStrategy2(s2.slice(0, 20));
      setStrategy3(s3.slice(0, 20));
      setStrategy4(s4.slice(0, 20));
    };

    fetchMomentumScores();
  }, []);

  const renderCards = (data) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {data.map((stock) => (
        <div
          key={stock.symbol}
          className="border border-gray-700 rounded-xl p-4 bg-zinc-900 shadow-md"
        >
          <div className="text-xl font-bold text-green-400">{stock.symbol}</div>
          <div className="text-sm text-white">21d Score: {stock.score21}</div>
          <div className="text-sm text-white">63d Score: {stock.score63}</div>
          <div className="text-lg text-yellow-400 font-semibold">
            Momentum Score: {stock.scoreSmooth}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <Tabs defaultValue="strategy1" className="w-full">
      <TabsList>
        <TabsTrigger value="strategy1">Strategy #1</TabsTrigger>
        <TabsTrigger value="strategy2">Strategy #2</TabsTrigger>
        <TabsTrigger value="strategy3">Strategy #3</TabsTrigger>
        <TabsTrigger value="strategy4">Strategy #4</TabsTrigger>
      </TabsList>
      <TabsContent value="strategy1">{renderCards(strategy1)}</TabsContent>
      <TabsContent value="strategy2">{renderCards(strategy2)}</TabsContent>
      <TabsContent value="strategy3">{renderCards(strategy3)}</TabsContent>
      <TabsContent value="strategy4">{renderCards(strategy4)}</TabsContent>
    </Tabs>
  );
}
