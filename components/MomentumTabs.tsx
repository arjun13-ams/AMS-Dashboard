// MomentumTabs.tsx

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function calculateCloseBasedMomentum(ohlcvData) {
  if (!ohlcvData || ohlcvData.length < 63) return null;
  ohlcvData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const currentClose = ohlcvData[ohlcvData.length - 1].close;
  const last21 = ohlcvData.slice(-21);
  const last63 = ohlcvData.slice(-63);

  const minClose21 = Math.min(...last21.map((d) => d.close));
  const maxClose21 = Math.max(...last21.map((d) => d.close));
  const minClose63 = Math.min(...last63.map((d) => d.close));
  const maxClose63 = Math.max(...last63.map((d) => d.close));

  const calcScore = (close, min, max) => (max === min ? 0 : (100 * (close - min)) / (max - min));

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

  const currentClose = ohlcvData[ohlcvData.length - 1].close;
  const last21 = ohlcvData.slice(-21);
  const last63 = ohlcvData.slice(-63);

  const minLow21 = Math.min(...last21.map((d) => d.low));
  const maxHigh21 = Math.max(...last21.map((d) => d.high));
  const minLow63 = Math.min(...last63.map((d) => d.low));
  const maxHigh63 = Math.max(...last63.map((d) => d.high));

  const calcScore = (close, min, max) => (max === min ? 0 : (100 * (close - min)) / (max - min));

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

function MomentumTabs() {
  const [strategy1, setStrategy1] = useState([]);
  const [strategy2, setStrategy2] = useState([]);
  const [strategy3, setStrategy3] = useState([]);
  const [strategy4, setStrategy4] = useState([]);

  useEffect(() => {
    const fetchMomentumScores = async () => {
      const { data, error } = await supabase
        .from("ohlcv_last_6_months")
        .select("symbol, date, close, high, low, volume")
        .order("symbol")
        .order("date");

      if (error) return console.error("Error fetching data", error);
      if (!data) return;

      const grouped = {};
      for (const row of data) {
        if (!grouped[row.symbol]) grouped[row.symbol] = [];
        grouped[row.symbol].push(row);
      }

      const s1 = [], s2 = [], s3 = [], s4 = [];
      for (const symbol in grouped) {
        const ohlcv = grouped[symbol];
        if (ohlcv.length < 63) continue;

        const c = calculateCloseBasedMomentum(ohlcv);
        const t = calculateTrueRangeMomentum(ohlcv);
        const p = calculatePhysicsBasedMomentum(ohlcv);

        if (c) s1.push({ symbol, ...c });
        if (t) s2.push({ symbol, ...t });
        if (c && t) {
          s3.push({
            symbol,
            score21: +((c.score21 + t.score21) / 2).toFixed(2),
            score63: +((c.score63 + t.score63) / 2).toFixed(2),
            scoreSmooth: +((c.scoreSmooth + t.scoreSmooth) / 2).toFixed(2),
          });
        }
        if (p) s4.push({ symbol, ...p });
      }

      setStrategy1(s1.sort((a, b) => b.scoreSmooth - a.scoreSmooth).slice(0, 20));
      setStrategy2(s2.sort((a, b) => b.scoreSmooth - a.scoreSmooth).slice(0, 20));
      setStrategy3(s3.sort((a, b) => b.scoreSmooth - a.scoreSmooth).slice(0, 20));
      setStrategy4(s4.sort((a, b) => b.scoreSmooth - a.scoreSmooth).slice(0, 20));
    };

    fetchMomentumScores();
  }, []);

  return <Tabs defaultValue="strategy1">
    <TabsList>
      <TabsTrigger value="strategy1">Close Based Momentum</TabsTrigger>
      <TabsTrigger value="strategy2">True Range Momentum</TabsTrigger>
      <TabsTrigger value="strategy3">Combined Momentum</TabsTrigger>
      <TabsTrigger value="strategy4">Physics Based Momentum</TabsTrigger>
    </TabsList>
    <TabsContent value="strategy1">Table1</TabsContent>
    <TabsContent value="strategy2">Table2</TabsContent>
    <TabsContent value="strategy3">Table3</TabsContent>
    <TabsContent value="strategy4">Table4</TabsContent>
  </Tabs>
}

export default MomentumTabs;
