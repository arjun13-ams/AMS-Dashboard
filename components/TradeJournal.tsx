'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import dayjs from 'dayjs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Trade = {
  id: string;
  symbol: string;
  trade_date: string;
  exit_date: string | null;
  price: number;
  exit_price: number | null;
  quantity: number;
  return_pct: number | null;
  holding_days: number | null;
  status: string;
};

type TradeJournalProps = {
  strategy: string;
  statusFilter: 'open' | 'closed' | 'all';
};

export default function TradeJournal({ strategy, statusFilter }: TradeJournalProps) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    symbol: '',
    entryDate: '',
    exitDate: '',
    status: '',
  });
  const [sortColumn, setSortColumn] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    const fetchTrades = async () => {
      setLoading(true);
      let query = supabase
        .from('trade_journal')
        .select('*')
        .eq('strategy', strategy);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query.order('trade_date', { ascending: false });

      if (error) {
        console.error('Error fetching trades:', error);
        setTrades([]);
      } else {
        setTrades(data || []);
      }
      setLoading(false);
    };

    fetchTrades();
  }, [strategy, statusFilter]);

  const today = dayjs();

  let filteredTrades = trades.filter((trade) => {
    return (
      trade.symbol.toLowerCase().includes(filters.symbol.toLowerCase()) &&
      trade.trade_date.includes(filters.entryDate) &&
      (trade.exit_date?.includes(filters.exitDate) ?? true)
    );
  });

  if (sortColumn) {
    filteredTrades.sort((a, b) => {
      const valA = a[sortColumn as keyof Trade];
      const valB = b[sortColumn as keyof Trade];

      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      } else {
        return sortDirection === 'asc'
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      }
    });
  }

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  if (loading) return <div>Loading trades...</div>;

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        <input
          type="text"
          placeholder="Filter by symbol"
          value={filters.symbol}
          onChange={(e) => setFilters({ ...filters, symbol: e.target.value })}
          className="px-2 py-1 border rounded text-sm"
        />
        <input
          type="text"
          placeholder="Filter by entry date (YYYY-MM-DD)"
          value={filters.entryDate}
          onChange={(e) => setFilters({ ...filters, entryDate: e.target.value })}
          className="px-2 py-1 border rounded text-sm"
        />
        <input
          type="text"
          placeholder="Filter by exit date (YYYY-MM-DD)"
          value={filters.exitDate}
          onChange={(e) => setFilters({ ...filters, exitDate: e.target.value })}
          className="px-2 py-1 border rounded text-sm"
        />
      </div>

      <table className="w-full text-sm text-left border-collapse border border-gray-700">
        <thead>
          <tr>
            {['symbol', 'trade_date', 'exit_date', 'price', 'exit_price', 'quantity', 'holding_days', 'return_pct', 'status'].map((col) => (
              <th
                key={col}
                onClick={() => handleSort(col)}
                className="border border-gray-700 p-2 cursor-pointer hover:bg-gray-200"
              >
                {col.replace('_', ' ').toUpperCase()} {sortColumn === col ? (sortDirection === 'asc' ? '↑' : '↓') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredTrades.map((trade) => {
            const holdingDays = trade.status === 'open'
              ? today.diff(dayjs(trade.trade_date), 'day')
              : trade.holding_days;

            const rowBg =
              trade.status === 'closed'
                ? trade.return_pct !== null && trade.return_pct >= 0
                  ? 'bg-green-100'
                  : 'bg-red-100'
                : 'bg-white';

            return (
              <tr key={trade.id} className={`${rowBg}`}>
                <td className="border border-gray-700 p-2">{trade.symbol}</td>
                <td className="border border-gray-700 p-2">{trade.trade_date}</td>
                <td className="border border-gray-700 p-2">{trade.exit_date ?? '-'}</td>
                <td className="border border-gray-700 p-2">{trade.price.toFixed(2)}</td>
                <td className="border border-gray-700 p-2">{trade.exit_price?.toFixed(2) ?? '-'}</td>
                <td className="border border-gray-700 p-2">{trade.quantity}</td>
                <td className="border border-gray-700 p-2">{holdingDays ?? '-'}</td>
                <td className="border border-gray-700 p-2">{trade.return_pct?.toFixed(2) ?? '-'}</td>
                <td className="border border-gray-700 p-2">{trade.status}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
