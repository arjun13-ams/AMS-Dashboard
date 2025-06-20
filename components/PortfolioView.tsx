import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";

const STRATEGIES = [
  { key: "tab1", label: "Close-Based" },
  { key: "tab2", label: "True-Range" },
  { key: "tab3", label: "Combined" },
  { key: "tab4", label: "P1-MV" },
];

export default function PortfolioView() {
  const [selectedTab, setSelectedTab] = useState("tab1");

  return (
    <div className="w-full space-y-6 p-6">
      <Tabs defaultValue={selectedTab} value={selectedTab} className="w-full">
        <TabsList>
          {STRATEGIES.map((s) => (
            <TabsTrigger
              key={s.key}
              value={s.key}
              isActive={selectedTab === s.key}
              onClick={() => setSelectedTab(s.key)}
            >
              {s.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {STRATEGIES.map((s) => (
          <TabsContent key={s.key} value={s.key}>
            <div
              className="rounded p-6 text-white text-xl font-bold text-center"
              style={{
                backgroundColor:
                  s.key === "tab1"
                    ? "#0077b6"
                    : s.key === "tab2"
                    ? "#009688"
                    : s.key === "tab3"
                    ? "#6a1b9a"
                    : "#ff8f00",
              }}
            >
              {s.label} Content Here
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
