import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const STRATEGIES = [
  { key: "close", label: "Close Based", supabaseKey: "Close-Based" },
  { key: "tr", label: "True Range", supabaseKey: "True-Range" },
  { key: "comb", label: "Combined", supabaseKey: "Combined" },
  { key: "mv", label: "P1-MV", supabaseKey: "P1-MV" },
];

export default function RebalanceTabs() {
  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [logs, setLogs] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const fetchRebalanceDates = async () => {
      const { data, error } = await supabase
        .from("weekly_rebalance")
        .select("date")
        .order("date", { ascending: false });

      if (error) console.error("Error fetching dates:", error);

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
      setLoading(true);
      const allLogs: Record<string, any> = {};

      for (const strat of STRATEGIES) {
        const { supabaseKey, key } = strat;

        // Get current symbols
        const { data: current } = await supabase
          .from("weekly_rebalance")
          .select("symbol")
          .eq("strategy", supabaseKey)
          .eq("date", selectedDate);

        const currentSymbols = current?.map((r) => r.symbol) || [];

        // Step 1: Find previous rebalance date
        const { data: prevDateData } = await supabase
          .from("weekly_rebalance")
          .select("date")
          .eq("strategy", supabaseKey)
          .lt("date", selectedDate)
          .order("date", { ascending: false })
          .limit(1);

        let previousSymbols: string[] = [];

        if (prevDateData && prevDateData.length > 0) {
          const previousDate = prevDateData[0].date;

          // Step 2: Get all symbols from that date
          const { data: prevSymbolsData } = await supabase
            .from("weekly_rebalance")
            .select("symbol")
            .eq("strategy", supabaseKey)
            .eq("date", previousDate);

          previousSymbols = prevSymbolsData?.map((r) => r.symbol) || [];
        }

        const added = currentSymbols.filter((s) => !previousSymbols.includes(s));
        const held = currentSymbols.filter((s) => previousSymbols.includes(s));
        const removed = previousSymbols.filter((s) => !currentSymbols.includes(s));

        allLogs[key] = { added, held, removed };

        // Debug output
        console.log(`\nStrategy: ${supabaseKey}`);
        console.log(`Selected Date: ${selectedDate}`);
        console.log("Current symbols:", currentSymbols);
        console.log("Previous symbols:", previousSymbols);
      }

      setLogs(allLogs);
      setLoading(false);
    };

    fetchLogs();
  }, [selectedDate]);

  const renderLog = (strategyKey: string) => {
    if (loading) {
      return <div className="text-gray-400 p-4">⏳ Loading strategy data...</div>;
    }

    const data = logs[strategyKey];
    if (!data || (data.added.length === 0 && data.held.length === 0 && data.removed.length === 0)) {
      return <div className="text-gray-400 p-4">⚠️ No data found for this strategy on selected date.</div>;
    }

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
            {data.added.map((s: string) => (
              <tr key={s} className="bg-green-900/40">
                <td className="p-2 font-semibold">{s}</td>
                <td className="p-2">🟢 Added *</td>
              </tr>
            ))}
            {data.held.map((s: string) => (
              <tr key={s} className="bg-blue-900/40">
                <td className="p-2">{s}</td>
                <td className="p-2">✅ Held</td>
              </tr>
            ))}
          </tbody>
        </table>

        {data.removed.length > 0 && (
          <div className="text-sm text-red-400">
            ❌ Removed this week:
            <ul className="list-disc ml-5 mt-1">
              {data.removed.map((s: string) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap gap-2">
        {dates.map((d) => (
          <button
            key={d}
            className={`px-4 py-1 rounded border text-sm ${
              d === selectedDate ? "bg-green-800 border-green-400" : "bg-zinc-800 border-gray-600"
            }`}
            onClick={() => setSelectedDate(d)}
          >
            {d}
          </button>
        ))}
      </div>

      <Tabs defaultValue={STRATEGIES[0].key} className="w-full">
        <TabsList>
          {STRATEGIES.map((s) => (
            <TabsTrigger key={s.key} value={s.key}>
              {s.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {STRATEGIES.map((s) => (
          <TabsContent key={s.key} value={s.key}>
            {renderLog(s.key)}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
