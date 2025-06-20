import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { createClient } from "@supabase/supabase-js";
import dayjs from "dayjs";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const STRATEGIES = [
  { key: "Close-Based", label: "Close-Based" },
  { key: "True-Range", label: "True-Range" },
  { key: "Combined", label: "Combined" },
  { key: "P1-MV", label: "P1-MV" },
];

const CALENDAR_OPTIONS = [
  { label: "FY24", value: "FY24" },
  { label: "FY25", value: "FY25" },
  { label: "All", value: "All" },
];

function getDateRange(fy: string) {
  if (fy === "FY24") return ["2023-04-01", "2024-03-31"];
  if (fy === "FY25") return ["2024-04-01", "2025-03-31"];
  return [null, null];
}

export default function PortfolioView() {
  const [calendarFilter, setCalendarFilter] = useState("FY25");
  const [selectedTab, setSelectedTab] = useState(STRATEGIES[0].key);
  const [metrics, setMetrics] = useState<any>({});
  const [tabClickMessage, setTabClickMessage] = useState<string>("");

  // Log state changes and selected tab debug message
  console.log(
    `PortfolioView Render: selectedTab = ${selectedTab} ("Tab ${selectedTab} is selected"), calendarFilter = ${calendarFilter}`
  );
  console.log("Current metrics state:", metrics);

  useEffect(() => {
    const fetchData = async () => {
      console.log(`Fetching data for calendarFilter=${calendarFilter}`);
      const [startDate, endDate] = getDateRange(calendarFilter);
      console.log("Date range:", startDate, endDate);

      const from = startDate ? dayjs(startDate) : null;
      const to = endDate ? dayjs(endDate) : null;

      const newMetrics: any = {};

      for (const strategy of STRATEGIES) {
        console.log(`Querying supabase for strategy: ${strategy.key}`);
        let query = supabase
          .from("portfolio_history")
          .select("rebalance_date, portfolio_value")
          .eq("strategy", strategy.key)
          .order("rebalance_date", { ascending: true });

        const { data, error } = await query;

        if (error) {
          console.error(`Error fetching data for ${strategy.key}:`, error);
          continue;
        }
        if (!data) {
          console.warn(`No data returned for ${strategy.key}`);
          continue;
        }

        console.log(`Raw data fetched for ${strategy.key}:`, data.length, "records");

        const filtered = data.filter((d) => {
          const date = dayjs(d.rebalance_date);
          return (!from || date.isAfter(from.subtract(1, "day"))) && (!to || date.isBefore(to.add(1, "day")));
        });

        console.log(`Filtered data for ${strategy.key}: ${filtered.length} records`);
        console.table(filtered.map(d => ({ date: d.rebalance_date, value: d.portfolio_value })));

        if (filtered.length < 2) {
          console.warn(`Not enough data points to calculate metrics for ${strategy.key}`);
          continue;
        }

        const values = filtered.map((r) => r.portfolio_value);
        const dates = filtered.map((r) => r.rebalance_date);

        const startVal = values[0];
        const endVal = values[values.length - 1];
        const totalDays = dayjs(dates[values.length - 1]).diff(dayjs(dates[0]), "day");

        console.log(`Calculating metrics for ${strategy.key} from ${dates[0]} to ${dates[dates.length - 1]} (${totalDays} days)`);

        const years = totalDays / 365;
        const returns = values.map((v, i) => (i === 0 ? 0 : (v - values[i - 1]) / values[i - 1]));

        const cagr = ((endVal / startVal) ** (1 / years) - 1) * 100;
        const absoluteReturn = ((endVal - startVal) / startVal) * 100;
        const maxVal = Math.max(...values);
        const maxDrawdown = ((Math.min(...values) - maxVal) / maxVal) * 100;
        const currentDrawdown = ((endVal - maxVal) / maxVal) * 100;
        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const std = Math.sqrt(returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length);
        const sharpe = std === 0 ? 0 : (mean * 52) / std;

        newMetrics[strategy.key] = {
          cagr: cagr.toFixed(2),
          absReturn: absoluteReturn.toFixed(2),
          maxDD: Math.abs(maxDrawdown).toFixed(2),
          currentDD: Math.abs(currentDrawdown).toFixed(2),
          sharpe: sharpe.toFixed(2),
        };

        console.log(`Calculated metrics for ${strategy.key}:`, newMetrics[strategy.key]);
      }

      setMetrics(newMetrics);
    };

    fetchData();
  }, [calendarFilter]);

  return (
    <div className="w-full space-y-6">
      {/* Display tab click message here */}
      <div
        style={{
          backgroundColor: "#0077b6",
          color: "white",
          padding: "10px",
          borderRadius: "6px",
          textAlign: "center",
          fontWeight: "bold",
          marginBottom: "10px",
          minHeight: "30px",
        }}
      >
        {tabClickMessage || "Click a tab to see which one is selected"}
      </div>

      <Tabs defaultValue={selectedTab} value={selectedTab} className="w-full">
        <TabsList>
          {STRATEGIES.map((s) => (
            <TabsTrigger
              key={s.key}
              value={s.key}
              isActive={selectedTab === s.key}
              onClick={() => {
                console.log(`TabsTrigger clicked: ${s.key}`);
                setSelectedTab(s.key);
                setTabClickMessage(`Tab "${s.label}" clicked!`);
              }}
            >
              {s.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {STRATEGIES.map((s) => (
          <TabsContent key={s.key} value={s.key}>
            {/* Debug message inside each tab content */}
            <div
              style={{
                padding: "10px",
                backgroundColor: selectedTab === s.key ? "#e0f7fa" : "transparent",
                marginBottom: "10px",
                borderRadius: "6px",
                border: selectedTab === s.key ? "1px solid #0077b6" : "none",
                fontWeight: "bold",
                color: selectedTab === s.key ? "#0077b6" : "#666",
              }}
            >
              Tab <strong>{s.label}</strong> is selected: {selectedTab === s.key ? "YES" : "NO"}
            </div>

            <div className="flex flex-col gap-4 mb-4">
              <div
                style={{
                  backgroundColor: "white",
                  color: "black",
                  padding: "10px",
                  borderRadius: "6px",
                  overflowX: "auto",
                  fontFamily: "monospace",
                  fontSize: "0.9rem",
                  maxHeight: "200px",
                }}
              >
                <strong>Raw Metrics JSON for {s.label}:</strong>
                <pre>{JSON.stringify(metrics[s.key], null, 2)}</pre>
              </div>

              <span className="text-sm font-medium">Filter by FY:</span>
              <div className="flex gap-2">
                {CALENDAR_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      console.log(`Calendar filter changed: ${opt.value}`);
                      setCalendarFilter(opt.value);
                    }}
                    className={`px-3 py-1 rounded text-xs border ${
                      calendarFilter === opt.value
                        ? "bg-green-800 border-green-500"
                        : "bg-zinc-800 border-gray-600"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="p-4 bg-zinc-900 rounded">📈 CAGR: {metrics[s.key]?.cagr ?? "--"}%</div>
              <div className="p-4 bg-zinc-900 rounded">📉 Max DD: {metrics[s.key]?.maxDD ?? "--"}%</div>
              <div className="p-4 bg-zinc-900 rounded">🔻 Current DD: {metrics[s.key]?.currentDD ?? "--"}%</div>
              <div className="p-4 bg-zinc-900 rounded">📊 Return %: {metrics[s.key]?.absReturn ?? "--"}%</div>
              <div className="p-4 bg-zinc-900 rounded">⚖️ Sharpe: {metrics[s.key]?.sharpe ?? "--"}</div>
              <div className="p-4 bg-zinc-900 rounded">💰 Realized P&L: ₹--</div>
              <div className="p-4 bg-zinc-900 rounded">💼 Unrealized P&L: ₹--</div>
              <div className="p-4 bg-zinc-900 rounded">🎯 Win Rate: --%</div>
            </div>

            <div className="mt-6 h-[300px] bg-zinc-800 rounded flex items-center justify-center text-gray-400">
              Portfolio Value Graph Coming Soon
            </div>

            <div className="mt-6">
              <div className="mb-2 flex justify-between items-center">
                <h3 className="text-lg font-semibold">📋 Trade Journal</h3>
                <div>
                  <select className="bg-zinc-800 border border-gray-600 rounded text-sm px-2 py-1">
                    <option>Open</option>
                    <option>Closed</option>
                    <option>All</option>
                  </select>
                </div>
              </div>
              <div className="bg-zinc-900 p-4 rounded text-gray-400 text-center">
                Trade Journal Table Coming Soon...
              </div>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
