'use client';
import { useState } from 'react';
import {
  PortfolioTabs as Tabs,
  PortfolioTabsList as TabsList,
  PortfolioTabsTrigger as TabsTrigger,
  PortfolioTabsContent as TabsContent,
} from '../components/ui/PortfolioTabs';

const STRATEGIES = [
  { key: 'Close-Based', label: 'Close-Based' },
  { key: 'True-Range', label: 'True-Range' },
  { key: 'Combined', label: 'Combined' },
  { key: 'P1-MV', label: 'Physics-Based' },
];

const dummyMetrics = {
  cagr: '12.34%',
  absReturn: '45.67%',
  maxDD: '18.90%',
  currentDD: '4.56%',
  sharpe: '1.25',
  realizedPnL: '₹12,345',
  unrealizedPnL: '₹7,890',
  winRate: '65%',
};

export default function PortfolioView() {
  const [selectedTab, setSelectedTab] = useState(STRATEGIES[0].key);

  return (
    <div className="w-full bg-white text-black p-6 min-h-screen">
      <h1 className="text-2xl font-semibold mb-4">📊 Portfolio Performance</h1>
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
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="bg-blue-100 text-blue-900 p-4 rounded shadow">📈 CAGR: {dummyMetrics.cagr}</div>
              <div className="bg-red-100 text-red-900 p-4 rounded shadow">📉 Max DD: {dummyMetrics.maxDD}</div>
              <div className="bg-orange-100 text-orange-900 p-4 rounded shadow">🔻 Current DD: {dummyMetrics.currentDD}</div>
              <div className="bg-green-100 text-green-900 p-4 rounded shadow">📊 Abs Return: {dummyMetrics.absReturn}</div>
              <div className="bg-purple-100 text-purple-900 p-4 rounded shadow">⚖️ Sharpe: {dummyMetrics.sharpe}</div>
              <div className="bg-yellow-100 text-yellow-900 p-4 rounded shadow">💰 Realized P&L: {dummyMetrics.realizedPnL}</div>
              <div className="bg-gray-100 text-gray-900 p-4 rounded shadow">💼 Unrealized P&L: {dummyMetrics.unrealizedPnL}</div>
              <div className="bg-pink-100 text-pink-900 p-4 rounded shadow">🎯 Win Rate: {dummyMetrics.winRate}</div>
            </div>

            <div className="mt-8 h-[300px] bg-gray-200 rounded flex items-center justify-center text-gray-600">
              📉 Performance Graph Coming Soon
            </div>

            <div className="mt-8">
              <div className="mb-2 flex justify-between items-center">
                <h3 className="text-lg font-semibold">📋 Trade Journal</h3>
                <select className="bg-gray-100 border border-gray-300 rounded text-sm px-2 py-1">
                  <option>Open</option>
                  <option>Closed</option>
                  <option>All</option>
                </select>
              </div>
              <div className="bg-gray-100 p-4 rounded text-center text-gray-500">
                Trade Journal Table Coming Soon...
              </div>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
