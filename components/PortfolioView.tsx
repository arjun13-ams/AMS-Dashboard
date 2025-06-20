'use client';

import { useEffect, useState } from 'react';
import PortfolioTabs from '../components/ui/PortfolioTabs';
import TradeJournal from '../components/TradeJournal';
import { createClient } from '@supabase/supabase-js';
import dayjs from 'dayjs';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const STRATEGIES = [
  { key: 'Close-Based', label: 'Close-Based' },
  { key: 'True-Range', label: 'True-Range' },
  { key: 'Combined', label: 'Combined' },
  { key: 'P1-MV', label: 'P1-MV' },
];

const CALENDAR_OPTIONS = [
  { label: 'FY24', value: 'FY24' },
  { label: 'FY25', value: 'FY25' },
  { label: 'All', value: 'All' },
];

function getDateRange(fy: string) {
  if (fy === 'FY24') return ['2023-04-01', '2024-03-31'];
  if (fy === 'FY25') return ['2024-04-01', '2025-03-31'];
  return [null, null];
}

export default function PortfolioView() {
  const [calendarFilter, setCalendarFilter] = useState('FY25');
  const [metrics, setMetrics] = useState<any>({});
  const [portfolioData, setPortfolioData] = useState<{ date: string; value: number }[]>([]);
  const [activeStrategy, setActiveStrategy] = useState(STRATEGIES[0].key);
  const [statusFilter, setStatusFilter] = useState('Open');

  useEffect(() => {
    const fetchData = async () => {
      const [startDate, endDate] = getDateRange(calendarFilter);
      const from = startDate ? dayjs(startDate) : null;
      const to = endDate ? dayjs(endDate) : null;
      const newMetrics: any = {};

      let graphData: { date: string; value: number }[] = [];

      for (const strategy of STRATEGIES) {
        let query = supabase
          .from('portfolio_history')
          .select('rebalance_date, portfolio_value')
          .eq('strategy', strategy.key)
          .order('rebalance_date', { ascending: true });

        const { data, error } = await query;

        if (error || !data) continue;

        const filtered = data.filter((d) => {
          const date = dayjs(d.rebalance_date);
          return (!from || date.isAfter(from.subtract(1, 'day'))) && (!to || date.isBefore(to.add(1, 'day')));
        });

        if (filtered.length < 2) continue;

        const values = filtered.map((r) => r.portfolio_value);
        const dates = filtered.map((r) => r.rebalance_date);
        const startVal = values[0];
        const endVal = values[values.length - 1];
        const totalDays = dayjs(dates[values.length - 1]).diff(dayjs(dates[0]), 'day');
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

        if (strategy.key === activeStrategy) {
          graphData = filtered.map((r) => ({
            date: dayjs(r.rebalance_date).format('YYYY-MM-DD'),
            value: r.portfolio_value,
          }));
        }
      }

      setMetrics(newMetrics);
      setPortfolioData(graphData);
    };

    fetchData();
  }, [calendarFilter, activeStrategy]);

  const tabs = STRATEGIES.map((s) => ({
    label: s.label,
    value: s.key,
    content: (
      <div className="flex flex-col gap-4 text-black">
        <div className="flex gap-2">
          {CALENDAR_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setCalendarFilter(opt.value)}
              className={`px-3 py-1 rounded text-xs border ${
                calendarFilter === opt.value
                  ? 'bg-green-800 border-green-500 text-white'
                  : 'bg-zinc-800 border-gray-600 text-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="p-4 bg-zinc-900 rounded text-white">📈 CAGR: {metrics[s.key]?.cagr ?? '--'}%</div>
          <div className="p-4 bg-zinc-900 rounded text-white">📉 Max DD: {metrics[s.key]?.maxDD ?? '--'}%</div>
          <div className="p-4 bg-zinc-900 rounded text-white">🔻 Current DD: {metrics[s.key]?.currentDD ?? '--'}%</div>
          <div className="p-4 bg-zinc-900 rounded text-white">📊 Return %: {metrics[s.key]?.absReturn ?? '--'}%</div>
          <div className="p-4 bg-zinc-900 rounded text-white">⚖️ Sharpe: {metrics[s.key]?.sharpe ?? '--'}</div>
          <div className="p-4 bg-zinc-900 rounded text-white">💰 Realized P&L: ₹--</div>
          <div className="p-4 bg-zinc-900 rounded text-white">💼 Unrealized P&L: ₹--</div>
          <div className="p-4 bg-zinc-900 rounded text-white">🎯 Win Rate: --%</div>
        </div>

        <div className="mt-6 h-[300px] bg-zinc-800 rounded p-2">
          {portfolioData.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              No portfolio data to display.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={portfolioData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid stroke="#ccc" strokeDasharray="5 5" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} domain={['dataMin', 'dataMax']} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#0077b6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="mt-6">
          <div className="mb-2 flex justify-between items-center">
            <h3 className="text-lg font-semibold">📋 Trade Journal</h3>
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-zinc-800 border border-gray-600 rounded text-sm px-2 py-1 text-white"
              >
                <option value="Open">Open</option>
                <option value="Closed">Closed</option>
                <option value="All">All</option>
              </select>
            </div>
          </div>

          <TradeJournal strategy={s.key} statusFilter={statusFilter} />
        </div>
      </div>
    ),
  }));

  return (
    <div className="w-full p-4 bg-white text-black min-h-screen">
      <PortfolioTabs
        tabs={tabs}
        defaultValue={STRATEGIES[0].key}
        onTabChange={(val) => setActiveStrategy(val)}
      />
    </div>
  );
}
