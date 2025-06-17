
import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { LightweightCharts } from 'lightweight-charts';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function ChartView() {
  const [symbol, setSymbol] = useState('');
  const [symbolsList, setSymbolsList] = useState([]);
  const [ohlcvData, setOhlcvData] = useState([]);

  useEffect(() => {
    if (!symbol) return;

    async function fetchData() {
      const { data, error } = await supabase
        .from('ohlcv_data')
        .select('*')
        .ilike('symbol', `%${symbol}%`)
        .order('date', { ascending: true })
        .limit(1000);

      if (!error) setOhlcvData(data);
    }
    fetchData();
  }, [symbol]);

  // Dummy render
  return (
    <div>
      <input
        type="text"
        placeholder="Search symbol"
        value={symbol}
        onChange={(e) => setSymbol(e.target.value.toUpperCase())}
      />
      <div>Chart placeholder for {symbol}</div>
      <pre>{JSON.stringify(ohlcvData.slice(0, 3), null, 2)}</pre>
    </div>
  );
}
