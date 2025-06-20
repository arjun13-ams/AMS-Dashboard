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

function getFiscalYear(date: dayjs.Dayjs) {
  // FY starts April 1, ends March 31 next year
  const year = date.year();
  const month = date.month() + 1; // 1-based month
  return month >= 4 ? year + 1 : year;
}

function getFiscalYearLabel(fy: number) {
  // FY26 means Apr 2025 - Mar 2026
  return `FY${String(fy).slice(-2).padStart(2, '0')}`;
}

export default function PortfolioView() {
  const [calendarFilter, setCalendarFilter] = useState<string>('');
  const [fiscalYears, setFiscalYears] = useState<{ label: string; value: string }[]>([]);
  const [metrics, setMetrics] = useState<any>({});
  const [portfolioData, setPortfolioData] = useState<{ date: string; value: number }[]>([]);
  const [activeStrategy, setActiveStrategy] = useState(STRATEGIES[0].key);
  const [statusFilter, setStatusFilter] = useState<'open' | 'closed' | 'all'>('open');

  // Calculate last 3 fiscal years dynamically from max rebalance_date
  useEffect(() => {
    const fetchMaxDateAndSetFY = async () => {
      const { data, error } = await supabase
        .from('portfolio_history')
        .select('rebalance_date')
        .order('rebalance_date', { ascending: false })
        .limit(1);

      if (error || !data || data.length === 0) {
        // fallback to current FY
        const nowFY = getFiscalYear(dayjs());
        const fyOptions = [nowFY - 2, nowFY - 1, nowFY]
          .map((fy) => ({
            label: getFiscalYearLabel(fy),
            value: getFiscalYearLabel(fy),
          }))
          .reverse();
        setFiscalYears(fyOptions);
        setCalendarFilter(fyOptions[fyOptions.length - 1].value);
        return;
      }

      const maxDate = dayjs(data[0].rebalance_date);
      const maxFY = getFiscalYear(maxDate);
      const fyOptions = [maxFY - 2, maxFY - 1, maxFY]
        .map((fy) => ({
          label: getFiscalYearLabel(fy),
          value: getFiscalYearLabel(fy),
        }))
        .reverse();

      setFiscalYears(fyOptions);
      setCalendarFilter(fyOptions[fyOptions.length - 1].value);
    };

    fetchMaxDateAndSetFY();
  }, []);

  function getDateRange(fy: string) {
    // e.g. FY26 -> 2025-04-01 to 2026-03-31
    if (!fy.startsWith('FY')) return [null, null];
    const fyNum = Number('20' + fy.slice(2));
    if (isNaN(fyNum)) return [null, null];
    const start = dayjs(`${fyNum - 1}-04-01`).format('YYYY-MM-DD');
    const end = dayjs(`${fyNum}-03-31`).format('YYYY-MM-DD');
    return [start, end];
  }

  useEffect(() => {
    if (!calendarFilter) return;

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
      <div className="flex flex-col gap-4 text-white">
        <div className="flex gap-2">
          {fiscalYears.map((opt) => (
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
            {/* Removed duplicate Trade Journal header here */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'open' | 'closed' | 'all')}
                className="bg-zinc-800 border border-gray-600 rounded text-sm px-2 py-1 text-white"
              >
                <option value="open">Open</option>
                <option value="closed">Closed</option>
                <option value="all">All</option>
              </select>
            </div>
          </div>

          <TradeJournal
            strategy={s.key}
            statusFilter={statusFilter}
            startDate={getDateRange(calendarFilter)[0]}
            endDate={getDateRange(calendarFilter)[1]}
          />
        </div>
      </div>
    ),
  }));

  return (
    <div className="w-full p-4 bg-zinc-900 text-white min-h-screen">
      <PortfolioTabs
        tabs={tabs}
        defaultValue={STRATEGIES[0].key}
        onTabChange={(val) => setActiveStrategy(val)}
      />
    </div>
  );
}
