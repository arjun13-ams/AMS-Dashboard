import { useEffect, useState, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// === Helper Components and Functions ===

function getTrend(score21: number, score63: number) {
  if (score21 > score63) return "📈 up";
  if (score21 < score63) return "📉 down";
  return "➡ flat";
}


function MomentumTable({ data, loading }: { data: any[]; loading: boolean }) {
  const [search, setSearch] = useState("");
  const [topN, setTopN] = useState("20");
  const [sortConfig, setSortConfig] = useState({ key: "scoreSmooth", direction: "descending" });

  const filteredData = useMemo(() => {
    let filtered = data;
    const query = search.trim().toLowerCase();
    const opRegex = /(score|21d|63d)\s*([<>=]+)\s*(\d+(\.\d+)?)/;

    const match = query.match(opRegex);
    if (match) {
      const [, fieldAlias, operator, rawValue] = match;
      const value = parseFloat(rawValue);
      const fieldMap = {
        score: "scoreSmooth",
        "21d": "score21",
        "63d": "score63",
      };
      const field = fieldMap[fieldAlias as keyof typeof fieldMap];
      filtered = filtered.filter((item) => {
        const val = item[field];
        switch (operator) {
          case ">=": return val >= value;
          case "<=": return val <= value;
          case ">": return val > value;
          case "<": return val < value;
          case "=": return val === value;
          default: return true;
        }
      });
    } else if (["up", "down", "flat"].includes(query)) {
      filtered = filtered.filter((item) => {
        const trend = item.score21 > item.score63 ? "up" : item.score21 < item.score63 ? "down" : "flat";
        return trend === query;
      });
    } else if (query) {
      filtered = filtered.filter((item) =>
        item.symbol.toLowerCase().includes(query) ||
        item.scoreSmooth.toString().includes(query) ||
        item.score21.toString().includes(query) ||
        item.score63.toString().includes(query)
      );
    }

    if (sortConfig !== null) {
      filtered = filtered.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        if (aVal < bVal) return sortConfig.direction === "ascending" ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === "ascending" ? 1 : -1;
        return 0;
      });
    }

    const n = parseInt(topN);
    if (!isNaN(n) && n > 0) {
      filtered = filtered.slice(0, n);
    }

    return filtered;
  }, [data, search, topN, sortConfig]);

  const requestSort = (key: string) => {
    let direction = "ascending";
    if (sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
    }
    setSortConfig({ key, direction });
  };

  if (loading) {
    return <div className="text-white py-6 text-center">Loading data...</div>;
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-4">
        <input
          type="text"
          placeholder="Search or try: score >= 60, 21d < 40, up"
          className="p-2 rounded border border-gray-600 bg-zinc-900 text-white w-full max-w-md"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex items-center gap-2">
          <span className="text-white">Top</span>
          <input
            type="number"
            min="0"
            placeholder="All"
            className="p-2 rounded border border-gray-600 bg-zinc-900 text-white w-20"
            value={topN}
            onChange={(e) => setTopN(e.target.value)}
          />
        </div>
      </div>
      <div className="overflow-x-auto rounded border border-gray-700">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-gray-800 text-white">
            <tr>
              <th className="px-4 py-2 text-center">RANK</th>
              <th className="cursor-pointer px-4 py-2 text-left" onClick={() => requestSort("symbol")}>SYMBOL</th>
              <th className="cursor-pointer px-4 py-2 text-right" onClick={() => requestSort("scoreSmooth")}>SCORE</th>
              <th className="cursor-pointer px-4 py-2 text-right" onClick={() => requestSort("score21")}>21D</th>
              <th className="cursor-pointer px-4 py-2 text-right" onClick={() => requestSort("score63")}>63D</th>
              <th className="px-4 py-2 text-center">TREND</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700 text-white">
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-4 text-gray-500">No stocks found.</td>
              </tr>
            ) : (
              filteredData.map(({ symbol, scoreSmooth, score21, score63, rank }) => (
                <tr key={symbol}>
                  <td className="px-4 py-2 text-center">{rank}</td>
                  <td className="px-4 py-2 font-semibold">{symbol}</td>
                  <td className="px-4 py-2 text-right">{scoreSmooth.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right">{score21.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right">{score63.toFixed(2)}</td>
                  <td className="px-4 py-2 text-center">{getTrend(score21, score63)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

//export default MomentumTable;

// === Momentum Calculators ===

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

  const calcScore = (close, min, max) => (max === min ? 0 : 100 * (close - min) / (max - min));

  const score21 = calcScore(currentClose, minClose21, maxClose21);
  const score63 = calcScore(currentClose, minClose63, maxClose63);
  const scoreSmooth = 0.6 * score21 + 0.4 * score63;

  console.log("[CloseBased]", { score21, score63, scoreSmooth });

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

  const calcScore = (close, min, max) => (max === min ? 0 : 100 * (close - min) / (max - min));

  const score21 = calcScore(currentClose, minLow21, maxHigh21);
  const score63 = calcScore(currentClose, minLow63, maxHigh63);
  const scoreSmooth = 0.6 * score21 + 0.4 * score63;

  console.log("[TrueRange]", { score21, score63, scoreSmooth });

  return {
    score21: +score21.toFixed(2),
    score63: +score63.toFixed(2),
    scoreSmooth: +scoreSmooth.toFixed(2),
  };
}

function calculatePhysicsBasedMomentum(ohlcvData) {
  if (!ohlcvData || ohlcvData.length < 63) return null;

  // Step 1: Sort by date ascending (oldest first)
  #ohlcvData.sort((a, b) => new Date(a.date) - new Date(b.date));
  ohlcvData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Step 2: Use the latest available trading day
  const latestIndex = ohlcvData.length - 1;
  const latestDate = ohlcvData[latestIndex].date;

  // Step 3: Extract last 63 trading days (we include a few extra for velocity)
  const recentData = ohlcvData.slice(-64); // one extra for velocity diff
  if (recentData.length < 63) return null;

  const log = (x) => Math.log(x);
  const velocity = recentData.map((d, i) =>
    i > 0 ? log(d.close) - log(recentData[i - 1].close) : 0
  );
  const mass = recentData.map((d) => d.close * d.volume);
  const mv = velocity.map((v, i) => v * mass[i]);

  const sum = (arr) => arr.reduce((a, b) => a + b, 0);

  // Step 4: Compute scores using last 21 and 63 trading rows
  const p1_short = sum(mv.slice(-21));
  const p1_long = sum(mv.slice(-63));
  const mass_short = sum(mass.slice(-21));
  const mass_long = sum(mass.slice(-63));

  const p2_short = mass_short === 0 ? 0 : p1_short / mass_short;
  const p2_long = mass_long === 0 ? 0 : p1_long / mass_long;
  const p2_smooth = 0.6 * p2_short + 0.4 * p2_long;
  const p1_smooth = 0.6 * p1_short + 0.4 * p1_long;

  console.log(`[Physics] ${ohlcvData[0].symbol || ''} on ${latestDate}`, {
    p1_short,
    p1_long,
    p1_smooth,
  });

  return {
    score21: +p1_short.toFixed(2),
    score63: +p1_long.toFixed(2),
    scoreSmooth: +p1_smooth.toFixed(2),
  };
}

function calculatePhysicsBasedMomentum_old(ohlcvData) {
  if (!ohlcvData || ohlcvData.length < 63) return null;
  ohlcvData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const log = (x) => Math.log(x);
  const velocity = ohlcvData.map((d, i) => (i > 0 ? log(d.close) - log(ohlcvData[i - 1].close) : 0));
  const mass = ohlcvData.map((d) => d.close * d.volume);
  const mv = velocity.map((v, i) => v * mass[i]);

  const sum = (arr) => arr.reduce((a, b) => a + b, 0);
  const p1_short = sum(mv.slice(-21));
  const p1_long = sum(mv.slice(-63));
  const mass_short = sum(mass.slice(-21));
  const mass_long = sum(mass.slice(-63));

  const p2_short = mass_short === 0 ? 0 : p1_short / mass_short;
  const p2_long = mass_long === 0 ? 0 : p1_long / mass_long;
  const p2_smooth = 0.6 * p2_short + 0.4 * p2_long;
  const p1_smooth = 0.6 * p1_short + 0.4 * p1_long;

  console.log("[Physics]", { p1_short, p1_long, p1_smooth });

  return {
    score21: +p1_short.toFixed(2),
    score63: +p1_long.toFixed(2),
    scoreSmooth: +p1_smooth.toFixed(2),
  };
}

async function fetchAllOhlcv() {
  const batchSize = 1000;
  let offset = 0;
  let allRows = [];

  while (true) {
    console.log(`Fetching rows ${offset} to ${offset + batchSize - 1}...`);
    const { data, error } = await supabase
      .from("ohlcv_last_6_months")
      .select("symbol, date, close, high, low, volume")
      .order("date", { ascending: true })
      .range(offset, offset + batchSize - 1);

    if (error) {
      console.error("Error fetching OHLCV data:", error);
      break;
    }

    if (!data || data.length === 0) {
      console.log("No more data to fetch.");
      break;
    }

    allRows = allRows.concat(data);
    offset += batchSize;

    // If less than batchSize returned, we're done
    if (data.length < batchSize) break;
  }

  console.log(`Total rows fetched: ${allRows.length}`);
  return allRows;
}


// === Main Component ===

export default function MomentumTabs() {
  const [strategy1, setStrategy1] = useState([]);
  const [strategy2, setStrategy2] = useState([]);
  const [strategy3, setStrategy3] = useState([]);
  const [strategy4, setStrategy4] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMomentumScores = async () => {
      console.log("⏳ Fetching OHLCV data from Supabase...");
      const allOhlcv = await fetchAllOhlcv();

      if (!allOhlcv || allOhlcv.length === 0) {
        console.warn("⚠️ No OHLCV data returned.");
        setLoading(false);
        return;
      }

      console.log("✅ OHLCV data fetched:", allOhlcv.length, "rows");

      const grouped = allOhlcv.reduce((acc, row) => {
        acc[row.symbol] = acc[row.symbol] || [];
        acc[row.symbol].push(row);
        return acc;
      }, {} as Record<string, any[]>);

      console.log("📦 Grouped data by symbol:", Object.keys(grouped).length, "symbols");

      const s1 = [], s2 = [], s3 = [], s4 = [];

      for (const symbol in grouped) {
        const ohlcv = grouped[symbol];

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

      console.log("📊 Strategy data prepared: ", {
        closeBased: s1.length,
        trueRange: s2.length,
        combined: s3.length,
        physics: s4.length,
      });

      setStrategy1(s1.sort((a, b) => b.scoreSmooth - a.scoreSmooth).map((item, index) => ({ ...item, rank: index + 1 })));
      setStrategy2(s2.sort((a, b) => b.scoreSmooth - a.scoreSmooth).map((item, index) => ({ ...item, rank: index + 1 })));
      setStrategy3(s3.sort((a, b) => b.scoreSmooth - a.scoreSmooth).map((item, index) => ({ ...item, rank: index + 1 })));
      setStrategy4(s4.sort((a, b) => b.scoreSmooth - a.scoreSmooth).map((item, index) => ({ ...item, rank: index + 1 })));

      setLoading(false);
    };

    fetchMomentumScores();
  }, []);

  return (
    <Tabs defaultValue="strategy1" className="w-full">
      <TabsList>
        <TabsTrigger value="strategy1">Close Based Momentum</TabsTrigger>
        <TabsTrigger value="strategy2">True Range Momentum</TabsTrigger>
        <TabsTrigger value="strategy3">Combined Momentum</TabsTrigger>
        <TabsTrigger value="strategy4">Physics Based Momentum</TabsTrigger>
      </TabsList>
      <TabsContent value="strategy1">
        <MomentumTable data={strategy1} loading={loading} />
      </TabsContent>
      <TabsContent value="strategy2">
        <MomentumTable data={strategy2} loading={loading} />
      </TabsContent>
      <TabsContent value="strategy3">
        <MomentumTable data={strategy3} loading={loading} />
      </TabsContent>
      <TabsContent value="strategy4">
        <MomentumTable data={strategy4} loading={loading} />
      </TabsContent>
    </Tabs>
  );
}
