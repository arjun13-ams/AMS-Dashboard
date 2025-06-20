'use client';
import { useState } from "react";
import {
  PortfolioTabs,
  PortfolioTabsList,
  PortfolioTabsTrigger,
  PortfolioTabsContent,
} from "../components/ui/PortfolioTabs";

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
      <PortfolioTabs defaultValue={selectedTab} value={selectedTab} className="w-full">
        <PortfolioTabsList>
          {STRATEGIES.map((strategy) => (
            <PortfolioTabsTrigger
              key={strategy.key}
              value={strategy.key}
              isActive={selectedTab === strategy.key}
              onClick={() => setSelectedTab(strategy.key)}
            >
              {strategy.label}
            </PortfolioTabsTrigger>
          ))}
        </PortfolioTabsList>

        {STRATEGIES.map((strategy) => (
          <PortfolioTabsContent key={strategy.key} value={strategy.key}>
            <div
              className={`p-6 rounded ${
                selectedTab === strategy.key
                  ? "bg-blue-800 text-white"
                  : "bg-gray-800 text-gray-200"
              }`}
            >
              <h2 className="text-xl mb-2">{strategy.label}</h2>
              <p className="text-lg">
                Placeholder content for <strong>{strategy.label}</strong> tab.
              </p>
            </div>
          </PortfolioTabsContent>
        ))}
      </PortfolioTabs>
    </div>
  );
}
