import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function RebalanceTabs() {
  const [dates, setDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [logs, setLogs] = useState({});
  const strategies = ["P1-CLOSE", "P2-TR", "P3-COMB", "P4-MV"];

  useEffect(() => {
    const fetchRebalanceDates = async () => {
      const { data, error } = await supabase
        .from("weekly_rebalance")
        .select("date")
        .order("date", { ascending: false });

      if (data && data.length) {
        const uniqueDates = Array.from(new Set(data.map((d) => d.date))).slice(0, 5);
        setDates(uniqueDates);
        setSelectedDate(uniqueDates[0]);
      }
    };
    fetchRebalanceDates();
  }, []);

  useEffect(() => {
    if (!selectedDate) return;
    const fetchLogs = async () => {
      const allLogs = {};
      for (const strategy of strategies) {
        const { data: current } = await supabase
          .from("weekly_rebalance")
          .select("symbol")
          .eq("strategy", strategy)
          .eq("date", selectedDate);

        const { data: previous } = await supabase
          .from("weekly_rebalance")
          .select("symbol")
          .eq("strategy", strategy)
          .lt("date", selectedDate)
          .order("date", { ascending: false })
          .limit(1);

        const currentSymbols = current?.map((r) => r.symbol) || [];
        const previousSymbols = previous?.map((r) => r.symbol) || [];

        const added = currentSymbols.filter((s) => !previousSymbols.includes(s));
        const held = currentSymbols.filter((s) => previousSymbols.includes(s));
        const removed = previousSymbols.filter((s) => !currentSymbols.includes(s));

        allLogs[strategy] = { added, held, removed };
      }
      setLogs(allLogs);
    };
    fetchLogs();
  }, [selectedDate]);

  const renderLog = (strategyKey) => {
    const data = logs[strategyKey];
    if (!data) return <div>Loading...</div>;
    return (
      <div className="space-y-4">
        <table className="w-full text-sm border border-gray-700">
          <thead className="bg-zinc-800">
            <tr>
              <th className="p-2 text-left">Symbol</th>
              <th className="p-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.added.map((s) => (
              <tr key={s} className="bg-green-900/40">
                <td className="p-2 font-semibold">{s}</td>
                <td className="p-2">🟢 Added *</td>
              </tr>
            ))}
            {data.held.map((s) => (
              <tr key={s} className="bg-blue-900/40">
                <td className="p-2">{s}</td>
                <td className="p-2">✅ Held</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="text-sm text-red-400">
          ❌ Removed this week:
          <ul className="list-disc ml-5">
            {data.removed.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap gap-2">
        {dates.map((d) => (
          <button
            key={d}
            className={`px-4 py-1 rounded border ${
              d === selectedDate ? "bg-green-800 border-green-400" : "bg-zinc-800 border-gray-600"
            }`}
            onClick={() => setSelectedDate(d)}
          >
            {d}
          </button>
        ))}
      </div>

      <Tabs defaultValue="P1-CLOSE" className="w-full">
        <TabsList>
          <TabsTrigger value="P1-CLOSE">Close Based</TabsTrigger>
          <TabsTrigger value="P2-TR">True Range</TabsTrigger>
          <TabsTrigger value="P3-COMB">Combined</TabsTrigger>
          <TabsTrigger value="P4-MV">Physics Based</TabsTrigger>
        </TabsList>
        <TabsContent value="P1-CLOSE">{renderLog("P1-CLOSE")}</TabsContent>
        <TabsContent value="P2-TR">{renderLog("P2-TR")}</TabsContent>
        <TabsContent value="P3-COMB">{renderLog("P3-COMB")}</TabsContent>
        <TabsContent value="P4-MV">{renderLog("P4-MV")}</TabsContent>
      </Tabs>
    </div>
  );
}
