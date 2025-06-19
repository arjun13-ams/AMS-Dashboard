import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Calendar } from "../components/ui/calendar";

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

export default function PortfolioView() {
  const [calendarFilter, setCalendarFilter] = useState("All");
  const [selectedTab, setSelectedTab] = useState(STRATEGIES[0].key);

  return (
    <div className="w-full space-y-6">
      {/* Strategy Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <TabsList>
          {STRATEGIES.map((s) => (
            <TabsTrigger key={s.key} value={s.key}>
              {s.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {STRATEGIES.map((s) => (
          <TabsContent key={s.key} value={s.key}>
            {/* Calendar Filter */}
            <div className="flex gap-4 items-center mb-4">
              <span className="text-sm font-medium">Filter by FY:</span>
              <div className="flex gap-2">
                {CALENDAR_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setCalendarFilter(opt.value)}
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

            {/* Metrics Placeholder */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="p-4 bg-zinc-900 rounded">📈 CAGR: --%</div>
              <div className="p-4 bg-zinc-900 rounded">📉 Max DD: --%</div>
              <div className="p-4 bg-zinc-900 rounded">🔻 Current DD: --%</div>
              <div className="p-4 bg-zinc-900 rounded">📊 Return %: --%</div>
              <div className="p-4 bg-zinc-900 rounded">⚖️ Sharpe: --</div>
              <div className="p-4 bg-zinc-900 rounded">💰 Realized P&L: ₹--</div>
              <div className="p-4 bg-zinc-900 rounded">💼 Unrealized P&L: ₹--</div>
              <div className="p-4 bg-zinc-900 rounded">🎯 Win Rate: --%</div>
            </div>

            {/* Graph Placeholder */}
            <div className="mt-6 h-[300px] bg-zinc-800 rounded flex items-center justify-center text-gray-400">
              Portfolio Value Graph Coming Soon
            </div>

            {/* Trade Journal Placeholder */}
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
