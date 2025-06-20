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

  useEffect(() => {
    const fetchTrades = async () => {
      setLoading(true);

      console.log('📦 Fetching trades for:', { strategy, statusFilter });

      let query = supabase
        .from('trade_journal')
        .select('id, symbol, trade_date, exit_date, price, exit_price, quantity, return_pct, status')
        .eq('strategy', strategy);

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter.toLowerCase()); // lowercase match for DB
      }

      const { data, error } = await query.order('trade_date', { ascending: false });

      if (error) {
        console.error('❌ Error fetching trades:', error);
        setTrades([]);
      } else {
        console.log(`✅ ${data?.length ?? 0} trades fetched`);
        setTrades(data || []);
      }

      setLoading(false);
    };

    fetchTrades();
  }, [strategy, statusFilter]);

  if (loading) return <div className="text-gray-300">Loading trades...</div>;
  if (!trades.length) return <div className="text-gray-300">No trades found for <b>{strategy}</b> with status <b>{statusFilter}</b></div>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left border-collapse border border-gray-700">
        <thead>
          <tr>
            <th className="border border-gray-700 p-2">Symbol</th>
            <th className="border border-gray-700 p-2">Entry Date</th>
            <th className="border border-gray-700 p-2">Exit Date</th>
            <th className="border border-gray-700 p-2">Entry Price</th>
            <th className="border border-gray-700 p-2">Exit Price</th>
            <th className="border border-gray-700 p-2">Quantity</th>
            <th className="border border-gray-700 p-2">Return %</th>
            <th className="border border-gray-700 p-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade) => (
            <tr key={trade.id} className="even:bg-gray-800 odd:bg-gray-900">
              <td className="border border-gray-700 p-2">{trade.symbol}</td>
              <td className="border border-gray-700 p-2">{trade.trade_date}</td>
              <td className="border border-gray-700 p-2">{trade.exit_date ?? '-'}</td>
              <td className="border border-gray-700 p-2">{trade.price.toFixed(2)}</td>
              <td className="border border-gray-700 p-2">{trade.exit_price?.toFixed(2) ?? '-'}</td>
              <td className="border border-gray-700 p-2">{trade.quantity}</td>
              <td className="border border-gray-700 p-2">{trade.return_pct?.toFixed(2) ?? '-'}%</td>
              <td className="border border-gray-700 p-2 capitalize">{trade.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
