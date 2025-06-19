import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const STRATEGIES = ["Close-Based", "True-Range", "Combined", "P1-MV"];

export default function RebalanceTabs() {
  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [logs, setLogs] = useState<Record<string, { added: string[]; held: string[]; removed: string[] }>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  // Fetch last 5 rebalance dates
  useEffect(() => {
    const fetchRebalanceDates = async () => {
      try {
        const { data, error } = await supabase
          .from("weekly_rebalance")
          .select("date")
          .order("date", { ascending: false });

        if (error) {
          console.error("Error fetching rebalance dates:", error);
          return;
        }
        if (data && data.length) {
          const uniqueDates = Array.from(new Set(data.map((d) => d.date))).slice(0, 5);
          setDates(uniqueDates);
          setSelectedDate(uniqueDates[0]);
        }
      } catch (err) {
        console.error("Unexpected error fetching rebalance dates:", err);
      }
    };
    fetchRebalanceDates();
  }, []);

  // Fetch logs for all strategies for selected date
  useEffect(() => {
    if (!selectedDate) return;

    const fetchLogs = async () => {
      const newLogs: Record<string, { added: string[]; held: string[]; removed: string[] }> = {};
      const newLoading: Record<string, boolean> = {};
      for (const strategy of STRATEGIES) {
        newLoading[strategy] = true;
      }
      setLoading(newLoading);

      for (const strategy of STRATEGIES) {
        try {
          const { data: current, error: currentErr } = await supabase
            .from("weekly_rebalance")
            .select("symbol")
            .eq("strategy", strategy)
            .eq("date", selectedDate);

          if (currentErr) {
            console.error(`Error fetching current data for ${strategy}:`, currentErr);
            newLogs[strategy] = { added: [], held: [], removed: [] };
            continue;
          }

          const { data: previous, error: previousErr } = await supabase
            .from("weekly_rebalance")
            .select("symbol")
            .eq("strategy", strategy)
            .lt("date", selectedDate)
            .order("date", { ascending: false })
            .limit(1);

          if (previousErr) {
            console.error(`Error fetching previous data for ${strategy}:`, previousErr);
            newLogs[strategy] = { added: [], held: [], removed: [] };
            continue;
          }

          const currentSymbols = current?.map((r) => r.symbol) || [];
          const previousSymbols = previous?.map((r) => r.symbol) || [];

          // Debug logs here:
          console.log(`Strategy: ${strategy}`);
          console.log(`Selected Date: ${selectedDate}`);
          console.log("Current symbols:", currentSymbols);
          console.log("Previous symbols:", previousSymbols);

          const added = currentSymbols.filter((s) => !previousSymbols.includes(s));
          const held = currentSymbols.filter((s) => previousSymbols.includes(s));
          const removed = previousSymbols.filter((s) => !currentSymbols.includes(s));

          newLogs[strategy] = { added, held, removed };
        } catch (e) {
          console.error(`Unexpected error fetching logs for ${strategy}:`, e);
          newLogs[strategy] = { added: [], held: [], removed: [] };
        }
      }

      setLogs(newLogs);

      // Set all loading false after fetch
      const loaded: Record<string, boolean> = {};
      for (const s of STRATEGIES) {
        loaded[s] = false;
      }
      setLoading(loaded);
    };

    fetchLogs();
  }, [selectedDate]);

  const renderLog = (strategyKey: string) => {
    if (loading[strategyKey]) {
      return <div className="p-4 text-center text-gray-400">⏳ Loading strategy data...</div>;
    }

    const data = logs[strategyKey];
    if (!data || (data.added.length === 0 && data.held.length === 0 && data.removed.length === 0)) {
      return <div className="p-4 text-center text-yellow-500">⚠️ No data found for this strategy on selected date.</div>;
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
            className={`px-4 py-1 rounded border cursor-pointer ${
              d === selectedDate ? "bg-green-800 border-green-400" : "bg-zinc-800 border-gray-600"
            }`}
            onClick={() => setSelectedDate(d)}
          >
            {d}
          </button>
        ))}
      </div>

      <Tabs defaultValue="Close-Based" className="w-full">
        <TabsList>
          <TabsTrigger value="Close-Based">Close-Based</TabsTrigger>
          <TabsTrigger value="True-Range">True-Range</TabsTrigger>
          <TabsTrigger value="Combined">Combined</TabsTrigger>
          <TabsTrigger value="P1-MV">Physics Based</TabsTrigger>
        </TabsList>
        <TabsContent value="Close-Based">{renderLog("Close-Based")}</TabsContent>
        <TabsContent value="True-Range">{renderLog("True-Range")}</TabsContent>
        <TabsContent value="Combined">{renderLog("Combined")}</TabsContent>
        <TabsContent value="P1-MV">{renderLog("P1-MV")}</TabsContent>
      </Tabs>
    </div>
  );
}
