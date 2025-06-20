'use client';

import { useState, ReactNode } from "react";

export type Tab = {
  label: string;
  value: string;
  content: ReactNode;
};

type PortfolioTabsProps = {
  tabs: Tab[];
  defaultValue: string;
  onTabChange?: (value: string) => void;  // added callback prop
};

export default function PortfolioTabs({ tabs, defaultValue, onTabChange }: PortfolioTabsProps) {
  const [activeTab, setActiveTab] = useState(defaultValue);

  const handleClick = (value: string) => {
    setActiveTab(value);
    if (onTabChange) onTabChange(value);
  };

  return (
    <div className="w-full">
      <div className="flex gap-2 mb-4">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => handleClick(tab.value)}
            className={`px-4 py-2 rounded transition-colors ${
              activeTab === tab.value ? "bg-blue-600 text-white" : "bg-gray-300 text-black"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-6 rounded bg-gray-100 text-black">
        {tabs.find((t) => t.value === activeTab)?.content}
      </div>
    </div>
  );
}
