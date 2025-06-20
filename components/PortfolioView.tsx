'use client';

import PortfolioTabs from "../components/ui/PortfolioTabs";

export default function PortfolioView() {
  const tabs = [
    {
      label: "Close-Based",
      value: "Close-Based",
      content: <p>📊 Placeholder content for Close-Based strategy.</p>,
    },
    {
      label: "True-Range",
      value: "True-Range",
      content: <p>📈 Placeholder content for True-Range strategy.</p>,
    },
    {
      label: "Combined",
      value: "Combined",
      content: <p>🔗 Placeholder content for Combined strategy.</p>,
    },
    {
      label: "Physics-Based",
      value: "P1-MV",
      content: <p>🧪 Placeholder content for Physics-Based strategy.</p>,
    },
  ];

  return (
    <div className="w-full bg-white text-black p-6 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">📊 Portfolio View (Test Tabs)</h1>
      <PortfolioTabs tabs={tabs} defaultValue="Close-Based" />
    </div>
  );
}
