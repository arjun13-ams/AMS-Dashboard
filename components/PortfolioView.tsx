'use client';
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";

const STRATEGIES = [
  { key: "Close-Based", label: "Close-Based" },
  { key: "True-Range", label: "True-Range" },
  { key: "Combined", label: "Combined" },
  { key: "P1-MV", label: "Physics-Based" },
];

export default function PortfolioView() {
  const [selectedTab, setSelectedTab] = useState(STRATEGIES[0].key);

  return (
    <div className="w-full space-y-6 bg-white text-black p-4 min-h-screen">
      <Tabs defaultValue={selectedTab} value={selectedTab} className="w-full">
        <TabsList>
          {STRATEGIES.map(s => (
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

        {STRATEGIES.map(s => (
          <TabsContent key={s.key} value={s.key}>
            <div
              className={`p-6 rounded ${
                selectedTab === s.key ? "bg-blue-800 text-white" : "bg-gray-800 text-gray-200"
              }`}
            >
              <h2 className="text-xl mb-2">{s.label}</h2>
              <p className="text-lg">Placeholder content for <strong>{s.label}</strong> tab.</p>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
