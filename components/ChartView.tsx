'use client';

import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

declare global {
  interface Window {
    TradingView: any;
  }
}

export default function ChartView() {
  const [symbols, setSymbols] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredSymbols, setFilteredSymbols] = useState<string[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState('NSE:TCS');

  const widgetRef = useRef<any>(null);

  // Fetch stock list on mount
  useEffect(() => {
    async function fetchSymbols() {
      let { data, error } = await supabase
        .from('cnx500_stock_list')
        .select('symbol')
        .limit(500);
      if (error) {
        console.error('Error fetching symbols:', error);
      } else {
        // Prefix with NSE: for TradingView
        const prefixedSymbols = data?.map((item) => 'NSE:' + item.symbol) || [];
        setSymbols(prefixedSymbols);
        setFilteredSymbols(prefixedSymbols);
      }
    }
    fetchSymbols();
  }, []);

  // Filter symbols on search change
  useEffect(() => {
    if (searchTerm === '') {
      setFilteredSymbols(symbols);
    } else {
      const filtered = symbols.filter((sym) =>
        sym.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredSymbols(filtered);
    }
  }, [searchTerm, symbols]);

  // Load TradingView widget whenever selectedSymbol changes
  useEffect(() => {
    if (!window.TradingView) return;

    if (widgetRef.current) {
      widgetRef.current.remove();
      widgetRef.current = null;
    }

    const widget = new window.TradingView.widget({
      container_id: 'tv_chart_container',
      autosize: true,
      symbol: selectedSymbol,
      interval: 'D',
      timezone: 'Asia/Kolkata',
      theme: 'dark',
      style: '1',
      locale: 'en',
      toolbar_bg: '#f1f3f6',
      enable_publishing: false,
      allow_symbol_change: false,
      hide_top_toolbar: false,
      save_image: false,
      studies: ['EMAExp@tv-basicstudies', 'EMAExp@tv-basicstudies'], // Default 10 and 21 EMA
      studies_overrides: {
        'EMAExp.length': 10,
        'EMAExp.length_0': 21,
      },
      withdateranges: true,
      details: true,
      hide_side_toolbar: false,
      calendar: true,
      news: ['headlines'],
    });

    widgetRef.current = widget;

    return () => {
      if (widgetRef.current) {
        widgetRef.current.remove();
        widgetRef.current = null;
      }
    };
  }, [selectedSymbol]);

  return (
    <div className="flex flex-col h-full">
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search NSE symbol e.g. NSE:TCS"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="p-2 rounded border border-gray-600 bg-gray-800 text-white w-full"
        />
        {searchTerm && (
          <ul className="max-h-48 overflow-auto bg-gray-900 border border-gray-700 rounded mt-1 text-sm">
            {filteredSymbols.slice(0, 20).map((sym) => (
              <li
                key={sym}
                className="p-2 hover:bg-gray-700 cursor-pointer"
                onClick={() => {
                  setSelectedSymbol(sym);
                  setSearchTerm('');
                }}
              >
                {sym}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div id="tv_chart_container" className="flex-1" style={{ minHeight: 600 }} />
    </div>
  );
}
