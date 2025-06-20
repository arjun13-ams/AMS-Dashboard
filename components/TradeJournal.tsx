'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Trade = {
  trade_id: string;
  symbol: string;
  entry_date: string;
  exit_date: string | null;
  entry_price: number;
  exit_price: number | null;
  status: string;
  quantity: number;
  pnl: number | null;
};

type TradeJournalProps = {
  strategy: string;
  statusFilter: 'open' | 'closed' | 'all';
};

export default function TradeJournal({ strategy, statusFilter }: TradeJournalProps) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchTrades = async () => {
      setLoading(true);
      console.log('Fetching trades with parameters:', {
        strategy,
        statusFilter,
      });
      let query = supabase
        .from('trade_journal')
        .select('*')
        .eq('strategy', strategy);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      console.log('Supabase query object:', query);

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

  if (loading) return <div>Loading trades...</div>;

  if (!trades.length) return <div>No trades found for {strategy} with status {statusFilter}</div>;

  return (
    <table className="w-full text-sm text-left border-collapse border border-gray-700">
      <thead>
        <tr>
          <th className="border border-gray-700 p-2">Symbol</th>
          <th className="border border-gray-700 p-2">Entry Date</th>
          <th className="border border-gray-700 p-2">Exit Date</th>
          <th className="border border-gray-700 p-2">Entry Price</th>
          <th className="border border-gray-700 p-2">Exit Price</th>
          <th className="border border-gray-700 p-2">Quantity</th>
          <th className="border border-gray-700 p-2">P&L</th>
          <th className="border border-gray-700 p-2">Status</th>
        </tr>
      </thead>
      <tbody>
        {trades.map((trade) => (
          <tr key={trade.trade_id} className="even:bg-gray-800 odd:bg-gray-900">
            <td className="border border-gray-700 p-2">{trade.symbol}</td>
            <td className="border border-gray-700 p-2">{trade.entry_date}</td>
            <td className="border border-gray-700 p-2">{trade.exit_date ?? '-'}</td>
            <td className="border border-gray-700 p-2">{trade.entry_price.toFixed(2)}</td>
            <td className="border border-gray-700 p-2">{trade.exit_price?.toFixed(2) ?? '-'}</td>
            <td className="border border-gray-700 p-2">{trade.quantity}</td>
            <td className="border border-gray-700 p-2">{trade.pnl?.toFixed(2) ?? '-'}</td>
            <td className="border border-gray-700 p-2">{trade.status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
