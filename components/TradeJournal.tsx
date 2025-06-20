'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

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
  status: string;
};

type TradeJournalProps = {
  strategy: string;
  statusFilter: 'open' | 'closed' | 'all';
};

export default function TradeJournal({ strategy, statusFilter }: TradeJournalProps) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<any>({});
  const [sortKey, setSortKey] = useState<string>('trade_date');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  useEffect(() => {
    const fetchTrades = async () => {
      setLoading(true);

      let query = supabase
        .from('trade_journal')
        .select('id, symbol, trade_date, exit_date, price, exit_price, quantity, return_pct, status')
        .eq('strategy', strategy);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter.toLowerCase());
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

  const filteredTrades = trades.filter((trade) => {
    return Object.entries(filters).every(([key, val]) => {
      if (!val) return true;
      return String((trade as any)[key]).toLowerCase().includes(String(val).toLowerCase());
    });
  });

  const sortedTrades = [...filteredTrades].sort((a, b) => {
    const aVal = (a as any)[sortKey];
    const bVal = (b as any)[sortKey];
    if (aVal === bVal) return 0;
    return (aVal > bVal ? 1 : -1) * (sortAsc ? 1 : -1);
  });

  const handleFilterChange = (key: string, value: string) => {
    setFilters({ ...filters, [key]: value });
  };

  const handleSort = (key: string) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  if (loading) return <div className="text-gray-300">Loading trades...</div>;
  if (!sortedTrades.length) return <div className="text-gray-300">No trades found for <b>{strategy}</b> with status <b>{statusFilter}</b></div>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left border-collapse border border-gray-700">
        <thead>
          <tr>
            {['symbol', 'trade_date', 'exit_date', 'price', 'exit_price', 'quantity', 'return_pct', 'status'].map((col) => (
              <th key={col} className="border border-gray-700 p-2 cursor-pointer" onClick={() => handleSort(col)}>
                {col.replace('_', ' ').toUpperCase()}
              </th>
            ))}
          </tr>
          <tr>
            {['symbol', 'trade_date', 'exit_date', 'price', 'exit_price', 'quantity', 'return_pct', 'status'].map((col) => (
              <th key={col} className="border border-gray-700 p-1">
                <input
                  type="text"
                  placeholder="Filter"
                  className="w-full text-xs p-1 bg-gray-800 text-white rounded"
                  value={filters[col] || ''}
                  onChange={(e) => handleFilterChange(col, e.target.value)}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedTrades.map((trade) => {
            let rowColor = 'bg-white';
            if (trade.status === 'closed') {
              if (trade.return_pct != null && trade.return_pct >= 0) rowColor = 'bg-green-100';
              else rowColor = 'bg-red-100';
            }

            return (
              <tr key={trade.id} className={rowColor}>
                <td className="border border-gray-700 p-2">{trade.symbol}</td>
                <td className="border border-gray-700 p-2">{trade.trade_date}</td>
                <td className="border border-gray-700 p-2">{trade.exit_date ?? '-'}</td>
                <td className="border border-gray-700 p-2">{trade.price.toFixed(2)}</td>
                <td className="border border-gray-700 p-2">{trade.exit_price?.toFixed(2) ?? '-'}</td>
                <td className="border border-gray-700 p-2">{trade.quantity}</td>
                <td className="border border-gray-700 p-2">{trade.return_pct?.toFixed(2) ?? '-'}%</td>
                <td className="border border-gray-700 p-2 capitalize">{trade.status}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
