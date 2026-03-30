"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, ArrowUp, ArrowDown, TrendingUp, TrendingDown, RefreshCcw, AlertCircle, Layers, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

// Live Stock interface
interface Stock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: string;
  momentum: number;
  trend: 'bullish' | 'bearish';
  high?: number;
  low?: number;
}

const INDICES = [
  { id: 'all', label: 'All Indices' },
  { id: 'fno', label: 'F&O Stocks' },
  { id: 'nifty50', label: 'Nifty 50' },
  { id: 'banknifty', label: 'Bank Nifty' },
  { id: 'nifty500', label: 'Nifty 500' }
];

export default function MarketPulse() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'gainers' | 'losers'>('all');
  const [lastSyncTime, setLastSyncTime] = useState<string>('--:--:--');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLiveMarketData = useCallback(async (isManual = false, indexId = currentIndex) => {
    if (isManual) setIsRefreshing(true);
    else if (stocks.length === 0) setLoading(true);
    
    setError(null);

    try {
      const response = await fetch(`/api/market-data?index=${indexId}`);
      if (!response.ok) throw new Error('Market data feed interrupted');
      
      const data = await response.json();
      const stocksData = data.stocks;

      if (Array.isArray(stocksData)) {
        if (stocksData.length > 0 || stocks.length === 0) {
            setStocks(stocksData);
            setLastSyncTime(new Date().toLocaleTimeString());
        }
      } else {
        throw new Error('Invalid data format received');
      }
    } catch (err: unknown) {
      console.error('Fetch error:', err);
      setError('Live data feed unstable. Using cached or fallback data.');
      
      if (stocks.length === 0) {
        const symbols = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK'];
        const fallbackStocks = Array.from({ length: 50 }).map((_, i) => {
          const sym = symbols[i % symbols.length] + `-${i}`;
          const pChange = (Math.random() * 6 - 3);
          return {
            symbol: sym,
            name: `NSE Market Stock ${i + 1}`,
            price: Math.random() * 3000 + 100,
            change: Math.random() * 20 - 10,
            changePercent: parseFloat(pChange.toFixed(2)),
            volume: (Math.random() * 10).toFixed(2) + 'L',
            momentum: Math.random() * 5,
            trend: pChange > 0 ? 'bullish' as const : 'bearish' as const
          };
        }).sort((a, b) => b.changePercent - a.changePercent);
        setStocks(fallbackStocks);
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [stocks.length, currentIndex]);

  const handleIndexChange = (indexId: string) => {
    setCurrentIndex(indexId);
    setLoading(true);
    fetchLiveMarketData(false, indexId);
  };

  useEffect(() => {
    fetchLiveMarketData();
    const interval = setInterval(() => {
      fetchLiveMarketData(true);
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchLiveMarketData]);

  const filteredStocks = useMemo(() => {
    let result = stocks.filter(s => 
      s.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || 
      s.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (filter === 'gainers') result = result.filter(s => s.changePercent > 0);
    if (filter === 'losers') result = result.filter(s => s.changePercent < 0);

    return result;
  }, [stocks, searchQuery, filter]);

  const stats = useMemo(() => {
    const gainers = stocks.filter(s => s.changePercent > 0).length;
    const losers = stocks.filter(s => s.changePercent < 0).length;
    return { gainers, losers, total: stocks.length };
  }, [stocks]);

  const topGainer = stocks[0];
  const topLoser = stocks[stocks.length - 1];

  if (loading && stocks.length === 0) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center">
        <RefreshCcw className="animate-spin text-blue-500 mb-4" size={48} />
        <p className="text-gray-400 font-black tracking-widest uppercase text-xs">Initializing Market Stream...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 font-sans p-4 md:p-8 selection:bg-blue-500/30">
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
                <h1 className="text-3xl font-black bg-gradient-to-r from-blue-400 via-indigo-400 to-emerald-400 bg-clip-text text-transparent tracking-tighter">
                Market Pulse
                </h1>
                <span className="bg-blue-500/10 text-blue-400 text-[10px] font-black px-2 py-0.5 rounded-full border border-blue-500/20 uppercase tracking-widest">
                    V2.5 ULTRA
                </span>
            </div>
            <p className="text-gray-500 mt-1 flex items-center gap-2 font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Multi-Index Institutional Feed
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Last Sync</p>
              <p className="text-sm font-mono text-gray-300">{lastSyncTime}</p>
            </div>

            <div className="flex bg-[#111] border border-gray-800 p-1 rounded-xl shadow-inner overflow-x-auto no-scrollbar">
                {INDICES.map((idx) => (
                    <button
                        key={idx.id}
                        onClick={() => handleIndexChange(idx.id)}
                        className={cn(
                            "px-4 py-1.5 rounded-lg text-[10px] font-black transition-all uppercase tracking-tighter whitespace-nowrap",
                            currentIndex === idx.id 
                                ? "bg-white text-black shadow-lg" 
                                : "text-gray-500 hover:text-gray-300"
                        )}
                    >
                        {idx.label}
                    </button>
                ))}
            </div>
            
            <button 
              onClick={() => fetchLiveMarketData(true)}
              disabled={isRefreshing}
              className={cn(
                "p-3 rounded-xl bg-[#111] border border-gray-800 hover:border-gray-600 transition-all active:scale-95",
                isRefreshing && "text-blue-400 border-blue-900/50"
              )}
            >
              <RefreshCcw size={18} className={cn(isRefreshing && "animate-spin")} />
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-6 bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl flex items-center gap-3 text-rose-500 text-sm font-bold animate-pulse">
            <AlertCircle size={20} />
            {error}
          </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-[#111] border border-gray-800 p-5 rounded-2xl flex flex-col justify-between shadow-sm hover:border-gray-700 transition-colors">
          <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-3">Advance / Decline</p>
          <div className="flex items-end justify-between">
            <div className="flex gap-3 items-baseline">
              <span className="text-3xl font-black text-emerald-500 leading-none">{stats.gainers}</span>
              <span className="text-gray-700 text-xl font-light">/</span>
              <span className="text-3xl font-black text-rose-500 leading-none">{stats.losers}</span>
            </div>
            <div className="w-24 h-1.5 bg-gray-900 rounded-full overflow-hidden flex">
              <div className="bg-emerald-500 h-full transition-all duration-1000" style={{ width: `${(stats.gainers / stats.total) * 100}%` }} />
              <div className="bg-rose-500 h-full transition-all duration-1000" style={{ width: `${(stats.losers / stats.total) * 100}%` }} />
            </div>
          </div>
        </div>

        <div className="bg-[#111] border border-gray-800 p-5 rounded-2xl flex items-center justify-between group cursor-default hover:border-emerald-500/30 transition-all shadow-sm">
          <div>
            <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Top Performer</p>
            <p className="text-xl font-black text-emerald-500 truncate max-w-[150px]">{topGainer?.symbol || '--'}</p>
            <p className="text-emerald-500/60 text-xs font-mono font-black">+{topGainer?.changePercent || '0'}%</p>
          </div>
          <div className="bg-emerald-500/10 p-3 rounded-2xl group-hover:bg-emerald-500/20 transition-colors">
            <TrendingUp className="text-emerald-500" size={24} />
          </div>
        </div>

        <div className="bg-[#111] border border-gray-800 p-5 rounded-2xl flex items-center justify-between group cursor-default hover:border-rose-500/30 transition-all shadow-sm">
          <div>
            <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Top Laggard</p>
            <p className="text-xl font-black text-rose-500 truncate max-w-[150px]">{topLoser?.symbol || '--'}</p>
            <p className="text-rose-500/60 text-xs font-mono font-black">{topLoser?.changePercent || '0'}%</p>
          </div>
          <div className="bg-rose-500/10 p-3 rounded-2xl group-hover:bg-rose-500/20 transition-colors">
            <TrendingDown className="text-rose-500" size={24} />
          </div>
        </div>

        <div className="bg-[#111] border border-gray-800 p-5 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Active Universe</p>
            <p className="text-3xl font-black text-white">{stats.total}</p>
            <p className="text-gray-600 text-[10px] font-black uppercase tracking-widest">{INDICES.find(i => i.id === currentIndex)?.label}</p>
          </div>
          <div className="bg-blue-500/10 p-3 rounded-2xl">
            <Layers className="text-blue-500" size={24} />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mb-6 flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-400 transition-colors" size={18} />
          <input 
            type="text"
            placeholder={`Search symbols in ${INDICES.find(i => i.id === currentIndex)?.label}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#111] border border-gray-800 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/40 transition-all placeholder:text-gray-600 font-bold text-sm"
          />
        </div>
        
        <div className="flex bg-[#111] border border-gray-800 p-1 rounded-2xl self-start lg:self-stretch">
          <button onClick={() => setFilter('all')} className={cn("px-6 py-2 rounded-xl text-xs font-black transition-all uppercase", filter === 'all' ? "bg-gray-100 text-black shadow-lg" : "text-gray-500 hover:text-gray-300")}>All</button>
          <button onClick={() => setFilter('gainers')} className={cn("px-6 py-2 rounded-xl text-xs font-black transition-all uppercase", filter === 'gainers' ? "bg-emerald-500 text-white shadow-lg" : "text-gray-500 hover:text-emerald-500/80")}>Gainers</button>
          <button onClick={() => setFilter('losers')} className={cn("px-6 py-2 rounded-xl text-xs font-black transition-all uppercase", filter === 'losers' ? "bg-rose-500 text-white shadow-lg" : "text-gray-500 hover:text-rose-500/80")}>Losers</button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto bg-[#111] border border-gray-800 rounded-[2.5rem] overflow-hidden shadow-2xl backdrop-blur-3xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-800 bg-[#151515]/50">
                <th className="px-8 py-6 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Symbol \ Institutional Data</th>
                <th className="px-8 py-6 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] text-right">Price</th>
                <th className="px-8 py-6 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] text-right">Change</th>
                <th className="px-8 py-6 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] text-right">Performance</th>
                <th className="px-8 py-6 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] text-right hidden sm:table-cell">Chart</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/30">
              {filteredStocks.map((stock) => (
                <tr 
                  key={stock.symbol} 
                  onClick={() => window.open(`https://www.tradingview.com/chart/?symbol=NSE:${stock.symbol}`, '_blank')}
                  className="hover:bg-blue-500/[0.03] transition-all group cursor-pointer active:bg-blue-500/[0.05]"
                >
                  <td className="px-8 py-5">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-lg text-white group-hover:text-blue-400 transition-colors tracking-tight">{stock.symbol}</span>
                        <span className="text-[9px] bg-gray-900 text-gray-500 px-1.5 py-0.5 rounded font-black border border-gray-800 uppercase">NSE</span>
                        {stock.momentum > 4 && <span className="text-[9px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full font-black border border-emerald-500/20 animate-pulse">HOT</span>}
                        {stock.changePercent > 10 && <span className="text-[9px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full font-black border border-blue-500/20">BREAKOUT</span>}
                      </div>
                      <span className="text-[11px] text-gray-600 font-bold uppercase truncate max-w-[220px] mt-1 tracking-tight">{stock.name.replace(/-/g, ' ')}</span>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right font-mono font-black text-white">
                    <span className="text-gray-600 text-[10px] mr-1">₹</span>
                    {stock.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className={cn("px-8 py-5 text-right font-mono font-black text-sm", stock.change > 0 ? "text-emerald-500" : "text-rose-500")}>
                    {stock.change > 0 ? '+' : ''}{stock.change.toFixed(2)}
                  </td>
                  <td className="px-8 py-5 text-right">
                    <span className={cn(
                        "inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black font-mono shadow-sm",
                        stock.changePercent > 0 ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                    )}>
                      {stock.changePercent > 0 ? <ArrowUp size={12} strokeWidth={4} /> : <ArrowDown size={12} strokeWidth={4} />}
                      {Math.abs(stock.changePercent).toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right hidden sm:table-cell">
                    <button className="p-2 rounded-lg bg-gray-900/50 text-gray-600 group-hover:text-blue-400 group-hover:bg-blue-500/10 transition-all">
                        <ExternalLink size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              
              {filteredStocks.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-8 py-32 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="bg-gray-900/50 p-6 rounded-full border border-gray-800">
                        <Search size={48} className="text-gray-700" />
                      </div>
                      <p className="text-white text-xl font-black">No matches found</p>
                      <button onClick={() => setSearchQuery('')} className="text-blue-500 font-black hover:underline text-sm uppercase tracking-widest">Clear search</button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto mt-10 mb-20 text-center">
        <div className="inline-flex items-center gap-3 bg-[#111] border border-gray-800 px-6 py-3 rounded-full shadow-lg">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">
            Institutional Node Connected • {stats.total} Active Symbols • Sync: 15s
          </p>
        </div>
      </div>
    </div>
  );
}
