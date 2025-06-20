'use client';

import { PortfolioTabs, Tab } from "../components/ui/PortfolioTabs";

const STRATEGIES = [
  { key: "Close-Based", label: "Close-Based" },
  { key: "True-Range", label: "True-Range" },
  { key: "Combined", label: "Combined" },
  { key: "P1-MV", label: "Physics-Based" },
];

export default function PortfolioView() {
  const metricBoxes = (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-4">
      <div className="p-4 bg-green-100 rounded">📈 CAGR: 12.34%</div>
      <div className="p-4 bg-red-100 rounded">📉 Max DD: 18.76%</div>
      <div className="p-4 bg-yellow-100 rounded">🔻 Current DD: 5.42%</div>
      <div className="p-4 bg-blue-100 rounded">📊 Return %: 45.67%</div>
      <div className="p-4 bg-purple-100 rounded">⚖️ Sharpe: 1.25</div>
      <div className="p-4 bg-indigo-100 rounded">💰 Realized P&L: ₹12,300</div>
      <div className="p-4 bg-pink-100 rounded">💼 Unrealized P&L: ₹8,700</div>
      <div className="p-4 bg-orange-100 rounded">🎯 Win Rate: 62%</div>
    </div>
  );

  const tabs: Tab[] = STRATEGIES.map((s) => ({
    label: s.label,
    value: s.key,
    content: (
      <div>
        <h2 className="text-xl font-semibold mb-2">{s.label} Strategy</h2>
        <p>This is the placeholder for <strong>{s.label}</strong> portfolio performance & trade journal.</p>
        {metricBoxes}
      </div>
    ),
  }));

  return (
    <div className="w-full bg-white text-black p-4 min-h-screen">
      <h1 className="text-2xl font-bold mb-6">📊 Portfolio View</h1>
      <PortfolioTabs tabs={tabs} defaultValue={STRATEGIES[0].key} />
    </div>
  );
}
